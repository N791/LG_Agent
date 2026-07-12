import { Course, Task } from '@prisma/client';

export const CourseFixture = {
  createBasic: (overrides?: Partial<Course>): Course => ({
    id: 'course-1',
    title: 'Basic Onboarding',
    description: 'A basic onboarding course',
    status: 0,
    version: '1.0.0',
    createdById: 'user-admin-1',
    organizationId: 'org-1',
    createdAt: new Date(),
    ...overrides,
  }),
};

export const TaskFixture = {
  createBasic: (overrides?: Partial<Task>): Task => ({
    id: 'task-1',
    title: 'Hello World Task',
    description: null,
    version: 1,
    courseId: 'course-1',
    stage: 1,
    envConfig: {},
    sandboxConfig: {},
    testConfig: {},
    promptConfig: {},
    config: null,
    metadata: null,
    ...overrides,
  }),
};
