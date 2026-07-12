import { User } from '@prisma/client';

export const UserFixture = {
  createAdmin: (overrides?: Partial<User>): User => ({
    id: 'user-admin-1',
    username: 'admin',
    nickname: 'Admin User',
    password: 'hashed-password',
    role: 'admin',
    organizationId: 'org-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  createTrainee: (overrides?: Partial<User>): User => ({
    id: 'user-trainee-1',
    username: 'trainee1',
    nickname: 'Trainee User',
    password: 'hashed-password',
    role: 'trainee',
    organizationId: 'org-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  createMentor: (overrides?: Partial<User>): User => ({
    id: 'user-mentor-1',
    username: 'mentor1',
    nickname: 'Mentor User',
    password: 'hashed-password',
    role: 'mentor',
    organizationId: 'org-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
};
