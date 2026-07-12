import { PrismaClient } from '@prisma/client';

export class TestDatabaseHelper {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          // Use test database URL from environment or fallback
          url:
            process.env['TEST_DATABASE_URL'] ??
            'postgresql://postgres:postgres@localhost:5432/lg_agent_test',
        },
      },
    });
  }

  async connect() {
    await this.prisma.$connect();
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }

  get client() {
    return this.prisma;
  }

  async cleanDatabase() {
    // Clean tables in reverse dependency order
    await this.prisma.$transaction([
      this.prisma.llmAuditLog.deleteMany(),
      this.prisma.llmRequestLog.deleteMany(),
      this.prisma.submission.deleteMany(),
      this.prisma.task.deleteMany(),
      this.prisma.course.deleteMany(),
      this.prisma.user.deleteMany(),
      this.prisma.organization.deleteMany(),
    ]);
  }
}
