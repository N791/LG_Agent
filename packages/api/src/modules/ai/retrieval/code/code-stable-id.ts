import { contentHash, stableRetrievalId } from '../document/stable-id';
import type { CodeLanguage, CodeRelationKind, CodeSymbolKind } from './code-intelligence.types';

export function normalizeRepositoryPath(input: string): string {
  const normalized = input
    .replaceAll('\\', '/')
    .replace(/^\.\/+/, '')
    .replace(/\/+/g, '/');
  if (!normalized || normalized.startsWith('/') || normalized.split('/').includes('..')) {
    throw new Error(`Repository path must be relative and normalized: ${input}`);
  }
  return normalized.normalize('NFC');
}

export function codeFileHash(content: string): string {
  return contentHash(content.replace(/\r\n?/g, '\n'));
}

export function stableSymbolId(input: {
  snapshotKey: string;
  language: CodeLanguage;
  path: string;
  qualifiedName: string;
  kind: CodeSymbolKind;
  signature?: string;
}): string {
  return stableRetrievalId(
    'code-symbol-v1',
    input.snapshotKey,
    input.language,
    normalizeRepositoryPath(input.path),
    input.qualifiedName.normalize('NFKC'),
    input.kind,
    input.signature?.replace(/\s+/g, ' ').trim() ?? '',
  );
}

export function stableRelationId(input: {
  snapshotKey: string;
  sourceSymbolId: string;
  targetSymbolId: string;
  relationType: CodeRelationKind;
}): string {
  return stableRetrievalId(
    'code-relation-v1',
    input.snapshotKey,
    input.sourceSymbolId,
    input.targetSymbolId,
    input.relationType,
  );
}
