import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  PERMISSIONS,
  PERMISSION_REGISTRY_VERSION,
  type MePermissionsDTO,
} from '@lg-agent/contracts';
import {
  PermissionProvider,
  classifyPermissionError,
  usePermissions,
  type PermissionContextValue,
} from '@lg-agent/permission-react';

describe('Epic 81 shared frontend permission session', () => {
  it('fails closed when an API and frontend registry version differ', async () => {
    let observed: PermissionContextValue | undefined;
    render(
      <PermissionProvider
        identityKey="user-a:org-a:token-a"
        loadPermissions={() =>
          Promise.resolve(dto(PERMISSION_REGISTRY_VERSION + 1, [PERMISSIONS.USER_READ]))
        }
      >
        <Probe
          onValue={(value) => {
            observed = value;
          }}
        />
      </PermissionProvider>,
    );

    await waitFor(() => {
      expect(observed?.status).toBe('version-mismatch');
    });
    expect(observed?.can(PERMISSIONS.USER_READ)).toBe(false);
    expect(observed?.permissions.size).toBe(0);
  });

  it('does not let an old identity request overwrite a refreshed token session', async () => {
    const oldRequest = deferred<MePermissionsDTO>();
    const newRequest = deferred<MePermissionsDTO>();
    let observed: PermissionContextValue | undefined;
    const view = render(
      <PermissionProvider identityKey="user-a:org-a:token-old" loadPermissions={oldRequest.load}>
        <Probe
          onValue={(value) => {
            observed = value;
          }}
        />
      </PermissionProvider>,
    );
    view.rerender(
      <PermissionProvider identityKey="user-a:org-b:token-new" loadPermissions={newRequest.load}>
        <Probe
          onValue={(value) => {
            observed = value;
          }}
        />
      </PermissionProvider>,
    );

    await act(() =>
      newRequest.resolve(dto(PERMISSION_REGISTRY_VERSION, [PERMISSIONS.PROFILE_READ])),
    );
    await waitFor(() => {
      expect(observed?.status).toBe('ready');
    });
    await act(() =>
      oldRequest.resolve(dto(PERMISSION_REGISTRY_VERSION, [PERMISSIONS.USER_MANAGE])),
    );

    expect(observed?.can(PERMISSIONS.PROFILE_READ)).toBe(true);
    expect(observed?.can(PERMISSIONS.USER_MANAGE)).toBe(false);
  });

  it.each([
    [{ response: { status: 503 } }, 'service-unavailable'],
    [
      {
        response: {
          status: 503,
          data: { code: 503, errorCode: 'AUTH_REGISTRY_VERSION_MISMATCH' },
        },
      },
      'version-mismatch',
    ],
    [{ response: { status: 403 } }, 'permission-denied'],
  ] as const)(
    'classifies permission endpoint failures without granting access',
    (error, status) => {
      expect(classifyPermissionError(error)).toBe(status);
    },
  );
});

function Probe({ onValue }: { onValue: (value: PermissionContextValue) => void }) {
  onValue(usePermissions());
  return null;
}

function dto(
  registryVersion: number,
  permissions: MePermissionsDTO['permissions'],
): MePermissionsDTO {
  return {
    registryVersion,
    organizationId: 'org-a',
    roles: [],
    permissions,
  };
}

function deferred<T>() {
  let settle: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return {
    load: () => promise,
    resolve: async (value: T) => {
      settle?.(value);
      await promise;
    },
  };
}
