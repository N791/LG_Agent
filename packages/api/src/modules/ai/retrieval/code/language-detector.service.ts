import { Injectable } from '@nestjs/common';
import type { CodeLanguage } from './code-intelligence.types';

@Injectable()
export class CodeLanguageDetector {
  detect(path: string): CodeLanguage {
    const extension = /\.[^.]+$/.exec(path.toLowerCase())?.[0];
    if (
      extension === '.ts' ||
      extension === '.tsx' ||
      extension === '.mts' ||
      extension === '.cts'
    ) {
      return 'typescript';
    }
    if (
      extension === '.js' ||
      extension === '.jsx' ||
      extension === '.mjs' ||
      extension === '.cjs'
    ) {
      return 'javascript';
    }
    return 'unsupported';
  }
}
