import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import type {
  GitTemplateRequest,
  ImportedTemplate,
  ITemplateSource,
} from './template-source.interface';

const execFileAsync = promisify(execFile);
@Injectable()
export class GitTemplateSourceAdapter implements ITemplateSource {
  private readonly allowedHosts: ReadonlySet<string>;
  private readonly maxBytes: number;
  private readonly maxFiles: number;

  constructor(config: ConfigService) {
    this.allowedHosts = new Set(
      config
        .getOrThrow<string>('TEMPLATE_GIT_ALLOWED_HOSTS')
        .split(',')
        .map((host) => host.trim().toLowerCase())
        .filter(Boolean),
    );
    this.maxBytes = config.getOrThrow<number>('TEMPLATE_GIT_MAX_BYTES');
    this.maxFiles = config.getOrThrow<number>('TEMPLATE_GIT_MAX_FILES');
  }

  async importTemplate(request: GitTemplateRequest): Promise<ImportedTemplate> {
    const repositoryUrl = this.validateRepositoryUrl(request.repositoryUrl);
    this.validatePinnedRef(request.ref);
    this.validateCredentials(request.credentialEnv);
    const checkout = fs.mkdtempSync(path.join(os.tmpdir(), 'lg-agent-template-'));
    try {
      await execFileAsync(
        'git',
        ['clone', '--no-checkout', '--filter=blob:none', '--no-tags', repositoryUrl, checkout],
        {
          timeout: 60_000,
          env: { ...process.env, ...request.credentialEnv, GIT_TERMINAL_PROMPT: '0' },
          maxBuffer: 1024 * 1024,
        },
      );
      await execFileAsync('git', ['-C', checkout, 'checkout', '--detach', request.ref, '--'], {
        timeout: 30_000,
        env: { ...process.env, ...request.credentialEnv, GIT_TERMINAL_PROMPT: '0' },
      });
      const { stdout: stagedFiles } = await execFileAsync('git', [
        '-C',
        checkout,
        'ls-files',
        '--stage',
      ]);
      if (stagedFiles.split(/\r?\n/).some((line) => line.startsWith('160000 '))) {
        throw new BadRequestException('Template submodules are not allowed.');
      }
      const { stdout } = await execFileAsync('git', ['-C', checkout, 'rev-parse', 'HEAD']);
      const commit = stdout.trim();
      const files = this.readFiles(checkout);
      const manifestFiles = files.map((file) => ({
        path: file.path,
        bytes: Buffer.byteLength(file.content),
        sha256: sha256(file.content),
      }));
      const totalBytes = manifestFiles.reduce((sum, file) => sum + file.bytes, 0);
      const digest = sha256(JSON.stringify({ commit, files: manifestFiles }));
      return {
        files,
        manifest: {
          source: { repositoryUrl, commit },
          files: manifestFiles,
          totalBytes,
          digest,
        },
      };
    } finally {
      fs.rmSync(checkout, { recursive: true, force: true });
    }
  }

  private validateRepositoryUrl(raw: string): string {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new BadRequestException('Template repository URL is invalid.');
    }
    if (url.protocol !== 'https:' || url.username || url.password) {
      throw new BadRequestException('Template repositories require credential-free HTTPS URLs.');
    }
    if (!this.allowedHosts.has(url.hostname.toLowerCase())) {
      throw new BadRequestException(`Template repository host "${url.hostname}" is not allowed.`);
    }
    return url.toString();
  }

  private validatePinnedRef(ref: string): void {
    const isCommit = /^[a-f0-9]{40}$/i.test(ref);
    const isTag = /^refs\/tags\/[A-Za-z0-9._/-]+$/.test(ref);
    if (!isCommit && !isTag) {
      throw new BadRequestException('Template ref must be a full commit SHA or refs/tags/<tag>.');
    }
  }

  private validateCredentials(credentials?: Record<string, string>): void {
    if (!credentials) return;
    const allowed = new Set(['GIT_ASKPASS', 'SSH_ASKPASS']);
    if (Object.keys(credentials).some((key) => !allowed.has(key))) {
      throw new BadRequestException(
        'Only short-lived Git credential helper variables are allowed.',
      );
    }
  }

  private readFiles(root: string) {
    const files: { path: string; content: string }[] = [];
    let totalBytes = 0;
    const visit = (directory: string): void => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.name === '.git') continue;
        const absolute = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) {
          throw new BadRequestException('Template symbolic links are not allowed.');
        }
        if (entry.isDirectory()) {
          visit(absolute);
          continue;
        }
        if (!entry.isFile()) continue;
        const relative = path.relative(root, absolute).replaceAll('\\', '/');
        const buffer = fs.readFileSync(absolute);
        totalBytes += buffer.byteLength;
        if (files.length >= this.maxFiles || totalBytes > this.maxBytes) {
          throw new BadRequestException('Template repository exceeds configured size limits.');
        }
        if (buffer.includes(0)) {
          throw new BadRequestException(`Binary template file "${relative}" is not supported.`);
        }
        files.push({ path: relative, content: buffer.toString('utf8') });
      }
    };
    visit(root);
    return files;
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
