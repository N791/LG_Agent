import { Command } from 'commander';
import chalk from 'chalk';

export function registerInitCommand(program: Command) {
  program
    .command('init')
    .description('初始化本地工作区')
    .action(() => {
      console.log(chalk.green('LG Agent CLI 已初始化成功。'));
      // Implementation for Epic 8 (CLI Login & Workspace init) will go here
    });
}
