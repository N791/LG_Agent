import type { AuthorizationRoleDTO, Permission, PermissionDefinition } from '@lg-agent/contracts';
import type { User } from '../types';
import request from '../utils/request';

export interface PermissionImpact {
  roleId: string;
  memberCount: number;
  added: Permission[];
  removed: Permission[];
  highRisk: boolean;
}

export const authorizationApi = {
  listRoles: () => request.get<unknown, AuthorizationRoleDTO[]>('/authorization/roles'),
  listPermissions: () => request.get<unknown, PermissionDefinition[]>('/authorization/permissions'),
  listUsers: () => request.get<unknown, User[]>('/users'),
  createRole: (data: { name: string; description?: string; permissionKeys?: Permission[] }) =>
    request.post<unknown, AuthorizationRoleDTO>('/authorization/roles', data),
  copyRole: (roleId: string, data: { name: string; description?: string }) =>
    request.post<unknown, AuthorizationRoleDTO>(`/authorization/roles/${roleId}/copy`, data),
  preview: (roleId: string, permissionKeys: Permission[]) =>
    request.post<unknown, PermissionImpact>(`/authorization/roles/${roleId}/impact-preview`, {
      permissionKeys,
    }),
  updatePermissions: (roleId: string, permissionKeys: Permission[], confirmation: string) =>
    request.put(`/authorization/roles/${roleId}/permissions`, {
      permissionKeys,
      confirmation,
    }),
  assignMembers: (roleId: string, userIds: string[], confirmation: string) =>
    request.put(`/authorization/roles/${roleId}/members`, {
      userIds,
      confirmation,
      replace: true,
    }),
};
