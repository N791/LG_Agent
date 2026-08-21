import type { RuntimeCommandDTO, RuntimeLanguage, SandboxAction } from '@lg-agent/contracts';
import type { IRuntimeProfile } from './interfaces/runtime-profile.interface';

abstract class RuntimeProfile implements IRuntimeProfile {
  abstract readonly language: RuntimeLanguage;
  abstract readonly runtime: string;
  abstract readonly versions: readonly string[];
  abstract readonly allowedExecutables: readonly string[];
  abstract readonly defaultVersion: string;
  abstract readonly defaultEntry: string;
  abstract command(action: SandboxAction, entryPoint: string): RuntimeCommandDTO;
}

export class JavaRuntimeProfile extends RuntimeProfile {
  readonly language = 'java' as const;
  readonly runtime = 'jdk';
  readonly versions = ['21'] as const;
  readonly allowedExecutables = ['java', 'javac', 'mvn', 'gradle'] as const;
  readonly defaultVersion = '21';
  readonly defaultEntry = 'Main.java';

  command(action: SandboxAction, entry: string): RuntimeCommandDTO {
    if (action === 'build') return { executable: 'mvn', args: ['-B', '-DskipTests', 'package'] };
    if (action === 'lint') return { executable: 'mvn', args: ['-B', 'checkstyle:check'] };
    if (action === 'test') return { executable: 'mvn', args: ['-B', 'test'] };
    const className = entry.replace(/\.java$/, '').replaceAll('/', '.');
    return entry.endsWith('.java')
      ? { executable: 'java', args: [entry] }
      : { executable: 'java', args: ['-cp', 'target/classes', className] };
  }
}

export class PythonRuntimeProfile extends RuntimeProfile {
  readonly language = 'python' as const;
  readonly runtime = 'python';
  readonly versions = ['3.12'] as const;
  readonly allowedExecutables = ['python', 'pip', 'uv', 'ruff', 'pytest'] as const;
  readonly defaultVersion = '3.12';
  readonly defaultEntry = 'main.py';

  command(action: SandboxAction, entry: string): RuntimeCommandDTO {
    if (action === 'build') return { executable: 'python', args: ['-m', 'compileall', '-q', '.'] };
    if (action === 'lint') return { executable: 'ruff', args: ['check', '.'] };
    if (action === 'test') return { executable: 'pytest', args: ['-q'] };
    return { executable: 'python', args: [entry] };
  }
}

export class GoRuntimeProfile extends RuntimeProfile {
  readonly language = 'go' as const;
  readonly runtime = 'go';
  readonly versions = ['1.24'] as const;
  readonly allowedExecutables = ['go', 'gofmt', 'golangci-lint'] as const;
  readonly defaultVersion = '1.24';
  readonly defaultEntry = '.';

  command(action: SandboxAction, entry: string): RuntimeCommandDTO {
    if (action === 'build') return { executable: 'go', args: ['build', './...'] };
    if (action === 'lint') return { executable: 'gofmt', args: ['-l', '.'] };
    if (action === 'test') return { executable: 'go', args: ['test', './...'] };
    return { executable: 'go', args: ['run', entry] };
  }
}

export class RustRuntimeProfile extends RuntimeProfile {
  readonly language = 'rust' as const;
  readonly runtime = 'rust';
  readonly versions = ['1.84'] as const;
  readonly allowedExecutables = ['cargo', 'rustc', 'rustfmt'] as const;
  readonly defaultVersion = '1.84';
  readonly defaultEntry = 'src/main.rs';

  command(action: SandboxAction): RuntimeCommandDTO {
    if (action === 'build') return { executable: 'cargo', args: ['build', '--locked'] };
    if (action === 'lint')
      return { executable: 'cargo', args: ['clippy', '--locked', '--', '-D', 'warnings'] };
    if (action === 'test') return { executable: 'cargo', args: ['test', '--locked'] };
    return { executable: 'cargo', args: ['run', '--locked'] };
  }
}
