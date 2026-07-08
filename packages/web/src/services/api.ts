import request from '../utils/request';

// Users
export const getUsers = () => request.get('/users');
export const createUser = (data: Record<string, unknown>) => request.post('/users', data);
export const updateUser = (id: string, data: Record<string, unknown>) =>
  request.patch(`/users/${id}`, data);
export const deleteUser = (id: string) => request.delete(`/users/${id}`);

// Organizations
export const getOrganizations = () => request.get('/organizations');
export const createOrganization = (data: Record<string, unknown>) =>
  request.post('/organizations', data);
export const updateOrganization = (id: string, data: Record<string, unknown>) =>
  request.patch(`/organizations/${id}`, data);
export const deleteOrganization = (id: string) => request.delete(`/organizations/${id}`);

// Courses
export const getCourses = (params?: Record<string, unknown>) => request.get('/courses', { params });
export const createCourse = (data: Record<string, unknown>) => request.post('/courses', data);
export const updateCourse = (id: string, data: Record<string, unknown>) =>
  request.patch(`/courses/${id}`, data);
export const deleteCourse = (id: string) => request.delete(`/courses/${id}`);

// Tasks
export const getTasks = (params?: { courseId: string }) => request.get('/tasks', { params });
export const createTask = (data: Record<string, unknown>) => request.post('/tasks', data);
export const updateTask = (id: string, data: Record<string, unknown>) =>
  request.patch(`/tasks/${id}`, data);
export const deleteTask = (id: string) => request.delete(`/tasks/${id}`);
