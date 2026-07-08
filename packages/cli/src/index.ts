#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { registerInitCommand } from './commands/init';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('lg-agent')
  .description(chalk.blue('AI 沉浸式企业入职引擎 CLI 客户端'))
  .version('0.1.0');

// Register commands
registerInitCommand(program);

// Parse arguments
program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
