import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  PERMISSION_REGISTRY_VERSION,
  type MePermissionsDTO,
  type Permission,
} from '@lg-agent/contracts';

export type PermissionSessionStatus =
  'loading' | 'ready' | 'service-unavailable' | 'version-mismatch' | 'permission-denied';

export interface PermissionContextValue {
  status: PermissionSessionStatus;
  loading: boolean;
  error: Error | null;
  registryVersion: number | null;
  permissions: ReadonlySet<Permission>;
  roles: MePermissionsDTO['roles'];
  can: (permission: Permission) => boolean;
  canAny: (permissions: readonly Permission[]) => boolean;
  refresh: () => Promise<void>;
}

interface PermissionState {
  identityKey: string;
  status: PermissionSessionStatus;
  error: Error | null;
  data: MePermissionsDTO | null;
}

const PermissionContext = createContext<PermissionContextValue | null>(null);
const EMPTY_PERMISSIONS = new Set<Permission>();
const EMPTY_ROLES: MePermissionsDTO['roles'] = [];

export interface PermissionProviderProps {
  children: ReactNode;
  identityKey: string;
  loadPermissions: () => Promise<MePermissionsDTO>;
  supportedRegistryVersion?: number;
}

export function PermissionProvider({
  children,
  identityKey,
  loadPermissions,
  supportedRegistryVersion = PERMISSION_REGISTRY_VERSION,
}: PermissionProviderProps) {
  const requestSequence = useRef(0);
  const [state, setState] = useState<PermissionState>(() => ({
    identityKey,
    status: 'loading',
    error: null,
    data: null,
  }));

  const refresh = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setState({ identityKey, status: 'loading', error: null, data: null });
    try {
      const data = await loadPermissions();
      if (sequence !== requestSequence.current) return;
      if (data.registryVersion !== supportedRegistryVersion) {
        setState({
          identityKey,
          status: 'version-mismatch',
          error: new PermissionRegistryVersionError(supportedRegistryVersion, data.registryVersion),
          data: null,
        });
        return;
      }
      setState({ identityKey, status: 'ready', error: null, data });
    } catch (cause) {
      if (sequence !== requestSequence.current) return;
      const error = toError(cause);
      setState({
        identityKey,
        status: classifyPermissionError(cause),
        error,
        data: null,
      });
    }
  }, [identityKey, loadPermissions, supportedRegistryVersion]);

  useEffect(() => {
    void refresh();
    return () => {
      requestSequence.current += 1;
    };
  }, [refresh]);

  // Effects run after render. Treat a changed identity as loading immediately so
  // permissions from the previous user/token/organization can never render.
  const activeState: PermissionState =
    state.identityKey === identityKey
      ? state
      : { identityKey, status: 'loading', error: null, data: null };
  const permissions = useMemo(
    () =>
      activeState.status === 'ready' && activeState.data
        ? new Set(activeState.data.permissions)
        : EMPTY_PERMISSIONS,
    [activeState.data, activeState.status],
  );
  const value = useMemo<PermissionContextValue>(
    () => ({
      status: activeState.status,
      loading: activeState.status === 'loading',
      error: activeState.error,
      registryVersion: activeState.data?.registryVersion ?? null,
      permissions,
      roles: activeState.data?.roles ?? EMPTY_ROLES,
      can: (permission) => activeState.status === 'ready' && permissions.has(permission),
      canAny: (required) =>
        activeState.status === 'ready' &&
        required.some((permission) => permissions.has(permission)),
      refresh,
    }),
    [activeState, permissions, refresh],
  );

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

export function usePermissions(): PermissionContextValue {
  const value = useContext(PermissionContext);
  if (!value) throw new Error('usePermissions must be used inside PermissionProvider');
  return value;
}

export interface PermissionGuardProps {
  permission?: Permission;
  anyOf?: readonly Permission[];
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGuard({
  permission,
  anyOf,
  fallback = null,
  children,
}: PermissionGuardProps) {
  const { status, can, canAny } = usePermissions();
  if (status !== 'ready') return <>{fallback}</>;
  const allowed = permission ? can(permission) : anyOf ? canAny(anyOf) : false;
  return allowed ? <>{children}</> : <>{fallback}</>;
}

export interface PermissionRouteMetadata {
  permission?: Permission;
  anyPermissions?: readonly Permission[];
}

export interface PermissionRouteBoundaryProps {
  routeHandles: readonly unknown[];
  children: ReactNode;
  loadingFallback?: ReactNode;
  serviceUnavailableFallback?: ReactNode;
  versionMismatchFallback?: ReactNode;
  sessionDeniedFallback?: ReactNode;
  routeDeniedFallback?: ReactNode;
}

export function PermissionRouteBoundary({
  routeHandles,
  children,
  loadingFallback = null,
  serviceUnavailableFallback = null,
  versionMismatchFallback = null,
  sessionDeniedFallback = null,
  routeDeniedFallback = null,
}: PermissionRouteBoundaryProps) {
  const { status, can, canAny } = usePermissions();
  if (status === 'loading') return <>{loadingFallback}</>;
  if (status === 'service-unavailable') return <>{serviceUnavailableFallback}</>;
  if (status === 'version-mismatch') return <>{versionMismatchFallback}</>;
  if (status === 'permission-denied') return <>{sessionDeniedFallback}</>;

  const required = findPermissionMetadata(routeHandles);
  if (!required) return <>{children}</>;
  const allowed = required.permission
    ? can(required.permission)
    : required.anyPermissions
      ? canAny(required.anyPermissions)
      : false;
  return allowed ? <>{children}</> : <>{routeDeniedFallback}</>;
}

export const PermissionRoute = PermissionGuard;
export const PermissionButton = PermissionGuard;

export function usePermissionMenu<T extends { permission: Permission }>(items: readonly T[]): T[] {
  const { can } = usePermissions();
  return useMemo(() => items.filter((item) => can(item.permission)), [can, items]);
}

export class PermissionRegistryVersionError extends Error {
  readonly code = 'PERMISSION_REGISTRY_VERSION_MISMATCH';

  constructor(
    readonly expectedVersion: number,
    readonly actualVersion: number,
  ) {
    super(
      `Permission registry version ${String(actualVersion)} is not supported (expected ${String(expectedVersion)})`,
    );
    this.name = 'PermissionRegistryVersionError';
  }
}

export function classifyPermissionError(error: unknown): PermissionSessionStatus {
  const candidate = error as
    | {
        status?: number;
        code?: string;
        errorCode?: string;
        response?: { status?: number; data?: { code?: string | number; errorCode?: string } };
      }
    | null
    | undefined;
  const status = candidate?.response?.status ?? candidate?.status;
  const code =
    candidate?.response?.data?.errorCode ??
    (typeof candidate?.response?.data?.code === 'string'
      ? candidate.response.data.code
      : undefined) ??
    candidate?.errorCode ??
    candidate?.code;
  if (
    code === 'AUTH_REGISTRY_VERSION_MISMATCH' ||
    code === 'PERMISSION_REGISTRY_VERSION_MISMATCH'
  ) {
    return 'version-mismatch';
  }
  if (status === 401 || status === 403) return 'permission-denied';
  return 'service-unavailable';
}

export function findPermissionMetadata(
  handles: readonly unknown[],
): PermissionRouteMetadata | null {
  for (let index = handles.length - 1; index >= 0; index -= 1) {
    const metadata = handles[index] as PermissionRouteMetadata | undefined;
    if (metadata?.permission || metadata?.anyPermissions?.length) return metadata;
  }
  return null;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
