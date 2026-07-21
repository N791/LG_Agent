import { Command } from 'commander';
import { api } from '../api';
import { LocalWorkspaceProvider } from '../workspace';
import { saveWorkspaceConfig, getWorkspaceConfig } from '../config';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { t } from '../i18n';

export const workspaceCommands = new Command('workspace').description('Workspace and execution');

interface Task {
  id: string;
  courseId: string;
  stage: string | number;
  title: string;
  [key: string]: unknown;
}

interface SandboxResult {
  status: string;
  score: number;
  logs: string;
}

workspaceCommands
  .command('pull <taskId>')
  .description(t('workspace.pull'))
  .option('-d, --dir <dir>', 'Directory to create workspace in (default: current directory)')
  .action(async (taskId: string, options: { dir?: string }) => {
    try {
      console.log(chalk.cyan(t('workspace.pulling', { taskId })));
      const task = await api.get<Task>(`/tasks/${taskId}`);

      const targetDir = options.dir ? path.resolve(process.cwd(), options.dir) : process.cwd();

      const provider = new LocalWorkspaceProvider();
      await provider.createWorkspace(targetDir, task);

      saveWorkspaceConfig(
        {
          taskId: task.id,
          courseId: task.courseId,
          createdAt: new Date().toISOString(),
        },
        targetDir,
      );

      console.log(chalk.green(t('workspace.successPull', { targetDir })));
      console.log(chalk.gray(t('workspace.nextSteps')));
      console.log(chalk.gray(t('workspace.step1')));
      console.log(chalk.gray(t('workspace.step2')));
    } catch (_e) {
      const e = _e as Error;
      console.log(chalk.red(t('workspace.pullFailed', { message: e.message })));
    }
  });

workspaceCommands
  .command('submit')
  .description(t('workspace.submit'))
  .action(async () => {
    try {
      const config = getWorkspaceConfig();
      if (!config) {
        console.log(chalk.red(t('workspace.notInWorkspace')));
        return;
      }

      const indexJsPath = path.join(process.cwd(), 'index.js');
      if (!fs.existsSync(indexJsPath)) {
        console.log(chalk.red(t('workspace.indexNotFound')));
        return;
      }

      const code = fs.readFileSync(indexJsPath, 'utf8');

      console.log(chalk.cyan(t('workspace.submitting', { taskId: config.taskId })));

      const result = await api.post<SandboxResult>('/training/submit', {
        taskId: config.taskId,
        code,
      });

      console.log(chalk.blue.bold(t('workspace.sandboxResult')));
      console.log(
        `${t('workspace.status')}${result.status === 'PASSED' ? chalk.green(t('workspace.passed')) : chalk.red(result.status)}`,
      );
      console.log(`${t('workspace.score')}${String(result.score)}`);
      console.log(t('workspace.logs'));
      console.log(chalk.gray(result.logs));
      console.log(chalk.blue.bold(t('workspace.separator')));
    } catch (_e) {
      const e = _e as Error;
      console.log(chalk.red(t('workspace.submitFailed', { message: e.message })));
    }
  });
