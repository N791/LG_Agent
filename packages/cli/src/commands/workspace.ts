import { Command } from 'commander';
import { api } from '../api';
import { LocalWorkspaceProvider } from '../workspace';
import { saveWorkspaceConfig, getWorkspaceConfig } from '../config';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

export const workspaceCommands = new Command('workspace').description('Workspace and execution');

workspaceCommands
  .command('pull <taskId>')
  .description('Pull a task and create a local workspace')
  .option('-d, --dir <dir>', 'Directory to create workspace in (default: current directory)')
  .action(async (taskId: string, options) => {
    try {
      console.log(chalk.cyan(`Fetching task [${taskId}]...`));
      const task = await api.get(`/tasks/${taskId}`);
      
      const targetDir = options.dir ? path.resolve(process.cwd(), options.dir) : process.cwd();
      
      const provider = new LocalWorkspaceProvider();
      await provider.createWorkspace(targetDir, task);

      saveWorkspaceConfig({
        taskId: task.id,
        courseId: task.courseId,
        createdAt: new Date().toISOString()
      }, targetDir);

      console.log(chalk.green(`\nSuccess! Workspace ready at ${targetDir}`));
      console.log(chalk.gray(`Next steps:`));
      console.log(chalk.gray(`  1. Write your code in index.js`));
      console.log(chalk.gray(`  2. Run 'lg-agent workspace submit' to test it in the sandbox`));

    } catch (e: any) {
      console.log(chalk.red(`Failed to pull task: ${e.message}`));
    }
  });

workspaceCommands
  .command('submit')
  .description('Submit current workspace code to Sandbox for testing')
  .action(async () => {
    try {
      const config = getWorkspaceConfig();
      if (!config) {
        console.log(chalk.red('Error: Not in a valid LG_Agent workspace. Missing .lg-agent-workspace.json'));
        return;
      }

      const indexJsPath = path.join(process.cwd(), 'index.js');
      if (!fs.existsSync(indexJsPath)) {
        console.log(chalk.red('Error: index.js not found in current directory.'));
        return;
      }

      const code = fs.readFileSync(indexJsPath, 'utf8');

      console.log(chalk.cyan(`Submitting task [${config.taskId}] to Sandbox Engine...`));
      
      const result = await api.post('/training/submit', {
        taskId: config.taskId,
        code
      });

      console.log(chalk.blue.bold('\n--- Sandbox Execution Result ---'));
      console.log(`Status: ${result.status === 'PASSED' ? chalk.green('PASSED') : chalk.red(result.status)}`);
      console.log(`Score: ${result.score}`);
      console.log('\nLogs:');
      console.log(chalk.gray(result.logs));
      console.log(chalk.blue.bold('--------------------------------\n'));

    } catch (e: any) {
      console.log(chalk.red(`Failed to submit code: ${e.message}`));
    }
  });
