export const PERMISSION_REGISTRY_VERSION = 1 as const;

export const PERMISSION_SCOPES = ['PLATFORM', 'ORGANIZATION'] as const;
export type PermissionScope = (typeof PERMISSION_SCOPES)[number];

export const PERMISSIONS = {
  PROFILE_READ: 'profile:read',
  PROFILE_UPDATE: 'profile:update',
  NOTIFICATION_READ: 'notification:read',
  NOTIFICATION_UPDATE: 'notification:update',
  ACHIEVEMENT_READ: 'achievement:read',
  ORGANIZATION_READ: 'organization:read',
  ORGANIZATION_MANAGE: 'organization:manage',
  PLATFORM_ORGANIZATION_MANAGE: 'platform-organization:manage',
  USER_READ: 'user:read',
  USER_MANAGE: 'user:manage',
  ROLE_READ: 'role:read',
  ROLE_MANAGE: 'role:manage',
  COURSE_READ: 'course:read',
  COURSE_MANAGE: 'course:manage',
  TASK_READ: 'task:read',
  TASK_MANAGE: 'task:manage',
  TRAINING_READ: 'training:read',
  WORKSPACE_USE: 'workspace:use',
  SUBMISSION_READ: 'submission:read',
  SUBMISSION_CREATE: 'submission:create',
  SUBMISSION_MANAGE: 'submission:manage',
  DISCUSSION_READ: 'discussion:read',
  DISCUSSION_CREATE: 'discussion:create',
  DISCUSSION_MANAGE: 'discussion:manage',
  ANALYTICS_READ: 'analytics:read',
  OBSERVABILITY_READ: 'observability:read',
  AI_TUTOR_USE: 'ai-tutor:use',
  AI_TASK_GENERATE: 'ai-task:generate',
  AI_RETRIEVAL_READ: 'ai-retrieval:read',
  AI_RETRIEVAL_MANAGE: 'ai-retrieval:manage',
  KNOWLEDGE_READ: 'knowledge:read',
  KNOWLEDGE_MANAGE: 'knowledge:manage',
  SANDBOX_EXECUTE: 'sandbox:execute',
  SYSTEM_CONFIG_READ: 'system-config:read',
  SYSTEM_CONFIG_MANAGE: 'system-config:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export interface PermissionDefinition {
  key: Permission;
  scope: PermissionScope;
  version: number;
  description: string;
  risk: 'LOW' | 'HIGH';
  replacement?: Permission;
}

const organization = (
  key: Permission,
  description: string,
  risk: PermissionDefinition['risk'] = 'LOW',
): PermissionDefinition => ({
  key,
  scope: 'ORGANIZATION',
  version: PERMISSION_REGISTRY_VERSION,
  description,
  risk,
});

export const PERMISSION_REGISTRY: readonly PermissionDefinition[] = [
  organization(PERMISSIONS.PROFILE_READ, 'Read the current user profile.'),
  organization(PERMISSIONS.PROFILE_UPDATE, 'Update the current user profile.', 'HIGH'),
  organization(PERMISSIONS.NOTIFICATION_READ, 'Read personal notifications.'),
  organization(PERMISSIONS.NOTIFICATION_UPDATE, 'Update personal notifications.'),
  organization(PERMISSIONS.ACHIEVEMENT_READ, 'Read personal achievements.'),
  organization(PERMISSIONS.ORGANIZATION_READ, 'Read the current organization.'),
  organization(PERMISSIONS.ORGANIZATION_MANAGE, 'Update the current organization.', 'HIGH'),
  {
    key: PERMISSIONS.PLATFORM_ORGANIZATION_MANAGE,
    scope: 'PLATFORM',
    version: PERMISSION_REGISTRY_VERSION,
    description: 'Create, list and remove organizations across the platform.',
    risk: 'HIGH',
  },
  organization(PERMISSIONS.USER_READ, 'Read organization members.'),
  organization(PERMISSIONS.USER_MANAGE, 'Create and update organization members.', 'HIGH'),
  organization(PERMISSIONS.ROLE_READ, 'Read roles and assignments.'),
  organization(PERMISSIONS.ROLE_MANAGE, 'Manage roles, permissions and assignments.', 'HIGH'),
  organization(PERMISSIONS.COURSE_READ, 'Read organization courses.'),
  organization(PERMISSIONS.COURSE_MANAGE, 'Create and update organization courses.', 'HIGH'),
  organization(PERMISSIONS.TASK_READ, 'Read organization tasks.'),
  organization(PERMISSIONS.TASK_MANAGE, 'Create and update organization tasks.', 'HIGH'),
  organization(PERMISSIONS.TRAINING_READ, 'Read personal training progress.'),
  organization(PERMISSIONS.WORKSPACE_USE, 'Use an assigned authoring workspace.'),
  organization(PERMISSIONS.SUBMISSION_READ, 'Read permitted submissions.'),
  organization(PERMISSIONS.SUBMISSION_CREATE, 'Create and cancel personal submissions.'),
  organization(PERMISSIONS.SUBMISSION_MANAGE, 'Manage organization submissions.', 'HIGH'),
  organization(PERMISSIONS.DISCUSSION_READ, 'Read permitted discussions.'),
  organization(PERMISSIONS.DISCUSSION_CREATE, 'Create and reply to discussions.'),
  organization(PERMISSIONS.DISCUSSION_MANAGE, 'Assign and moderate discussions.', 'HIGH'),
  organization(PERMISSIONS.ANALYTICS_READ, 'Read organization analytics.'),
  organization(PERMISSIONS.OBSERVABILITY_READ, 'Read organization audit and telemetry data.'),
  organization(PERMISSIONS.AI_TUTOR_USE, 'Use AI tutoring features.'),
  organization(PERMISSIONS.AI_TASK_GENERATE, 'Generate tasks with AI.', 'HIGH'),
  organization(PERMISSIONS.AI_RETRIEVAL_READ, 'Inspect retrieval state and evidence.'),
  organization(PERMISSIONS.AI_RETRIEVAL_MANAGE, 'Activate and retry retrieval indexes.', 'HIGH'),
  organization(PERMISSIONS.KNOWLEDGE_READ, 'Read published knowledge.'),
  organization(PERMISSIONS.KNOWLEDGE_MANAGE, 'Rebuild and manage knowledge indexes.', 'HIGH'),
  organization(PERMISSIONS.SANDBOX_EXECUTE, 'Execute code in the sandbox.'),
  {
    key: PERMISSIONS.SYSTEM_CONFIG_READ,
    scope: 'PLATFORM',
    version: PERMISSION_REGISTRY_VERSION,
    description: 'Read masked platform configuration.',
    risk: 'HIGH',
  },
  {
    key: PERMISSIONS.SYSTEM_CONFIG_MANAGE,
    scope: 'PLATFORM',
    version: PERMISSION_REGISTRY_VERSION,
    description: 'Update platform configuration.',
    risk: 'HIGH',
  },
] as const;

const common = [
  PERMISSIONS.PROFILE_READ,
  PERMISSIONS.PROFILE_UPDATE,
  PERMISSIONS.NOTIFICATION_READ,
  PERMISSIONS.NOTIFICATION_UPDATE,
] as const;

export const DEFAULT_ROLE_PERMISSIONS = {
  ADMIN: [
    ...common,
    PERMISSIONS.ORGANIZATION_READ,
    PERMISSIONS.ORGANIZATION_MANAGE,
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.ROLE_READ,
    PERMISSIONS.ROLE_MANAGE,
    PERMISSIONS.COURSE_READ,
    PERMISSIONS.COURSE_MANAGE,
    PERMISSIONS.TASK_READ,
    PERMISSIONS.TASK_MANAGE,
    PERMISSIONS.SUBMISSION_READ,
    PERMISSIONS.SUBMISSION_MANAGE,
    PERMISSIONS.DISCUSSION_READ,
    PERMISSIONS.DISCUSSION_MANAGE,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.OBSERVABILITY_READ,
    PERMISSIONS.AI_TUTOR_USE,
    PERMISSIONS.AI_TASK_GENERATE,
    PERMISSIONS.AI_RETRIEVAL_READ,
    PERMISSIONS.AI_RETRIEVAL_MANAGE,
    PERMISSIONS.KNOWLEDGE_READ,
    PERMISSIONS.KNOWLEDGE_MANAGE,
  ],
  MENTOR: [
    ...common,
    PERMISSIONS.ORGANIZATION_READ,
    PERMISSIONS.USER_READ,
    PERMISSIONS.COURSE_READ,
    PERMISSIONS.COURSE_MANAGE,
    PERMISSIONS.TASK_READ,
    PERMISSIONS.TASK_MANAGE,
    PERMISSIONS.SUBMISSION_READ,
    PERMISSIONS.SUBMISSION_MANAGE,
    PERMISSIONS.DISCUSSION_READ,
    PERMISSIONS.DISCUSSION_MANAGE,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.AI_TUTOR_USE,
    PERMISSIONS.AI_TASK_GENERATE,
    PERMISSIONS.AI_RETRIEVAL_READ,
    PERMISSIONS.KNOWLEDGE_READ,
  ],
  TRAINEE: [
    ...common,
    PERMISSIONS.ACHIEVEMENT_READ,
    PERMISSIONS.COURSE_READ,
    PERMISSIONS.TASK_READ,
    PERMISSIONS.TRAINING_READ,
    PERMISSIONS.WORKSPACE_USE,
    PERMISSIONS.SUBMISSION_READ,
    PERMISSIONS.SUBMISSION_CREATE,
    PERMISSIONS.DISCUSSION_READ,
    PERMISSIONS.DISCUSSION_CREATE,
    PERMISSIONS.AI_TUTOR_USE,
    PERMISSIONS.KNOWLEDGE_READ,
    PERMISSIONS.SANDBOX_EXECUTE,
  ],
  PLATFORM_ADMIN: [
    ...common,
    PERMISSIONS.ORGANIZATION_READ,
    PERMISSIONS.PLATFORM_ORGANIZATION_MANAGE,
    PERMISSIONS.SYSTEM_CONFIG_READ,
    PERMISSIONS.SYSTEM_CONFIG_MANAGE,
    PERMISSIONS.OBSERVABILITY_READ,
  ],
} as const satisfies Record<string, readonly Permission[]>;

export const SYSTEM_ROLE_REGISTRY = [
  {
    key: 'ADMIN',
    name: 'Organization administrator',
    description: 'Built-in organization administrator role.',
  },
  {
    key: 'MENTOR',
    name: 'Mentor',
    description: 'Built-in mentor role.',
  },
  {
    key: 'TRAINEE',
    name: 'Trainee',
    description: 'Built-in trainee role.',
  },
  {
    key: 'PLATFORM_ADMIN',
    name: 'Platform administrator',
    description: 'Operator-provisioned platform role.',
  },
] as const satisfies readonly {
  key: keyof typeof DEFAULT_ROLE_PERMISSIONS;
  name: string;
  description: string;
}[];

export interface MePermissionsDTO {
  registryVersion: number;
  organizationId: string;
  roles: { id: string; key: string; name: string }[];
  permissions: Permission[];
}

export interface AuthorizationRoleDTO {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  system: boolean;
  organizationId?: string | null;
  permissions: Permission[];
  memberCount: number;
  memberIds?: string[];
}
