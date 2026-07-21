import { Command } from 'commander';
import prompts from 'prompts';
import { api } from '../api';
import { getGlobalConfig, saveGlobalConfig } from '../config';
import chalk from 'chalk';
import { t } from '../i18n';

export const authCommands = new Command('auth').description('Authentication commands');

authCommands
  .command('login')
  .description(t('auth.login'))
  .action(async () => {
    const response = (await prompts([
      {
        type: 'text',
        name: 'username',
        message: t('auth.usernamePrompt'),
      },
      {
        type: 'password',
        name: 'password',
        message: t('auth.passwordPrompt'),
      },
    ])) as { username?: string; password?: string };

    if (!response.username || !response.password) {
      console.log(chalk.red(t('auth.loginCancelled')));
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

      console.log(chalk.green(t('auth.loginSuccess')));
    } catch (e: unknown) {
      console.log(chalk.red(t('auth.loginFailed', { message: (e as Error).message })));
    }
  });

authCommands
  .command('logout')
  .description(t('auth.logout'))
  .action(() => {
    const config = getGlobalConfig();
    config.token = undefined;
    saveGlobalConfig(config);
    console.log(chalk.green(t('auth.logoutSuccess')));
  });

authCommands
  .command('whoami')
  .description(t('auth.whoami'))
  .action(() => {
    try {
      // For MVP we just fetch user profile or check token.
      // Wait, we don't have a /auth/me endpoint yet, let's use the courses endpoint to test token validity,
      // or just decode the JWT locally. Let's decode it.
      const config = getGlobalConfig();
      if (!config.token?.includes('.')) {
        console.log(chalk.yellow(t('auth.notLoggedIn')));
        return;
      }
      const payloadBase64 = config.token.split('.')[1];
      if (!payloadBase64) {
        console.log(chalk.red(t('auth.invalidTokenFormat')));
        return;
      }
      const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8')) as {
        username: string;
        role: string;
      };
      console.log(
        chalk.green(t('auth.loggedInAs', { username: payload.username, role: payload.role })),
      );
    } catch (_e) {
      console.log(chalk.red(t('auth.invalidOrMissingToken')));
    }
  });
