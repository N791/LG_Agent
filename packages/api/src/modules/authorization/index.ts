export { AuthorizationModule } from './authorization.module';
export { AuthorizationService } from './authorization.service';
export {
  AuthorizationRegistryService,
  AUTHORIZATION_REGISTRY_MISMATCH_CODE,
  authorizationRegistryDigest,
} from './authorization-registry.service';
export {
  LegacyRoleBridgeService,
  LEGACY_ROLE_BRIDGE_COMPATIBILITY_END,
} from './legacy-role-bridge.service';
export { PermissionGuard } from './permission.guard';
export {
  RequireAuthenticated,
  RequirePermission,
  RequireAnyPermission,
} from './require-permission.decorator';
export type { AuthorizationActor, ResourcePolicy } from './authorization.types';
