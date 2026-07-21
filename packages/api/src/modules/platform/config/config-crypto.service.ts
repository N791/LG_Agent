/* eslint-disable */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class ConfigCryptoService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;
  private readonly logger = new Logger(ConfigCryptoService.name);

  constructor(private readonly configService: ConfigService) {
    const rawKey = this.configService.get<string>('CONFIG_ENCRYPTION_KEY');
    if (!rawKey) {
      this.logger.warn(
        'CONFIG_ENCRYPTION_KEY is not set. Falling back to an ephemeral generated key! Encrypted configurations will be lost after restart.',
      );
      this.key = crypto.randomBytes(32);
    } else {
      this.key = crypto.createHash('sha256').update(String(rawKey)).digest();
    }
  }

  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  decrypt(text: string): string {
    try {
      const parts = text.split(':');
      if (parts.length !== 3) throw new Error('Invalid encrypted format');
      const iv = Buffer.from(parts[0] as string, 'hex');
      const authTag = Buffer.from(parts[1] as string, 'hex');
      const encryptedText = Buffer.from(parts[2] as string, 'hex');

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encryptedText).toString('utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (e) {
      this.logger.error('Failed to decrypt system configuration value', e);
      return '';
    }
  }
}
