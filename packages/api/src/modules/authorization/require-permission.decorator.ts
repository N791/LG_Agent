import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@lg-agent/contracts';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';

export interface RequiredPermissionsMetadata {
  permissions: readonly Permission[];
  mode: 'ALL' | 'ANY';
}

export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, {
    permissions,
    mode: 'ALL',
  } satisfies RequiredPermissionsMetadata);

export const RequireAnyPermission = (...permissions: Permission[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, {
    permissions,
    mode: 'ANY',
  } satisfies RequiredPermissionsMetadata);

export const RequireAuthenticated = () =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, {
    permissions: [],
    mode: 'ALL',
  } satisfies RequiredPermissionsMetadata);
