import type { Permission } from '@lg-agent/contracts';
import type { Role } from '@prisma/client';

export interface AuthorizationActor {
  id: string;
  organizationId: string;
  role: Role;
  username?: string;
}

export interface ResolvedAuthorization {
  roles: { id: string; key: string; name: string }[];
  permissions: ReadonlySet<Permission>;
}

export interface ResourcePolicy<TContext = unknown> {
  authorize(actor: AuthorizationActor, context: TContext): Promise<boolean>;
}
