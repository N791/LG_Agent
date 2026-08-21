import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const apiDirectory = resolve(scriptDirectory, '..');
const workspaceDirectory = resolve(apiDirectory, '../..');
const envRunner = resolve(scriptDirectory, 'run-with-env.mjs');
const typeScriptCli = resolve(workspaceDirectory, 'node_modules/typescript/bin/tsc');
const contractsTsconfig = resolve(workspaceDirectory, 'packages/contracts/tsconfig.json');

const steps = [
  {
    label: '构建共享权限契约',
    command: process.execPath,
    args: [typeScriptCli, '-p', contractsTsconfig],
  },
  {
    label: '校验环境变量与 Prisma Schema',
    command: process.execPath,
    args: [envRunner, 'prisma', 'validate'],
  },
  {
    label: '生成 Prisma Client',
    command: process.execPath,
    args: [envRunner, 'prisma', 'generate'],
  },
  {
    label: '执行受版本控制的数据库迁移',
    command: process.execPath,
    args: [envRunner, 'prisma', 'migrate', 'deploy'],
  },
  {
    label: '对齐权限注册表与系统角色',
    command: process.execPath,
    args: [envRunner, 'ts-node', 'prisma/reconcile-authorization-registry.ts'],
  },
  {
    label: '确认数据库迁移状态',
    command: process.execPath,
    args: [envRunner, 'prisma', 'migrate', 'status'],
  },
];

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write(
    '用法: pnpm db:init\n\n' +
      '幂等地校验数据库配置、生成 Prisma Client、部署迁移并对齐权限注册表。\n' +
      '该命令不会导入演示数据或创建管理员。\n',
  );
  process.exit(0);
}

for (const [index, step] of steps.entries()) {
  process.stdout.write(`\n[db:init ${index + 1}/${steps.length}] ${step.label}\n`);
  const result = spawnSync(step.command, step.args, {
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) {
    process.stderr.write(`无法启动数据库初始化步骤: ${result.error.message}\n`);
    process.exit(1);
  }
  if (result.status !== 0) {
    if (step.args.includes('deploy')) {
      process.stderr.write(
        '数据库迁移失败。请确认 PostgreSQL 已启动且 DATABASE_URL 可连接，然后重新执行 pnpm db:init。\n',
      );
    } else if (step.args.includes('reconcile-authorization-registry.ts')) {
      process.stderr.write(
        '权限注册表对齐失败；管理员即使验证成功也无法进入管理页面。请修复后重新执行 pnpm db:init。\n',
      );
    }
    process.exit(result.status ?? 1);
  }
}

process.stdout.write('\n数据库初始化完成；pnpm db:init 可安全重复执行。\n');
