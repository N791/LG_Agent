import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type {
  CreateMobileHandoffRequestDTO,
  MobileDeviceRegistrationDTO,
  MobileDeviceRegistrationRequestDTO,
  MobileHandoffDTO,
} from '@lg-agent/contracts';
import type { TenantActor } from '../../common/tenant/organization-scoped.repository';

interface DeviceRecord {
  id: string;
  actorId: string;
  organizationId: string;
  installationId: string;
  pushTokenHash: string;
  appVersion: string;
  locale: string;
  idempotencyKey: string;
  registeredAt: string;
}

interface HandoffRecord extends MobileHandoffDTO {
  actorId: string;
  organizationId: string;
  idempotencyKey: string;
  consumedAt?: string;
}

type DeviceRegistrationInput = Omit<MobileDeviceRegistrationRequestDTO, 'platform'> & {
  platform: string;
};

@Injectable()
export class MobileSessionService {
  private readonly devices = new Map<string, DeviceRecord>();
  private readonly handoffs = new Map<string, HandoffRecord>();

  registerDevice(actor: TenantActor, input: DeviceRegistrationInput): MobileDeviceRegistrationDTO {
    if (
      !input.installationId ||
      !input.pushToken ||
      !input.appVersion ||
      !input.locale ||
      !input.idempotencyKey ||
      input.platform !== 'ANDROID'
    ) {
      throw new BadRequestException('Invalid device registration');
    }
    const key = this.deviceKey(actor, input.installationId);
    const existing = this.devices.get(key);
    if (existing?.idempotencyKey === input.idempotencyKey) {
      return { deviceId: existing.id, registeredAt: existing.registeredAt, duplicate: true };
    }
    const record: DeviceRecord = {
      id: existing?.id ?? randomUUID(),
      actorId: actor.id,
      organizationId: actor.organizationId,
      installationId: input.installationId,
      pushTokenHash: createHash('sha256').update(input.pushToken).digest('hex'),
      appVersion: input.appVersion,
      locale: input.locale,
      idempotencyKey: input.idempotencyKey,
      registeredAt: new Date().toISOString(),
    };
    this.devices.set(key, record);
    return { deviceId: record.id, registeredAt: record.registeredAt, duplicate: false };
  }

  revokeDevice(actor: TenantActor, deviceId: string): void {
    const entry = [...this.devices.entries()].find(
      ([, device]) =>
        device.id === deviceId &&
        device.actorId === actor.id &&
        device.organizationId === actor.organizationId,
    );
    if (!entry) throw new NotFoundException('Device registration was not found');
    this.devices.delete(entry[0]);
  }

  createHandoff(actor: TenantActor, input: CreateMobileHandoffRequestDTO): MobileHandoffDTO {
    if (
      !['TASK', 'WORKSPACE', 'SUBMISSION'].includes(input.targetType) ||
      !input.targetId ||
      !input.idempotencyKey
    ) {
      throw new BadRequestException('Invalid handoff request');
    }
    const duplicate = [...this.handoffs.values()].find(
      (handoff) =>
        handoff.actorId === actor.id &&
        handoff.organizationId === actor.organizationId &&
        handoff.idempotencyKey === input.idempotencyKey &&
        !handoff.duplicate &&
        !handoff.consumedAt &&
        new Date(handoff.expiresAt).getTime() > Date.now(),
    );
    if (duplicate) {
      if (duplicate.targetType !== input.targetType || duplicate.targetId !== input.targetId) {
        throw new BadRequestException('Idempotency key was already used for another target');
      }
      return { ...this.publicHandoff(duplicate), duplicate: true };
    }
    const token = randomBytes(32).toString('base64url');
    const record: HandoffRecord = {
      handoffId: randomUUID(),
      token,
      targetType: input.targetType,
      targetId: input.targetId,
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      duplicate: false,
      actorId: actor.id,
      organizationId: actor.organizationId,
      idempotencyKey: input.idempotencyKey,
    };
    this.handoffs.set(this.tokenHash(token), record);
    return this.publicHandoff(record);
  }

  consumeHandoff(actor: TenantActor, token: string): MobileHandoffDTO {
    const record = this.handoffs.get(this.tokenHash(token));
    if (!record) throw new NotFoundException('Handoff was not found');
    if (record.actorId !== actor.id || record.organizationId !== actor.organizationId) {
      throw new ForbiddenException('Handoff belongs to another actor');
    }
    if (record.consumedAt) throw new BadRequestException('Handoff has already been consumed');
    if (new Date(record.expiresAt).getTime() <= Date.now()) {
      throw new BadRequestException('Handoff has expired');
    }
    record.consumedAt = new Date().toISOString();
    return this.publicHandoff(record);
  }

  private publicHandoff(record: HandoffRecord): MobileHandoffDTO {
    return {
      handoffId: record.handoffId,
      token: record.token,
      targetType: record.targetType,
      targetId: record.targetId,
      expiresAt: record.expiresAt,
      duplicate: record.duplicate,
    };
  }

  private deviceKey(actor: TenantActor, installationId: string): string {
    return `${actor.organizationId}:${actor.id}:${installationId}`;
  }

  private tokenHash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
