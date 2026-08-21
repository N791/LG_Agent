export type CodeLanguage = 'typescript' | 'javascript' | 'unsupported';

export type CodeSymbolKind =
  'module' | 'class' | 'interface' | 'function' | 'method' | 'field' | 'type' | 'test' | 'file';

export type CodeRelationKind =
  'DEFINES' | 'IMPORTS' | 'REFERENCES' | 'CALLS' | 'IMPLEMENTS' | 'EXTENDS' | 'TESTS';

export interface RepositorySourceFile {
  path: string;
  content: string;
  generated?: boolean;
}

export interface ParsedCodeSymbol {
  id: string;
  stableKey: string;
  name: string;
  qualifiedName: string;
  kind: CodeSymbolKind;
  language: CodeLanguage;
  path: string;
  startLine: number;
  endLine: number;
  signature?: string;
  docComment?: string;
  summary: string;
  parentId?: string;
  content: string;
  parseConfidence: number;
}

export interface UnresolvedCodeRelation {
  sourceSymbolId: string;
  targetName: string;
  relationType: CodeRelationKind;
  confidence: number;
  heuristic?: string;
}

export interface ParsedCodeFile {
  path: string;
  language: CodeLanguage;
  contentHash: string;
  parserVersion: string;
  parseConfidence: number;
  fallbackReason?: 'UNSUPPORTED_LANGUAGE' | 'SYNTAX_ERROR' | 'GENERATED_CODE';
  symbols: ParsedCodeSymbol[];
  unresolvedRelations: UnresolvedCodeRelation[];
}

export interface ResolvedCodeRelation {
  id: string;
  sourceSymbolId: string;
  targetSymbolId: string;
  relationType: CodeRelationKind;
  confidence: number;
  heuristic?: string;
}

export interface CodeIndex {
  files: ParsedCodeFile[];
  symbols: ParsedCodeSymbol[];
  relations: ResolvedCodeRelation[];
}

export interface ICodeParser {
  readonly languages: readonly CodeLanguage[];
  readonly version: string;
  parse(file: RepositorySourceFile, snapshotKey: string): ParsedCodeFile;
}
