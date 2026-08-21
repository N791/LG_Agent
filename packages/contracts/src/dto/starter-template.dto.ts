import type { RuntimeLanguage, SandboxAction } from './sandbox.dto';

export type TaskActionRequirement = 'required' | 'optional' | 'unsupported';

export interface StarterTemplateFileDTO {
  path: string;
  content: string;
  language?: string;
  encoding?: string;
  readonly?: boolean;
  hidden?: boolean;
  sha256?: string;
}

/** Canonical task starter template persisted in sandboxConfig.starterTemplate. */
export interface StarterTemplateDTO {
  version: string;
  language: RuntimeLanguage;
  entry: string;
  files: StarterTemplateFileDTO[];
  contentHash: string;
  actions: Record<SandboxAction, TaskActionRequirement>;
}

export interface StarterTemplateConfigDTO {
  starterTemplate?: StarterTemplateDTO;
  /** @deprecated Read-only compatibility field. Write starterTemplate instead. */
  template?: StarterTemplateFileDTO[];
}

export interface LegacyEnvironmentFilesDTO {
  /** @deprecated Read-only compatibility field. Write sandboxConfig.starterTemplate instead. */
  files?: StarterTemplateFileDTO[];
}

export type StarterTemplateSource = 'canonical' | 'sandbox-template' | 'env-files' | 'none';

export interface ResolvedStarterTemplateDTO {
  source: StarterTemplateSource;
  template: StarterTemplateDTO | null;
}

const DEFAULT_ACTIONS: Record<SandboxAction, TaskActionRequirement> = {
  run: 'required',
  build: 'unsupported',
  lint: 'unsupported',
  test: 'unsupported',
};

/**
 * Compatibility reader shared by API, Git import adapters and web clients.
 * Legacy fields never win over the canonical starterTemplate field.
 */
export function resolveStarterTemplate(
  sandboxConfig: unknown,
  envConfig: unknown,
): ResolvedStarterTemplateDTO {
  const sandbox = asRecord(sandboxConfig);
  const environment = asRecord(envConfig);
  const canonical = sandbox.starterTemplate;
  if (isStarterTemplate(canonical)) {
    return { source: 'canonical', template: canonical };
  }

  const sandboxFiles = asFiles(sandbox.template);
  if (sandboxFiles) {
    return {
      source: 'sandbox-template',
      template: legacyTemplate(sandboxFiles, environment),
    };
  }

  const envFiles = asFiles(environment.files);
  if (envFiles) {
    return { source: 'env-files', template: legacyTemplate(envFiles, environment) };
  }

  return { source: 'none', template: null };
}

function legacyTemplate(
  files: StarterTemplateFileDTO[],
  environment: Record<string, unknown>,
): StarterTemplateDTO {
  const runtime = asRecord(environment.runtime);
  const configuredEntry = typeof runtime.entry === 'string' ? runtime.entry : undefined;
  const entry =
    configuredEntry ??
    files.find((file) => /(^|\/)index\.(?:js|mjs|cjs|ts|mts|cts)$/.test(file.path))?.path ??
    files[0].path;
  const language = isRuntimeLanguage(runtime.language) ? runtime.language : 'node';
  return {
    version: 'legacy',
    language,
    entry,
    files,
    contentHash: '',
    actions: { ...DEFAULT_ACTIONS },
  };
}

function isStarterTemplate(value: unknown): value is StarterTemplateDTO {
  const record = asRecord(value);
  return (
    typeof record.version === 'string' &&
    typeof record.entry === 'string' &&
    typeof record.contentHash === 'string' &&
    isRuntimeLanguage(record.language) &&
    asFiles(record.files) !== null &&
    isActionRequirements(record.actions)
  );
}

function isActionRequirements(value: unknown): value is StarterTemplateDTO['actions'] {
  const record = asRecord(value);
  return (['run', 'build', 'lint', 'test'] as const).every((action) =>
    ['required', 'optional', 'unsupported'].includes(String(record[action])),
  );
}

function asFiles(value: unknown): StarterTemplateFileDTO[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (
    !value.every(
      (file) =>
        typeof file === 'object' &&
        file !== null &&
        typeof (file as Record<string, unknown>).path === 'string' &&
        typeof (file as Record<string, unknown>).content === 'string',
    )
  ) {
    return null;
  }
  return value as StarterTemplateFileDTO[];
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isRuntimeLanguage(value: unknown): value is RuntimeLanguage {
  return ['node', 'java', 'python', 'go', 'rust'].includes(String(value));
}
