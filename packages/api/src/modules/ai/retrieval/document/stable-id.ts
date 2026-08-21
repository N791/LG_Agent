import { createHash } from 'node:crypto';

export function stableRetrievalId(namespace: string, ...parts: (number | string)[]): string {
  const hex = createHash('sha256')
    .update([namespace, ...parts].join('\0'))
    .digest('hex')
    .slice(0, 32)
    .split('');
  hex[12] = '5';
  hex[16] = ((Number.parseInt(hex[16] ?? '0', 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex
    .slice(12, 16)
    .join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`;
}

export function contentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function slugifyHeading(value: string): string {
  return (
    value
      .normalize('NFKC')
      .trim()
      .toLowerCase()
      .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'section'
  );
}
