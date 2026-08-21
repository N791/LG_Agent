import { Injectable } from '@nestjs/common';
import ts from 'typescript';
import { codeFileHash, normalizeRepositoryPath, stableSymbolId } from './code-stable-id';
import type {
  CodeLanguage,
  CodeSymbolKind,
  ICodeParser,
  ParsedCodeFile,
  ParsedCodeSymbol,
  RepositorySourceFile,
  UnresolvedCodeRelation,
} from './code-intelligence.types';

@Injectable()
export class TypeScriptCodeParserAdapter implements ICodeParser {
  readonly languages = ['typescript', 'javascript'] as const;
  readonly version = `typescript-${ts.version}-v1`;

  parse(file: RepositorySourceFile, snapshotKey: string): ParsedCodeFile {
    const path = normalizeRepositoryPath(file.path);
    const language = this.language(path);
    const hash = codeFileHash(file.content);
    if (file.generated || this.looksGenerated(file.content)) {
      return this.fallback(file, snapshotKey, language, hash, 'GENERATED_CODE', 0.35);
    }
    const sourceFile = ts.createSourceFile(
      path,
      file.content,
      ts.ScriptTarget.Latest,
      true,
      this.scriptKind(path),
    );
    const syntaxErrors =
      (
        sourceFile as ts.SourceFile & {
          parseDiagnostics?: readonly ts.Diagnostic[];
        }
      ).parseDiagnostics ?? [];
    if (syntaxErrors.some(({ category }) => category === ts.DiagnosticCategory.Error)) {
      return this.fallback(file, snapshotKey, language, hash, 'SYNTAX_ERROR', 0.25);
    }

    const symbols: ParsedCodeSymbol[] = [];
    const unresolvedRelations: UnresolvedCodeRelation[] = [];
    const moduleSymbol = this.makeSymbol({
      node: sourceFile,
      sourceFile,
      snapshotKey,
      language,
      path,
      name: path,
      qualifiedName: path,
      kind: 'module',
      content: '',
      confidence: 1,
    });
    symbols.push(moduleSymbol);

    const visit = (node: ts.Node, parent: ParsedCodeSymbol): void => {
      const declaration = this.declaration(node);
      let owner = parent;
      if (declaration) {
        const qualifiedName = `${parent.qualifiedName}.${declaration.name}`;
        owner = this.makeSymbol({
          node,
          sourceFile,
          snapshotKey,
          language,
          path,
          name: declaration.name,
          qualifiedName,
          kind: declaration.kind,
          parentId: parent.id,
          confidence: 1,
        });
        symbols.push(owner);
        unresolvedRelations.push({
          sourceSymbolId: parent.id,
          targetName: owner.id,
          relationType: 'DEFINES',
          confidence: 1,
        });
        this.heritageRelations(node, owner.id, unresolvedRelations);
      }
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        unresolvedRelations.push({
          sourceSymbolId: moduleSymbol.id,
          targetName: `module:${node.moduleSpecifier.text}`,
          relationType: 'IMPORTS',
          confidence: 1,
        });
      }
      if (ts.isCallExpression(node)) {
        const called = this.expressionName(node.expression);
        if (called) {
          unresolvedRelations.push({
            sourceSymbolId: owner.id,
            targetName: called,
            relationType: 'CALLS',
            confidence: 0.95,
          });
        }
      }
      if (
        ts.isIdentifier(node) &&
        !this.isDeclarationName(node) &&
        !ts.isPropertyAccessExpression(node.parent)
      ) {
        unresolvedRelations.push({
          sourceSymbolId: owner.id,
          targetName: node.text,
          relationType: 'REFERENCES',
          confidence: 0.8,
        });
      }
      ts.forEachChild(node, (child) => {
        visit(child, owner);
      });
    };
    ts.forEachChild(sourceFile, (node) => {
      visit(node, moduleSymbol);
    });
    return {
      path,
      language,
      contentHash: hash,
      parserVersion: this.version,
      parseConfidence: 1,
      symbols,
      unresolvedRelations,
    };
  }

  private declaration(node: ts.Node): { name: string; kind: CodeSymbolKind } | undefined {
    if (ts.isClassDeclaration(node) && node.name) return { name: node.name.text, kind: 'class' };
    if (ts.isInterfaceDeclaration(node)) return { name: node.name.text, kind: 'interface' };
    if (ts.isFunctionDeclaration(node) && node.name)
      return { name: node.name.text, kind: 'function' };
    if (ts.isMethodDeclaration(node)) return { name: node.name.getText(), kind: 'method' };
    if (ts.isPropertyDeclaration(node)) return { name: node.name.getText(), kind: 'field' };
    if (ts.isTypeAliasDeclaration(node)) return { name: node.name.text, kind: 'type' };
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      ['describe', 'it', 'test'].includes(node.expression.text) &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      return { name: node.arguments[0].text, kind: 'test' };
    }
    return undefined;
  }

  private makeSymbol(input: {
    node: ts.Node;
    sourceFile: ts.SourceFile;
    snapshotKey: string;
    language: CodeLanguage;
    path: string;
    name: string;
    qualifiedName: string;
    kind: CodeSymbolKind;
    parentId?: string;
    content?: string;
    confidence: number;
  }): ParsedCodeSymbol {
    const start = input.sourceFile.getLineAndCharacterOfPosition(
      input.node.getStart(input.sourceFile),
    );
    const end = input.sourceFile.getLineAndCharacterOfPosition(input.node.getEnd());
    const content = input.content ?? input.node.getText(input.sourceFile);
    const signature = this.signature(input.node, input.sourceFile);
    const id = stableSymbolId({
      snapshotKey: input.snapshotKey,
      language: input.language,
      path: input.path,
      qualifiedName: input.qualifiedName,
      kind: input.kind,
      signature,
    });
    const docComment = this.docComment(input.node, input.sourceFile);
    return {
      id,
      stableKey: id,
      name: input.name,
      qualifiedName: input.qualifiedName,
      kind: input.kind,
      language: input.language,
      path: input.path,
      startLine: start.line + 1,
      endLine: end.line + 1,
      ...(signature && { signature }),
      ...(docComment && { docComment }),
      summary: docComment?.split(/\r?\n/)[0]?.slice(0, 240) ?? `${input.kind} ${input.name}`,
      ...(input.parentId && { parentId: input.parentId }),
      content,
      parseConfidence: input.confidence,
    };
  }

  private signature(node: ts.Node, sourceFile: ts.SourceFile): string | undefined {
    if (ts.isSourceFile(node)) return undefined;
    const body = 'body' in node ? (node as ts.Node & { body?: ts.Node }).body : undefined;
    const end = body?.getFullStart() ?? node.getEnd();
    return sourceFile.text.slice(node.getStart(sourceFile), end).replace(/\s+/g, ' ').trim();
  }

  private docComment(node: ts.Node, sourceFile: ts.SourceFile): string | undefined {
    const ranges = ts.getLeadingCommentRanges(sourceFile.text, node.getFullStart()) ?? [];
    const last = ranges.at(-1);
    if (!last) return undefined;
    const value = sourceFile.text.slice(last.pos, last.end);
    if (!value.startsWith('/**')) return undefined;
    return value
      .replace(/^\/\*\*|\*\/$/g, '')
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*\*\s?/, ''))
      .join('\n')
      .trim();
  }

  private heritageRelations(
    node: ts.Node,
    sourceSymbolId: string,
    relations: UnresolvedCodeRelation[],
  ): void {
    if (!ts.isClassDeclaration(node) && !ts.isInterfaceDeclaration(node)) return;
    for (const clause of node.heritageClauses ?? []) {
      const relationType =
        clause.token === ts.SyntaxKind.ImplementsKeyword ? 'IMPLEMENTS' : 'EXTENDS';
      for (const type of clause.types) {
        relations.push({
          sourceSymbolId,
          targetName: type.expression.getText(),
          relationType,
          confidence: 1,
        });
      }
    }
  }

  private expressionName(expression: ts.LeftHandSideExpression): string | undefined {
    if (ts.isIdentifier(expression)) return expression.text;
    if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
    return undefined;
  }

  private isDeclarationName(node: ts.Identifier): boolean {
    const parent = node.parent;
    return (
      (('name' in parent && (parent as ts.Node & { name?: ts.Node }).name === node) ||
        ts.isImportClause(parent) ||
        ts.isImportSpecifier(parent) ||
        ts.isNamespaceImport(parent) ||
        ts.isBindingElement(parent)) &&
      !ts.isCallExpression(parent)
    );
  }

  private fallback(
    file: RepositorySourceFile,
    snapshotKey: string,
    language: CodeLanguage,
    hash: string,
    fallbackReason: NonNullable<ParsedCodeFile['fallbackReason']>,
    confidence: number,
  ): ParsedCodeFile {
    const path = normalizeRepositoryPath(file.path);
    const lines = file.content.split(/\r?\n/).length;
    const id = stableSymbolId({
      snapshotKey,
      language,
      path,
      qualifiedName: path,
      kind: 'file',
    });
    return {
      path,
      language,
      contentHash: hash,
      parserVersion: this.version,
      parseConfidence: confidence,
      fallbackReason,
      symbols: [
        {
          id,
          stableKey: id,
          name: path,
          qualifiedName: path,
          kind: 'file',
          language,
          path,
          startLine: 1,
          endLine: lines,
          summary: `File-level fallback: ${fallbackReason}`,
          content: file.content,
          parseConfidence: confidence,
        },
      ],
      unresolvedRelations: [],
    };
  }

  private language(path: string): CodeLanguage {
    return /\.[cm]?tsx?$/.test(path.toLowerCase()) ? 'typescript' : 'javascript';
  }

  private scriptKind(path: string): ts.ScriptKind {
    if (/\.tsx$/i.test(path)) return ts.ScriptKind.TSX;
    if (/\.jsx$/i.test(path)) return ts.ScriptKind.JSX;
    return this.language(path) === 'typescript' ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  }

  private looksGenerated(content: string): boolean {
    return /(?:@generated|generated file|do not edit)/i.test(content.slice(0, 500));
  }
}
