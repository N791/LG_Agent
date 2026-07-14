import { PrismaClient, Prisma, Role, TaskType, TaskDifficulty } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
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

    const sandboxConfig = {
      template: [
        { path: 'package.json', content: packageJsonContent },
        { path: 'index.js', content: indexJsContent },
      ],
    };

    // Read Test Config
    const testScriptContent = fs.readFileSync(path.join(goldenCaseDir, 'test', 'test.js'), 'utf8');
    const testConfig = {
      script: testScriptContent,
    };

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
