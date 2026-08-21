import { Injectable } from '@nestjs/common';
import type { CodeLanguage, ICodeParser } from './code-intelligence.types';

@Injectable()
export class CodeParserRegistry {
  private readonly parsers = new Map<CodeLanguage, ICodeParser>();

  register(parser: ICodeParser): void {
    for (const language of parser.languages) {
      if (language === 'unsupported') continue;
      this.parsers.set(language, parser);
    }
  }

  get(language: CodeLanguage): ICodeParser | undefined {
    return this.parsers.get(language);
  }
}
