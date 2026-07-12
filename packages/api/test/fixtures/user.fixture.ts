import { User } from '@prisma/client';

export const UserFixture = {
  createAdmin: (overrides?: Partial<User>): User => ({
    id: 'user-admin-1',
    username: 'admin',
    nickname: 'Admin User',
    email: null,
    status: 1,
    password: 'hashed-password',
    role: 'ADMIN',
    organizationId: 'org-1',
    createdAt: new Date(),
    ...overrides,
  }),

  createTrainee: (overrides?: Partial<User>): User => ({
    id: 'user-trainee-1',
    username: 'trainee1',
    nickname: 'Trainee User',
    email: null,
    status: 1,
    password: 'hashed-password',
    role: 'TRAINEE',
    organizationId: 'org-1',
    createdAt: new Date(),
    ...overrides,
  }),

  createMentor: (overrides?: Partial<User>): User => ({
    id: 'user-mentor-1',
    username: 'mentor1',
    nickname: 'Mentor User',
    email: null,
    status: 1,
    password: 'hashed-password',
    role: 'MENTOR',
    organizationId: 'org-1',
    createdAt: new Date(),
    ...overrides,
  }),
};
