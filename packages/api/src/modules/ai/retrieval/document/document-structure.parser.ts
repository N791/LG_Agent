import { Injectable } from '@nestjs/common';
import type {
  DocumentBlockType,
  DocumentStructureNode,
  StructuredDocument,
} from './document-structure.types';
import { slugifyHeading, stableRetrievalId } from './stable-id';

interface PendingBlock {
  type: Exclude<DocumentBlockType, 'DOCUMENT' | 'SECTION'>;
  lines: string[];
  startLine: number;
  endLine: number;
}

@Injectable()
export class DocumentStructureParser {
  parse(markdown: string, documentVersionId: string): StructuredDocument {
    const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
    const root = this.node(documentVersionId, undefined, 'DOCUMENT', 0, 0, [], '', 1, lines.length);
    const sectionStack: DocumentStructureNode[] = [root];
    const anchors = new Map<string, number>();
    let pending: PendingBlock | undefined;
    let inCode = false;
    let currentPage: number | undefined;

    const flush = (): void => {
      if (!pending || pending.lines.every((line) => !line.trim())) {
        pending = undefined;
        return;
      }
      const parent = sectionStack.at(-1) ?? root;
      const content = pending.lines.join('\n').trim();
      const child = this.node(
        documentVersionId,
        parent,
        pending.type,
        parent.children.length,
        parent.depth + 1,
        parent.sectionPath,
        content,
        pending.startLine,
        pending.endLine,
        undefined,
        undefined,
        currentPage,
      );
      parent.children.push(child);
      pending = undefined;
    };

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? '';
      const lineNumber = index + 1;
      const pageMarker = /^\s*(?:<!--\s*page:\s*(\d+)\s*-->|\f\s*(\d+)?)\s*$/i.exec(line);
      if (pageMarker && !inCode) {
        flush();
        currentPage = Number(pageMarker[1] ?? pageMarker[2] ?? (currentPage ?? 0) + 1);
        continue;
      }
      if (/^\s*```/.test(line)) {
        if (!inCode) {
          flush();
          pending = { type: 'CODE', lines: [line], startLine: lineNumber, endLine: lineNumber };
          inCode = true;
        } else {
          if (!pending) throw new Error('Document parser code-block state is inconsistent.');
          pending.lines.push(line);
          pending.endLine = lineNumber;
          flush();
          inCode = false;
        }
        continue;
      }
      if (inCode) {
        if (!pending) throw new Error('Document parser code-block state is inconsistent.');
        pending.lines.push(line);
        pending.endLine = lineNumber;
        continue;
      }

      const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
      if (heading) {
        flush();
        const depth = (heading[1] ?? '').length;
        while (sectionStack.length > 1 && (sectionStack.at(-1) ?? root).depth >= depth) {
          sectionStack.pop();
        }
        const parent = sectionStack.at(-1) ?? root;
        const title = (heading[2] ?? '').trim();
        const baseAnchor = slugifyHeading(title);
        const occurrence = (anchors.get(baseAnchor) ?? 0) + 1;
        anchors.set(baseAnchor, occurrence);
        const anchor = occurrence === 1 ? baseAnchor : `${baseAnchor}-${String(occurrence)}`;
        const sectionPath = [...parent.sectionPath, title];
        const section = this.node(
          documentVersionId,
          parent,
          'SECTION',
          parent.children.length,
          depth,
          sectionPath,
          '',
          lineNumber,
          lineNumber,
          title,
          anchor,
          currentPage,
        );
        parent.children.push(section);
        sectionStack.push(section);
        continue;
      }

      if (!line.trim()) {
        flush();
        continue;
      }
      const type: PendingBlock['type'] = /^\s*(?:[-*+]|\d+[.)])\s+/.test(line)
        ? 'LIST'
        : /^\s*\|.*\|\s*$/.test(line)
          ? 'TABLE'
          : 'PARAGRAPH';
      if (pending && pending.type !== type) flush();
      pending ??= { type, lines: [], startLine: lineNumber, endLine: lineNumber };
      pending.lines.push(line);
      pending.endLine = lineNumber;
    }
    flush();
    return { documentVersionId, root };
  }

  private node(
    versionId: string,
    parent: DocumentStructureNode | undefined,
    type: DocumentBlockType,
    ordinal: number,
    depth: number,
    sectionPath: string[],
    content: string,
    startLine: number,
    endLine: number,
    title?: string,
    explicitAnchor?: string,
    page?: number,
  ): DocumentStructureNode {
    const pathKey = [...sectionPath, type, String(ordinal), String(startLine)].join('/');
    const id = stableRetrievalId('document-node', versionId, pathKey);
    return {
      id,
      ...(parent && { parentId: parent.id }),
      type,
      ...(title && { title }),
      content,
      sectionPath,
      ordinal,
      depth,
      locator: {
        anchor: explicitAnchor ?? slugifyHeading(sectionPath.at(-1) ?? `line-${String(startLine)}`),
        startLine,
        endLine,
        ...(page !== undefined && { page }),
      },
      children: [],
    };
  }
}
