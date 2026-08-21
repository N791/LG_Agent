import type { CodeRelationKind, CodeSymbolKind } from './code-intelligence.types';

export interface CodeSnapshotRecord {
  id: string;
  organizationId: string;
  repositoryId: string;
  repositoryName: string;
  canonicalUri: string;
  commitSha: string;
}

export interface CodeSymbolRecord {
  id: string;
  organizationId: string;
  repositorySnapshotId: string;
  repositoryId: string;
  repositoryName: string;
  canonicalUri: string;
  commitSha: string;
  name: string;
  qualifiedName: string;
  kind: CodeSymbolKind;
  language: string;
  path: string;
  startLine: number;
  endLine: number;
  signature?: string;
  docComment?: string;
  summary: string;
  content: string;
  parseConfidence: number;
  fallbackReason?: string;
  score: number;
}

export interface CodeRelationRecord {
  sourceSymbolId: string;
  targetSymbolId: string;
  relationType: CodeRelationKind;
  confidence: number;
  heuristic?: string;
}

export interface ICodeRetrievalStore {
  search(input: {
    organizationId: string;
    userId: string;
    query: string;
    repositorySnapshotId?: string;
    limit: number;
  }): Promise<CodeSymbolRecord[]>;
  read(input: {
    organizationId: string;
    userId: string;
    repositorySnapshotId: string;
    symbolId: string;
  }): Promise<CodeSymbolRecord | undefined>;
  relations(input: {
    organizationId: string;
    userId: string;
    repositorySnapshotId: string;
  }): Promise<CodeRelationRecord[]>;
  readMany(input: {
    organizationId: string;
    userId: string;
    repositorySnapshotId: string;
    symbolIds: string[];
  }): Promise<CodeSymbolRecord[]>;
}

export const CODE_RETRIEVAL_STORE = Symbol('ICodeRetrievalStore');
