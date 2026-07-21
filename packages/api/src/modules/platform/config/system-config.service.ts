/* eslint-disable */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { ConfigCryptoService } from './config-crypto.service';

@Injectable()
export class SystemConfigService {
  private readonly logger = new Logger(SystemConfigService.name);
  private cache = new Map<string, string>();
  private cacheTtl = new Map<string, number>();
  private readonly TTL_MS = 10 * 60 * 1000; // 10 minutes cache fallback

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: ConfigCryptoService,
  ) {}

  async get(key: string): Promise<string | undefined> {
    const now = Date.now();
    if (this.cache.has(key) && (this.cacheTtl.get(key) || 0) > now) {
      return this.cache.get(key);
    }

    try {
      const record = await (this.prisma as any).systemConfig.findUnique({ where: { key } });
      if (!record) return undefined;

      const value = record.isEncrypted ? this.crypto.decrypt(record.value) : record.value;

      this.cache.set(key, value);
      this.cacheTtl.set(key, now + this.TTL_MS);
      return value;
    } catch (e) {
      this.logger.error(`Failed to fetch system config for key ${key}`, e);
      return undefined;
    }
  }

  async set(key: string, value: string, isSecret: boolean = false): Promise<void> {
    const finalValue = isSecret ? this.crypto.encrypt(value) : value;
    try {
      await (this.prisma as any).systemConfig.upsert({
        where: { key },
        update: { value: finalValue, isEncrypted: isSecret },
        create: { key, value: finalValue, isEncrypted: isSecret },
      });
      // Invalidate cache immediately on set
      this.cache.set(key, value);
      this.cacheTtl.set(key, Date.now() + this.TTL_MS);
      this.logger.log(`Updated system config: ${key}`);
    } catch (e) {
      this.logger.error(`Failed to update system config for key ${key}`, e);
      throw e;
    }
  }

  invalidate(key: string) {
    this.cache.delete(key);
    this.cacheTtl.delete(key);
  }
}
