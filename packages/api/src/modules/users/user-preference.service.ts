import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { UserPreferenceDTO } from '@lg-agent/contracts';

@Injectable()
export class UserPreferenceService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(userId: string): Promise<UserPreferenceDTO[]> {
    const prefs = await this.prisma.userPreference.findMany({
      where: { userId },
    });

    return prefs.map((p) => ({ key: p.key, value: p.value }));
  }

  async get(userId: string, key: string): Promise<UserPreferenceDTO | null> {
    const pref = await this.prisma.userPreference.findUnique({
      where: { userId_key: { userId, key } },
    });

    return pref ? { key: pref.key, value: pref.value } : null;
  }

  async set(userId: string, key: string, value: string): Promise<UserPreferenceDTO> {
    const pref = await this.prisma.userPreference.upsert({
      where: { userId_key: { userId, key } },
      update: { value },
      create: { userId, key, value },
    });

    return { key: pref.key, value: pref.value };
  }

  async delete(userId: string, key: string): Promise<void> {
    await this.prisma.userPreference.deleteMany({
      where: { userId, key },
    });
  }
}
