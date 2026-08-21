import { Inject, Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { stableRetrievalId } from '../document/stable-id';
import { CodeLanguageDetector } from './language-detector.service';
import { CodeParserRegistry } from './parser-registry.service';
import { TypeScriptCodeParserAdapter } from './typescript-code-parser.adapter';
import {
  codeFileHash,
  normalizeRepositoryPath,
  stableRelationId,
  stableSymbolId,
} from './code-stable-id';
import type {
  CodeIndex,
  ParsedCodeFile,
  ParsedCodeSymbol,
  RepositorySourceFile,
  ResolvedCodeRelation,
  UnresolvedCodeRelation,
} from './code-intelligence.types';
import { IndexJobObservabilityService } from '../index-job-observability.service';

export interface RepositoryIndexInput {
  organizationId: string;
  repositoryId: string;
  repositoryName: string;
  canonicalUri: string;
  commitSha: string;
  defaultBranch?: string;
  acl?: Record<string, unknown>;
  files: RepositorySourceFile[];
}

export interface RepositoryIndexResult {
  repositorySnapshotId: string;
  symbolCount: number;
  relationCount: number;
  fallbackFileCount: number;
  reusedFileCount: number;
  reused: boolean;
}

export interface ICodeIndexRepository {
  ensureSnapshot(input: {
    id: string;
    organizationId: string;
    repositoryId: string;
    repositoryName: string;
    canonicalUri: string;
    commitSha: string;
    defaultBranch?: string;
    acl: Record<string, unknown>;
  }): Promise<void>;
  isReady(
    organizationId: string,
    repositorySnapshotId: string,
    parserVersion: string,
  ): Promise<boolean>;
  findReusableFile(input: {
    organizationId: string;
    repositoryId: string;
    path: string;
    contentHash: string;
    parserVersion: string;
  }): Promise<ParsedCodeFile | undefined>;
  replaceBuildingIndex(input: {
    organizationId: string;
    repositorySnapshotId: string;
    parserVersion: string;
    index: CodeIndex;
    sourceFiles: RepositorySourceFile[];
  }): Promise<void>;
  markReady(
    organizationId: string,
    repositorySnapshotId: string,
    parserVersion: string,
  ): Promise<void>;
  markFailed(organizationId: string, repositorySnapshotId: string, reason: string): Promise<void>;
}

export const CODE_INDEX_REPOSITORY = Symbol('ICodeIndexRepository');

@Injectable()
export class RepositoryCodeIndexService implements OnModuleInit {
  constructor(
    private readonly detector: CodeLanguageDetector,
    private readonly registry: CodeParserRegistry,
    private readonly typeScriptParser: TypeScriptCodeParserAdapter,
    @Inject(CODE_INDEX_REPOSITORY) private readonly repository: ICodeIndexRepository,
    @Optional() private readonly jobs?: IndexJobObservabilityService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.typeScriptParser);
  }

  async index(input: RepositoryIndexInput): Promise<RepositoryIndexResult> {
    const commitSha = this.normalizeCommit(input.commitSha);
    const snapshotId = stableRetrievalId(
      'repository-snapshot-v1',
      input.organizationId,
      input.repositoryId,
      commitSha,
    );
    await this.repository.ensureSnapshot({
      id: snapshotId,
      organizationId: input.organizationId,
      repositoryId: input.repositoryId,
      repositoryName: input.repositoryName,
      canonicalUri: input.canonicalUri,
      commitSha,
      ...(input.defaultBranch && { defaultBranch: input.defaultBranch }),
      acl: input.acl ?? {},
    });
    const parserVersion = this.typeScriptParser.version;
    if (await this.repository.isReady(input.organizationId, snapshotId, parserVersion)) {
      return {
        repositorySnapshotId: snapshotId,
        symbolCount: 0,
        relationCount: 0,
        fallbackFileCount: 0,
        reusedFileCount: 0,
        reused: true,
      };
    }
    this.jobs?.start({
      jobId: snapshotId,
      organizationId: input.organizationId,
      kind: 'CODE',
      indexVersion: parserVersion,
      content: input.files
        .map(({ path, content }) => `${normalizeRepositoryPath(path)}\0${codeFileHash(content)}`)
        .sort()
        .join('\n'),
    });

    let reusedFileCount = 0;
    const files: ParsedCodeFile[] = [];
    try {
      for (const rawFile of input.files) {
        const file = { ...rawFile, path: normalizeRepositoryPath(rawFile.path) };
        const language = this.detector.detect(file.path);
        const parser = this.registry.get(language);
        if (!parser) {
          files.push(this.unsupportedFile(file, snapshotId));
          continue;
        }
        const reusable = await this.repository.findReusableFile({
          organizationId: input.organizationId,
          repositoryId: input.repositoryId,
          path: file.path,
          contentHash: codeFileHash(file.content),
          parserVersion: parser.version,
        });
        if (reusable) {
          reusedFileCount += 1;
          files.push(this.rebind(reusable, snapshotId));
        } else {
          files.push(parser.parse(file, snapshotId));
        }
      }
      this.jobs?.progress(snapshotId, 50);
      const symbols = files.flatMap(({ symbols }) => symbols);
      const relations = this.resolveRelations(
        snapshotId,
        symbols,
        files.flatMap(({ unresolvedRelations }) => unresolvedRelations),
      );
      const index = { files, symbols, relations };
      await this.repository.replaceBuildingIndex({
        organizationId: input.organizationId,
        repositorySnapshotId: snapshotId,
        parserVersion,
        index,
        sourceFiles: input.files,
      });
      await this.repository.markReady(input.organizationId, snapshotId, parserVersion);
      this.jobs?.complete(snapshotId);
      return {
        repositorySnapshotId: snapshotId,
        symbolCount: symbols.length,
        relationCount: relations.length,
        fallbackFileCount: files.filter(({ fallbackReason }) => fallbackReason).length,
        reusedFileCount,
        reused: false,
      };
    } catch (error: unknown) {
      this.jobs?.fail(snapshotId, error);
      await this.repository.markFailed(
        input.organizationId,
        snapshotId,
        (error as Error).message.slice(0, 500),
      );
      throw error;
    }
  }

  private resolveRelations(
    snapshotKey: string,
    symbols: ParsedCodeSymbol[],
    unresolved: UnresolvedCodeRelation[],
  ): ResolvedCodeRelation[] {
    const byId = new Map(symbols.map((symbol) => [symbol.id, symbol]));
    const byName = new Map<string, ParsedCodeSymbol[]>();
    for (const symbol of symbols) {
      for (const key of [symbol.name, symbol.qualifiedName]) {
        byName.set(key, [...(byName.get(key) ?? []), symbol]);
      }
    }
    const relations = new Map<string, ResolvedCodeRelation>();
    for (const relation of unresolved) {
      const source = byId.get(relation.sourceSymbolId);
      if (!source) continue;
      const target =
        byId.get(relation.targetName) ??
        (relation.targetName.startsWith('module:')
          ? this.resolveImportedModule(source.path, relation.targetName.slice(7), symbols)
          : this.bestTarget(source, byName.get(relation.targetName) ?? []));
      if (!target || target.id === source.id) continue;
      this.addRelation(relations, snapshotKey, source.id, target.id, relation);
      if (source.kind === 'test' && relation.relationType === 'CALLS') {
        this.addRelation(relations, snapshotKey, source.id, target.id, {
          ...relation,
          relationType: 'TESTS',
          confidence: 1,
        });
      }
    }
    return [...relations.values()].sort(
      (left, right) =>
        left.sourceSymbolId.localeCompare(right.sourceSymbolId) ||
        left.targetSymbolId.localeCompare(right.targetSymbolId) ||
        left.relationType.localeCompare(right.relationType),
    );
  }

  private addRelation(
    output: Map<string, ResolvedCodeRelation>,
    snapshotKey: string,
    sourceSymbolId: string,
    targetSymbolId: string,
    relation: Pick<UnresolvedCodeRelation, 'relationType' | 'confidence' | 'heuristic'>,
  ): void {
    const id = stableRelationId({
      snapshotKey,
      sourceSymbolId,
      targetSymbolId,
      relationType: relation.relationType,
    });
    output.set(id, {
      id,
      sourceSymbolId,
      targetSymbolId,
      relationType: relation.relationType,
      confidence: relation.confidence,
      ...(relation.heuristic && { heuristic: relation.heuristic }),
    });
  }

  private bestTarget(
    source: ParsedCodeSymbol,
    candidates: ParsedCodeSymbol[],
  ): ParsedCodeSymbol | undefined {
    return candidates
      .filter(({ id }) => id !== source.id)
      .sort(
        (left, right) =>
          Number(right.path === source.path) - Number(left.path === source.path) ||
          left.qualifiedName.localeCompare(right.qualifiedName),
      )[0];
  }

  private resolveImportedModule(
    sourcePath: string,
    specifier: string,
    symbols: ParsedCodeSymbol[],
  ): ParsedCodeSymbol | undefined {
    if (!specifier.startsWith('.')) {
      return symbols.find(({ kind, name }) => kind === 'module' && name === specifier);
    }
    const base = sourcePath.split('/').slice(0, -1);
    for (const segment of specifier.split('/')) {
      if (segment === '.' || !segment) continue;
      if (segment === '..') base.pop();
      else base.push(segment);
    }
    const wanted = base.join('/');
    return symbols.find(
      ({ kind, path }) =>
        kind === 'module' &&
        (path === wanted ||
          path.replace(/\.[^.]+$/, '') === wanted ||
          path.startsWith(`${wanted}/index.`)),
    );
  }

  private rebind(file: ParsedCodeFile, snapshotKey: string): ParsedCodeFile {
    const idMap = new Map<string, string>();
    const symbols = file.symbols.map((symbol) => {
      const id = stableSymbolId({ ...symbol, snapshotKey });
      idMap.set(symbol.id, id);
      return { ...symbol, id, stableKey: id };
    });
    return {
      ...file,
      symbols: symbols.map((symbol) => ({
        ...symbol,
        ...(symbol.parentId && { parentId: idMap.get(symbol.parentId) }),
      })),
      unresolvedRelations: file.unresolvedRelations.map((relation) => ({
        ...relation,
        sourceSymbolId: idMap.get(relation.sourceSymbolId) ?? relation.sourceSymbolId,
        targetName: idMap.get(relation.targetName) ?? relation.targetName,
      })),
    };
  }

  private unsupportedFile(file: RepositorySourceFile, snapshotKey: string): ParsedCodeFile {
    const path = normalizeRepositoryPath(file.path);
    const id = stableSymbolId({
      snapshotKey,
      language: 'unsupported',
      path,
      qualifiedName: path,
      kind: 'file',
    });
    return {
      path,
      language: 'unsupported',
      contentHash: codeFileHash(file.content),
      parserVersion: 'file-fallback-v1',
      parseConfidence: 0.1,
      fallbackReason: 'UNSUPPORTED_LANGUAGE',
      symbols: [
        {
          id,
          stableKey: id,
          name: path,
          qualifiedName: path,
          kind: 'file',
          language: 'unsupported',
          path,
          startLine: 1,
          endLine: file.content.split(/\r?\n/).length,
          summary: 'File-level fallback: UNSUPPORTED_LANGUAGE',
          content: file.content,
          parseConfidence: 0.1,
        },
      ],
      unresolvedRelations: [],
    };
  }

  private normalizeCommit(value: string): string {
    const commit = value.trim().toLowerCase();
    if (!/^[a-f0-9]{7,64}$/.test(commit)) {
      throw new Error('Repository snapshot requires a fixed hexadecimal commit SHA.');
    }
    return commit;
  }
}
