import { Command } from 'commander';
import prompts from 'prompts';
import { api } from '../api';
import { getGlobalConfig, saveGlobalConfig } from '../config';
import chalk from 'chalk';

export const authCommands = new Command('auth').description('Authentication commands');

authCommands
  .command('login')
  .description('Login to LG_Agent')
  .action(async () => {
    const response = (await prompts([
      {
        type: 'text',
        name: 'username',
        message: 'Username:',
      },
      {
        type: 'password',
        name: 'password',
        message: 'Password:',
      },
    ])) as { username?: string; password?: string };

    if (!response.username || !response.password) {
      console.log(chalk.red('Login cancelled.'));
      return;
    }

    try {
      const data = await api.post<{ access_token: string }>('/auth/login', {
        username: response.username,
        password: response.password,
      });

      const config = getGlobalConfig();
      config.token = data.access_token;
      saveGlobalConfig(config);

      console.log(chalk.green('Successfully logged in!'));
    } catch (e: unknown) {
      console.log(chalk.red(`Login failed: ${(e as Error).message}`));
    }
  });

authCommands
  .command('logout')
  .description('Logout and clear token')
  .action(() => {
    const config = getGlobalConfig();
    config.token = undefined;
    saveGlobalConfig(config);
    console.log(chalk.green('Logged out successfully.'));
  });

authCommands
  .command('whoami')
  .description('Check current logged in user')
  .action(() => {
    try {
      // For MVP we just fetch user profile or check token.
      // Wait, we don't have a /auth/me endpoint yet, let's use the courses endpoint to test token validity,
      // or just decode the JWT locally. Let's decode it.
      const config = getGlobalConfig();
      if (!config.token?.includes('.')) {
        console.log(chalk.yellow('Not logged in.'));
        return;
      }
      const payloadBase64 = config.token.split('.')[1];
      if (!payloadBase64) {
        console.log(chalk.red('Invalid token format.'));
        return;
      }
      const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8')) as {
        username: string;
        role: string;
      };
      console.log(chalk.green(`Logged in as: ${payload.username} (${payload.role})`));
    } catch (_e) {
      console.log(chalk.red('Invalid or missing token. Please login again.'));
    }
  });
