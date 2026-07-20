import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { IKnowledgeRepository } from './interfaces';
import { KnowledgeDocumentDTO } from '@lg-agent/contracts';

@Injectable()
export class MarkdownKnowledgeRepository implements IKnowledgeRepository {
  private readonly logger = new Logger(MarkdownKnowledgeRepository.name);
  private documents: KnowledgeDocumentDTO[] = [];
  private isLoaded = false;

  constructor() {}

  private loadDocuments() {
    if (this.isLoaded) return;
    
    const knowledgeDir = path.resolve(process.cwd(), 'knowledge');
    if (!fs.existsSync(knowledgeDir)) {
      this.logger.warn(`Knowledge directory not found at ${knowledgeDir}`);
      fs.mkdirSync(knowledgeDir, { recursive: true });
      
      // Seed a sample document for MVP
      const sampleDoc = `# Antigravity IDE Guidelines\n\nWelcome to Antigravity IDE. This is a sample reference document.\n\n## Rules\n1. Always write clean code.\n2. Do not mutate state directly.\n`;
      fs.writeFileSync(path.join(knowledgeDir, 'ide_guidelines.md'), sampleDoc);
    }

    const files = fs.readdirSync(knowledgeDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(knowledgeDir, file), 'utf-8');
      this.documents.push({
        id: file.replace('.md', ''),
        title: file.replace('.md', '').replace(/_/g, ' '),
        content,
        source: file,
      });
    }

    this.isLoaded = true;
    this.logger.log(`Loaded ${String(this.documents.length)} knowledge documents.`);
  }

  getDocuments(): Promise<KnowledgeDocumentDTO[]> {
    this.loadDocuments();
    return Promise.resolve(this.documents);
  }

  getDocument(id: string): Promise<KnowledgeDocumentDTO | null> {
    this.loadDocuments();
    const doc = this.documents.find(d => d.id === id);
    return Promise.resolve(doc || null);
  }
}
