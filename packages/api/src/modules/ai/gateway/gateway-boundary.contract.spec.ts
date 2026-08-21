import * as fs from 'fs';
import * as path from 'path';

describe('AI gateway boundary contract', () => {
  it('keeps provider SDK imports inside provider adapters', () => {
    const aiRoot = path.resolve(process.cwd(), 'src/modules/ai');
    const violations: string[] = [];

    for (const file of walk(aiRoot)) {
      if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) continue;
      if (file.includes(`${path.sep}providers${path.sep}`)) continue;
      const source = fs.readFileSync(file, 'utf8');
      if (/from\s+['"](?:openai|@langchain\/openai|deepseek|dashscope)/.test(source)) {
        violations.push(path.relative(aiRoot, file));
      }
    }

    expect(violations).toEqual([]);
  });
});

function walk(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}
