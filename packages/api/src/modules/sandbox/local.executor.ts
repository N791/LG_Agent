import { Injectable, Logger } from '@nestjs/common';
import { ExecutionResult, IExecutor } from './interfaces/executor.interface';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

const execPromise = util.promisify(exec);

@Injectable()
export class LocalExecutor implements IExecutor {
  private readonly logger = new Logger(LocalExecutor.name);

  async execute(
    taskId: string,
    userId: string,
    code: string,
    config: { testScript?: string; env?: { node?: boolean } },
  ): Promise<ExecutionResult> {
    const workspaceId = `ws_${userId}_${taskId}_${Date.now().toString()}`;
    const workspacePath = path.join(process.cwd(), 'temp_workspaces', workspaceId);

    try {
      // 1. Create Workspace
      fs.mkdirSync(workspacePath, { recursive: true });

      // 2. Write User Code
      // As a simple MVP, we assume the code is a single js file
      const mainFile = path.join(workspacePath, 'index.js');
      fs.writeFileSync(mainFile, code);

      // 3. Write Test Code (if any provided in config)
      let testFile = '';
      if (config.testScript) {
        testFile = path.join(workspacePath, 'test.js');
        fs.writeFileSync(testFile, config.testScript);
      }

      // 4. Check for project dependencies and install
      const packageJsonPath = path.join(workspacePath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        this.logger.log(`Found package.json in ${workspaceId}, running npm install...`);
        try {
          await execPromise('npm install', { cwd: workspacePath, timeout: 30000 }); // 30s for npm install
          this.logger.log(`npm install completed in ${workspaceId}`);
        } catch (installErr: unknown) {
          this.logger.warn(
            `npm install failed in ${workspaceId}: ${(installErr as Error).message}`,
          );
          // We can proceed even if it fails, or we could throw. Let's proceed for now.
        }
      }

      // 5. Execute via child_process
      // To simulate isolation, we might just run node index.js or test.js
      let cmd = `node index.js`;
      if (testFile) {
        // E.g. we could run a test runner, or just execute the test file which requires index.js
        cmd = `node test.js`;
      }

      const { stdout, stderr } = await execPromise(cmd, {
        cwd: workspacePath,
        timeout: 5000, // 5 seconds limit for pseudo-sandbox
      });

      this.logger.log(`Execution success in ${workspaceId}`);

      // Clean up workspace
      fs.rmSync(workspacePath, { recursive: true, force: true });

      return {
        passed: true,
        score: 100,
        logs: stdout + (stderr ? `\nErrors:\n${stderr}` : ''),
        report: { message: 'All tests passed' },
      };
    } catch (error: unknown) {
      const execError = error as {
        stdout?: Buffer | string;
        stderr?: Buffer | string;
        message: string;
      };
      this.logger.error(`Execution failed in ${workspaceId}`, execError.message);

      // Clean up workspace even on failure
      if (fs.existsSync(workspacePath)) {
        fs.rmSync(workspacePath, { recursive: true, force: true });
      }

      return {
        passed: false,
        score: 0,
        logs:
          String(execError.stdout ?? '') +
          '\n' +
          String(execError.stderr ?? '') +
          '\n' +
          execError.message,
        report: { error: execError.message },
      };
    }
  }
}
