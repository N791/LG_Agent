import type { Role } from '@prisma/client';

export interface TenantActor {
  id: string;
  organizationId: string;
  role: Role;
}

/**
 * Tenant-owned adapters must include organization scope in the database
 * predicate instead of filtering an unscoped result after loading it.
 */
export interface OrganizationScopedRepository<TEntity, TQuery = unknown> {
  findManyScoped(actor: TenantActor, query?: TQuery): Promise<TEntity[]>;
  findOneScoped(id: string, actor: TenantActor): Promise<TEntity>;
}
