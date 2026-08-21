import { PrismaClient, Prisma, Role, TaskType, TaskDifficulty } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('Demo seed is forbidden in production. Use bootstrap:admin instead.');
  }
  if (process.env['ALLOW_INSECURE_DEMO_SEED'] !== 'true') {
    throw new Error(
      'Demo seed contains fixed training credentials. Set ALLOW_INSECURE_DEMO_SEED=true explicitly.',
    );
  }
  console.log('Starting seed process...');

  // 1. Create Organization
  const org = await prisma.organization.upsert({
    where: { code: 'LG_CORP' },
    update: {},
    create: {
      name: 'LG Corporation',
      code: 'LG_CORP',
    },
  });
  console.log(`Organization created: ${org.name}`);

  // 2. Create Users
  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: passwordHash,
      nickname: 'System Admin',
      email: 'admin@lg.com',
      role: Role.ADMIN,
      organizationId: org.id,
    },
  });

  const mentor = await prisma.user.upsert({
    where: { username: 'mentor' },
    update: {},
    create: {
      username: 'mentor',
      password: passwordHash,
      nickname: 'Tech Lead',
      email: 'mentor@lg.com',
      role: Role.MENTOR,
      organizationId: org.id,
    },
  });

  const trainee = await prisma.user.upsert({
    where: { username: 'trainee' },
    update: {},
    create: {
      username: 'trainee',
      password: passwordHash,
      nickname: 'New Joiner',
      email: 'trainee@lg.com',
      role: Role.TRAINEE,
      organizationId: org.id,
    },
  });
  console.log(`Users created: admin(${admin.id}), mentor(${mentor.id}), trainee(${trainee.id})`);
  for (const user of [admin, mentor, trainee]) {
    const role = await prisma.authorizationRole.findFirstOrThrow({
      where: { key: user.role, organizationId: null, isSystem: true },
      select: { id: true },
    });
    await prisma.userRole.upsert({
      where: {
        userId_roleId_organizationId: {
          userId: user.id,
          roleId: role.id,
          organizationId: org.id,
        },
      },
      create: { userId: user.id, roleId: role.id, organizationId: org.id },
      update: {},
    });
  }

  // 3. Create Course
  const course = await prisma.course.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      organizationId: org.id,
      title: 'Node.js Backend Security',
      description: 'Master backend security concepts with hands-on labs.',
      version: '1.0.0', // Course version is string
      status: 1,
      createdById: admin.id,
    },
  });
  console.log(`Course created: ${course.title}`);

  // 4. Create Task (The Golden Case)
  const goldenCaseDir = path.join(__dirname, 'seeds', 'golden-case');

  if (fs.existsSync(goldenCaseDir)) {
    interface TaskYaml {
      title: string;
      env_config: Record<string, unknown>;
      stage: number;
      task_type: string;
      difficulty: string;
      version: number;
    }
    const taskYaml = yaml.parse(
      fs.readFileSync(path.join(goldenCaseDir, 'task.yaml'), 'utf8'),
    ) as TaskYaml;
    const description = fs.readFileSync(path.join(goldenCaseDir, 'README.md'), 'utf8');

    // Read Sandbox Config (Template Files)
    const packageJsonContent = fs.readFileSync(
      path.join(goldenCaseDir, 'template', 'package.json'),
      'utf8',
    );
    const indexJsContent = fs.readFileSync(
      path.join(goldenCaseDir, 'template', 'index.js'),
      'utf8',
    );
    const testScriptContent = fs.readFileSync(path.join(goldenCaseDir, 'test', 'test.js'), 'utf8');
    const jwtFixtureContent = fs.readFileSync(
      path.join(goldenCaseDir, 'template', 'vendor', 'jsonwebtoken.js'),
      'utf8',
    );

    const templateFiles = [
      { path: 'package.json', content: packageJsonContent, language: 'json', readonly: true },
      { path: 'index.js', content: indexJsContent, language: 'javascript' },
      {
        path: 'test.js',
        content: testScriptContent,
        language: 'javascript',
        readonly: true,
        hidden: true,
      },
      {
        path: 'vendor/jsonwebtoken.js',
        content: jwtFixtureContent,
        language: 'javascript',
        readonly: true,
        hidden: true,
      },
    ].map((file) => ({ ...file, sha256: sha256(file.content) }));
    const contentHash = sha256(
      templateFiles
        .map(({ path: filePath, sha256: digest }) => `${filePath}\0${digest}`)
        .join('\0'),
    );

    const sandboxConfig = {
      starterTemplate: {
        version: `golden-case-v${String(taskYaml.version)}`,
        language: 'node',
        entry: 'index.js',
        files: templateFiles,
        contentHash,
        actions: {
          run: 'required',
          build: 'required',
          lint: 'required',
          test: 'required',
        },
      },
    };

    // Read Test Config
    const testConfig = {
      version: `golden-case-v${String(taskYaml.version)}`,
      entry: 'test.js',
      templateHash: contentHash,
      script: testScriptContent,
    };

    if (!indexJsContent.includes('authMiddleware') || !testScriptContent.includes('./index')) {
      throw new Error('Golden Case template/test contract is inconsistent.');
    }

    const task = await prisma.task.upsert({
      where: { id: '00000000-0000-0000-0000-000000000002' },
      update: {
        title: taskYaml.title,
        description,
        envConfig: taskYaml.env_config as Prisma.InputJsonObject,
        sandboxConfig,
        testConfig,
        promptConfig: {},
      },
      create: {
        id: '00000000-0000-0000-0000-000000000002',
        courseId: course.id,
        title: taskYaml.title,
        summary: '修复企业网关中的严重鉴权漏洞',
        description,
        stage: taskYaml.stage,
        taskType: TaskType[taskYaml.task_type as keyof typeof TaskType],
        difficulty: TaskDifficulty[taskYaml.difficulty as keyof typeof TaskDifficulty],
        version: taskYaml.version,
        envConfig: taskYaml.env_config as Prisma.InputJsonObject,
        sandboxConfig,
        testConfig,
        promptConfig: {},
      },
    });

    // Idempotent retrieval fixtures start in BUILDING and must pass through the
    // normal document/code index state machines before they can be activated.
    const knowledgeSource = await prisma.knowledgeSource.upsert({
      where: {
        organizationId_externalKey: {
          organizationId: org.id,
          externalKey: `golden-case:${task.id}:docs`,
        },
      },
      update: { title: `${task.title} documentation` },
      create: {
        organizationId: org.id,
        externalKey: `golden-case:${task.id}:docs`,
        title: `${task.title} documentation`,
        sourceType: 'GOLDEN_CASE_FIXTURE',
        canonicalUri: `task://${task.id}/README.md`,
        acl: { roles: ['ADMIN', 'MENTOR', 'TRAINEE'] },
      },
    });
    await prisma.documentVersion.upsert({
      where: { sourceId_contentHash: { sourceId: knowledgeSource.id, contentHash } },
      update: {},
      create: {
        organizationId: org.id,
        sourceId: knowledgeSource.id,
        version: taskYaml.version,
        contentHash,
        status: 'BUILDING',
        metadata: {
          active: false,
          taskId: task.id,
          fixtureFiles: ['README.md', 'index.js', 'test.js'],
          keySymbols: ['authMiddleware'],
        },
      },
    });

    const codeRepository = await prisma.codeRepository.upsert({
      where: {
        organizationId_externalKey: {
          organizationId: org.id,
          externalKey: `golden-case:${task.id}:code`,
        },
      },
      update: { name: `${task.title} starter` },
      create: {
        organizationId: org.id,
        externalKey: `golden-case:${task.id}:code`,
        name: `${task.title} starter`,
        canonicalUri: `task://${task.id}/starter`,
        acl: { roles: ['ADMIN', 'MENTOR', 'TRAINEE'] },
      },
    });
    await prisma.repositorySnapshot.upsert({
      where: {
        organizationId_repositoryId_commitSha: {
          organizationId: org.id,
          repositoryId: `golden-case:${task.id}`,
          commitSha: contentHash,
        },
      },
      update: {},
      create: {
        organizationId: org.id,
        repositoryId: `golden-case:${task.id}`,
        codeRepositoryId: codeRepository.id,
        commitSha: contentHash,
        status: 'BUILDING',
        acl: { roles: ['ADMIN', 'MENTOR', 'TRAINEE'] },
        metadata: {
          active: false,
          taskId: task.id,
          fixtureFiles: ['index.js', 'test.js'],
          keySymbols: ['authMiddleware'],
        },
      },
    });
    console.log(`Golden Case Task created: ${task.title}`);
  } else {
    console.warn(`Golden case directory not found at ${goldenCaseDir}. Skipping...`);
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
