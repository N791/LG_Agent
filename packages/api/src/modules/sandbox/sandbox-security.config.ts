import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SandboxRuntimeErrorCode, type RuntimeLanguage } from '@lg-agent/contracts';

export interface SandboxSecurityPolicy {
  image: string;
  images: ReadonlyMap<string, string>;
  enabledLanguages: ReadonlySet<string>;
  allowedImages: ReadonlySet<string>;
  memoryLimit: string;
  cpuLimit: number;
  pidsLimit: number;
  executionTimeoutMs: number;
  userConcurrency: number;
  organizationConcurrency: number;
}

@Injectable()
export class SandboxSecurityConfig {
  readonly policy: SandboxSecurityPolicy;

  constructor(config: ConfigService) {
    const image = config.getOrThrow<string>('SANDBOX_NODE_IMAGE');
    const allowedImages = new Set(
      config
        .getOrThrow<string>('SANDBOX_IMAGE_ALLOWLIST')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    );
    // Validate the default Node profile first so a malformed primary image
    // reports the stable digest/allowlist error before optional profiles load.
    this.assertImageAllowed(image, allowedImages);
    const images = new Map<string, string>([
      ['node:20', image],
      ['java:21', config.getOrThrow<string>('SANDBOX_JAVA_IMAGE')],
      ['python:3.12', config.getOrThrow<string>('SANDBOX_PYTHON_IMAGE')],
      ['go:1.24', config.getOrThrow<string>('SANDBOX_GO_IMAGE')],
      ['rust:1.84', config.getOrThrow<string>('SANDBOX_RUST_IMAGE')],
    ]);
    const enabledLanguages = new Set(
      config
        .getOrThrow<string>('SANDBOX_ENABLED_LANGUAGES')
        .split(',')
        .map((language) => language.trim())
        .filter(Boolean),
    );
    enabledLanguages.forEach((language) => {
      const configuredImage = [...images.entries()].find(([runtime]) =>
        runtime.startsWith(`${language}:`),
      )?.[1];
      if (!configuredImage) {
        throw new Error(`No Sandbox image is configured for enabled language "${language}".`);
      }
      this.assertImageAllowed(configuredImage, allowedImages);
    });
    this.policy = {
      image,
      images,
      enabledLanguages,
      allowedImages,
      memoryLimit: config.getOrThrow<string>('SANDBOX_MEMORY_LIMIT'),
      cpuLimit: config.getOrThrow<number>('SANDBOX_CPU_LIMIT'),
      pidsLimit: config.getOrThrow<number>('SANDBOX_PIDS_LIMIT'),
      executionTimeoutMs: config.getOrThrow<number>('SANDBOX_TIMEOUT_MS'),
      userConcurrency: config.getOrThrow<number>('SANDBOX_USER_CONCURRENCY'),
      organizationConcurrency: config.getOrThrow<number>('SANDBOX_ORG_CONCURRENCY'),
    };
  }

  imageFor(language: RuntimeLanguage, version: string): string {
    const image = this.policy.images.get(`${language}:${version}`);
    if (!image) {
      throw new Error(
        `${SandboxRuntimeErrorCode.IMAGE_MISSING}: No digest-pinned image is configured for ${language}:${version}.`,
      );
    }
    return image;
  }

  isLanguageEnabled(language: RuntimeLanguage): boolean {
    return this.policy.enabledLanguages.has(language);
  }

  private assertImageAllowed(image: string, allowlist: ReadonlySet<string>): void {
    const match = /^(.+)@sha256:([a-f0-9]{64})$/i.exec(image);
    if (!match) {
      throw new Error('Sandbox images must be pinned to a sha256 digest.');
    }
    if (!allowlist.has(match[1] ?? '')) {
      throw new Error(`Sandbox image "${match[1] ?? image}" is not allowlisted.`);
    }
  }
}
