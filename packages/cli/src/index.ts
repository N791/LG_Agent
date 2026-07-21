#!/usr/bin/env node

import { Command } from 'commander';
import { authCommands } from './commands/auth';
import { courseCommands } from './commands/course';
import { workspaceCommands } from './commands/workspace';

const program = new Command();

program
  .name('lg-agent')
  .description('AI Immersive Onboarding Engine - CLI Client')
  .version('0.1.0');

import { initI18n } from './i18n';

// Register nested commands but also flatten some common ones for ease of use
program.addCommand(authCommands);
program.addCommand(courseCommands);
program.addCommand(workspaceCommands);

const bootstrap = async () => {
  await initI18n();
  program.parseAsync(process.argv).catch((err: unknown) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
};

bootstrap().catch((err: unknown) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
