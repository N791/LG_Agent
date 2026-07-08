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

// Register nested commands but also flatten some common ones for ease of use
program.addCommand(authCommands);
program.addCommand(courseCommands);
program.addCommand(workspaceCommands);

program.parseAsync(process.argv).catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
