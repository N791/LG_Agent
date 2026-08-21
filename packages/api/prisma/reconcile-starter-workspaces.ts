import { createHash, randomUUID } from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { resolveStarterTemplate, type StarterTemplateFileDTO } from '@lg-agent/contracts';

const prisma = new PrismaClient();
const GOLDEN_TASK_ID = '00000000-0000-0000-0000-000000000002';
const KNOWN_PLACEHOLDERS = new Set([
  digestFiles([{ path: 'index.ts', content: 'var message = "Hello World"; console.log(message)' }]),
  digestFiles([
    { path: 'index.ts', content: 'var message = "Hello World"; console.log(message)\n' },
  ]),
  digestFiles([
    { path: 'index.ts', content: 'var message = "Hello World";\nconsole.log(message);' },
  ]),
  digestFiles([
    { path: 'index.ts', content: 'var message = "Hello World";\nconsole.log(message);\n' },
  ]),
]);

interface Candidate {
  workspaceId: string;
  taskId: string;
  userId: string;
  organizationId: string;
  affected: boolean;
  reason: string;
  oldHash: string;
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const apply = args.has('--confirm');
  const taskId = argumentValue('--task-id') ?? GOLDEN_TASK_ID;
  const actorId = argumentValue('--actor-id');
  if (apply && !actorId) throw new Error('--actor-id is required with --confirm.');

  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  const resolved = resolveStarterTemplate(task.sandboxConfig, task.envConfig);
  const template = resolved.template;
  if (resolved.source !== 'canonical' || !template?.contentHash) {
    throw new Error('Task has no canonical starterTemplate/contentHash; reconciliation refused.');
  }

  const workspaces = await prisma.workspace.findMany({
    where: { taskId },
    include: {
      files: true,
      versions: { select: { id: true }, take: 1 },
      user: { select: { organizationId: true } },
    },
  });
  const submissionUsers = new Set(
    (
      await prisma.submission.findMany({
        where: { taskId },
        select: { userId: true },
      })
    ).map((submission) => submission.userId),
  );

  const candidates = workspaces.map((workspace): Candidate => {
    const oldHash = digestFiles(workspace.files);
    if (workspace.versions.length > 0) {
      return candidate(workspace, false, 'has-workspace-version', oldHash);
    }
    if (submissionUsers.has(workspace.userId)) {
      return candidate(workspace, false, 'has-submission', oldHash);
    }
    if (!KNOWN_PLACEHOLDERS.has(oldHash)) {
      return candidate(workspace, false, 'unknown-or-user-modified-content', oldHash);
    }
    return candidate(workspace, true, 'known-placeholder-without-user-history', oldHash);
  });

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        taskId,
        templateHash: template.contentHash,
        affected: candidates.filter((item) => item.affected).length,
        skipped: candidates.filter((item) => !item.affected).length,
        workspaces: candidates,
      },
      null,
      2,
    ),
  );

  if (!apply) return;
  if (!actorId) throw new Error('--actor-id is required with --confirm.');
  const actor = await prisma.user.findUnique({ where: { id: actorId } });
  if (!actor) throw new Error(`Actor ${actorId} does not exist.`);

  for (const item of candidates.filter((candidateItem) => candidateItem.affected)) {
    const requestId = randomUUID();
    await prisma.$transaction(async (tx) => {
      const current = await tx.workspace.findUniqueOrThrow({
        where: { id: item.workspaceId },
        include: { files: true, versions: { orderBy: { version: 'desc' }, take: 1 } },
      });
      const currentHash = digestFiles(current.files);
      if (currentHash !== item.oldHash || !KNOWN_PLACEHOLDERS.has(currentHash)) {
        throw new Error(`Workspace ${item.workspaceId} changed after preview; aborting.`);
      }
      const snapshot = current.files.map(
        ({ path, content, language, encoding, readonly, hidden }) => ({
          path,
          content,
          language,
          encoding,
          readonly,
          hidden,
        }),
      ) as Prisma.InputJsonValue;
      await tx.workspaceVersion.create({
        data: {
          workspaceId: current.id,
          version: (current.versions[0]?.version ?? 0) + 1,
          trigger: 'RECONCILE',
          snapshot,
        },
      });
      await tx.workspaceFile.deleteMany({ where: { workspaceId: current.id } });
      await tx.workspaceFile.createMany({
        data: template.files.map((file) => ({
          workspaceId: current.id,
          path: file.path,
          content: file.content,
          language: file.language,
          encoding: file.encoding,
          readonly: file.readonly ?? false,
          hidden: file.hidden ?? false,
        })),
      });
      await tx.auditEvent.create({
        data: {
          action: 'workspace.starter-template.reconciled',
          actorId: actor.id,
          organizationId: item.organizationId,
          resourceId: current.id,
          requestId,
          before: { taskId, workspaceId: current.id, hash: currentHash },
          after: { taskId, workspaceId: current.id, hash: template.contentHash },
          metadata: { templateVersion: template.version, reason: item.reason },
        },
      });
    });
  }
}

function candidate(
  workspace: { id: string; taskId: string; userId: string; user: { organizationId: string } },
  affected: boolean,
  reason: string,
  oldHash: string,
): Candidate {
  return {
    workspaceId: workspace.id,
    taskId: workspace.taskId,
    userId: workspace.userId,
    organizationId: workspace.user.organizationId,
    affected,
    reason,
    oldHash,
  };
}

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function digestFiles(files: Pick<StarterTemplateFileDTO, 'path' | 'content'>[]): string {
  const canonical = [...files]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((file) => `${file.path}\0${file.content}`)
    .join('\0');
  return createHash('sha256').update(canonical).digest('hex');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
