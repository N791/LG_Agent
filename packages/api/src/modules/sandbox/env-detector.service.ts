import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import * as util from 'util';

const execPromise = util.promisify(exec);

export interface EnvRequirement {
  node?: boolean | string;
  java?: boolean | string;
  python?: boolean | string;
  docker?: boolean | string;
  git?: boolean | string;
}

@Injectable()
export class EnvDetectorService {
  private readonly logger = new Logger(EnvDetectorService.name);

  async checkEnvironment(
    envConfig: EnvRequirement | null,
  ): Promise<{ passed: boolean; message?: string }> {
    if (!envConfig) {
      return { passed: true };
    }

    try {
      if (envConfig.node) {
        await this.checkCommand('node -v', 'Node.js');
      }
      if (envConfig.java) {
        await this.checkCommand('java -version', 'Java');
      }
      if (envConfig.python) {
        try {
          await this.checkCommand('python3 --version', 'Python3');
        } catch (_e) {
          await this.checkCommand('python --version', 'Python');
        }
      }
      if (envConfig.docker) {
        await this.checkCommand('docker info', 'Docker');
      }
      if (envConfig.git) {
        await this.checkCommand('git --version', 'Git');
      }
    } catch (e: unknown) {
      return { passed: false, message: (e as Error).message };
    }

    return { passed: true };
  }

  private async checkCommand(command: string, name: string): Promise<void> {
    try {
      await execPromise(command, { timeout: 3000 });
      this.logger.debug(`[EnvDetector] ${name} is available.`);
    } catch (_error) {
      this.logger.error(`[EnvDetector] ${name} is missing or command failed: ${command}`);
      throw new Error(
        `${name} is required but not found or accessible in the host environment. Please install ${name}.`,
      );
    }
  }
}
