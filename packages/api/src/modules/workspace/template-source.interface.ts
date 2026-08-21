import type { WorkspaceFileDTO } from '@lg-agent/contracts';

export const TEMPLATE_SOURCE = Symbol('TEMPLATE_SOURCE');

export interface GitTemplateRequest {
  repositoryUrl: string;
  ref: string;
  credentialEnv?: Record<string, string>;
}

export interface TemplateManifest {
  source: { repositoryUrl: string; commit: string };
  files: { path: string; bytes: number; sha256: string }[];
  totalBytes: number;
  digest: string;
}

export interface ImportedTemplate {
  files: WorkspaceFileDTO[];
  manifest: TemplateManifest;
}

export interface ITemplateSource {
  importTemplate(request: GitTemplateRequest): Promise<ImportedTemplate>;
}
