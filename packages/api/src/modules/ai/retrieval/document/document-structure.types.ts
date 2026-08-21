export type DocumentBlockType = 'DOCUMENT' | 'SECTION' | 'PARAGRAPH' | 'LIST' | 'TABLE' | 'CODE';

export interface DocumentLocator {
  page?: number;
  anchor: string;
  startLine: number;
  endLine: number;
}

export interface DocumentStructureNode {
  id: string;
  parentId?: string;
  type: DocumentBlockType;
  title?: string;
  content: string;
  sectionPath: string[];
  ordinal: number;
  depth: number;
  locator: DocumentLocator;
  children: DocumentStructureNode[];
}

export interface StructuredDocument {
  documentVersionId: string;
  root: DocumentStructureNode;
}

export interface StructuredDocumentChunk {
  id: string;
  documentVersionId: string;
  nodeId: string;
  parentId?: string;
  content: string;
  contentHash: string;
  sectionPath: string[];
  ordinal: number;
  tokenCount: number;
  locator: DocumentLocator;
  chunkerVersion: string;
}

export interface ChunkingOptions {
  maxTokens?: number;
  overlapTokens?: number;
  chunkerVersion?: string;
}
