import { DocumentStructureParser } from './document-structure.parser';
import { StructuredDocumentChunker } from './structured-document.chunker';
import type { DocumentStructureNode } from './document-structure.types';

const GOLDEN_MARKDOWN = `# API 指南
Use \`ERR_AUTH_42\` when authentication fails.

## 表格
| 名称 | API |
| --- | --- |
| 用户 | getUser |

<!-- page: 2 -->

## Example
\`\`\`ts
export function getUser(id: string) {
  return id;
}
\`\`\`

## Example
- mixed language 项目 one
- 项目 two

\`\`\`broken
an intentionally unclosed code fence`;

describe('Epic 75 structured document golden cases', () => {
  const parser = new DocumentStructureParser();
  const chunker = new StructuredDocumentChunker();

  it('preserves headings, tables, code, mixed language, locators, and duplicate anchors', () => {
    const document = parser.parse(GOLDEN_MARKDOWN, 'version-1');
    const all = flatten(document.root);

    expect(
      all.filter(({ type }) => type === 'SECTION').map(({ locator }) => locator.anchor),
    ).toEqual(['api-指南', '表格', 'example', 'example-2']);
    expect(all.some(({ type, content }) => type === 'TABLE' && content.includes('getUser'))).toBe(
      true,
    );
    expect(all.filter(({ type }) => type === 'CODE')).toHaveLength(2);
    expect(all.every(({ locator }) => locator.startLine <= locator.endLine)).toBe(true);
    expect(all.some(({ locator }) => locator.page === 2)).toBe(true);
  });

  it('creates stable overlapping chunks bounded by the configured token budget', () => {
    const document = parser.parse(GOLDEN_MARKDOWN, 'version-1');
    const first = chunker.chunk(document, {
      maxTokens: 16,
      overlapTokens: 4,
      chunkerVersion: 'golden-v1',
    });
    const rebuilt = chunker.chunk(document, {
      maxTokens: 16,
      overlapTokens: 4,
      chunkerVersion: 'golden-v1',
    });

    expect(first.map(({ id }) => id)).toEqual(rebuilt.map(({ id }) => id));
    expect(first.every(({ tokenCount }) => tokenCount <= 16)).toBe(true);
    expect(first.every(({ chunkerVersion }) => chunkerVersion === 'golden-v1')).toBe(true);
    expect(new Set(first.map(({ id }) => id)).size).toBe(first.length);
  });
});

function flatten(node: DocumentStructureNode): DocumentStructureNode[] {
  return [node, ...node.children.flatMap(flatten)];
}
