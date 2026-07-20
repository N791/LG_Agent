/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-dynamic-delete */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { OfflineWorkspaceService } from './offlineWorkspaceService';

class MockRequest {
  result: any;
  error: any;
  onsuccess: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;

  constructor(result?: any) {
    this.result = result;
  }
}

describe('OfflineWorkspaceService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('persists and loads workspace snapshots from indexedDB', async () => {
    const stored: Record<string, any> = {};
    const objectStore = {
      put: vi.fn((value: any) => {
        stored[value.taskId] = value;
        const request = new MockRequest(value);
        queueMicrotask(() => request.onsuccess?.({ target: request }));
        return request;
      }),
      get: vi.fn((taskId: string) => {
        const request = new MockRequest(stored[taskId] ?? null);
        queueMicrotask(() => request.onsuccess?.({ target: request }));
        return request;
      }),
      delete: vi.fn((taskId: string) => {
        delete stored[taskId];
        const request = new MockRequest(undefined);
        queueMicrotask(() => request.onsuccess?.({ target: request }));
        return request;
      }),
    };
    const transaction = {
      objectStore: vi.fn(() => objectStore),
      oncomplete: null as any,
      onerror: null as any,
    };
    const db = {
      transaction: vi.fn(() => transaction),
      objectStoreNames: { contains: vi.fn(() => true) },
      close: vi.fn(),
    };
    const openRequest = new MockRequest(db) as any;

    const openMock = vi.fn(() => {
      openRequest.result = db;
      setTimeout(() => {
        openRequest.onsuccess?.({ target: openRequest });
      }, 0);
      return openRequest;
    });

    vi.stubGlobal('indexedDB', { open: openMock });

    const service = new OfflineWorkspaceService();
    await service.saveSnapshot('task-1', {
      taskId: 'task-1',
      activeFile: 'src/app.ts',
      fileContents: { 'src/app.ts': 'console.log("hi")' },
      openFiles: ['src/app.ts'],
      unsavedChanges: { 'src/app.ts': true },
    } as any);

    const snapshot = await service.loadSnapshot('task-1');

    expect(snapshot?.activeFile).toBe('src/app.ts');
    expect(snapshot?.fileContents['src/app.ts']).toBe('console.log("hi")');
  });

  it('detects conflicts when local snapshot differs from remote workspace content', async () => {
    const stored: Record<string, any> = {};
    const objectStore = {
      put: vi.fn((value: any) => {
        stored[value.taskId] = value;
        const request = new MockRequest(value);
        queueMicrotask(() => request.onsuccess?.({ target: request }));
        return request;
      }),
      get: vi.fn((taskId: string) => {
        const request = new MockRequest(stored[taskId] ?? null);
        queueMicrotask(() => request.onsuccess?.({ target: request }));
        return request;
      }),
      delete: vi.fn((taskId: string) => {
        delete stored[taskId];
        const request = new MockRequest(undefined);
        queueMicrotask(() => request.onsuccess?.({ target: request }));
        return request;
      }),
    };
    const transaction = {
      objectStore: vi.fn(() => objectStore),
      oncomplete: null as any,
      onerror: null as any,
    };
    const db = {
      transaction: vi.fn(() => transaction),
      objectStoreNames: { contains: vi.fn(() => true) },
      close: vi.fn(),
    };
    const openRequest = new MockRequest(db) as any;

    const openMock = vi.fn(() => {
      openRequest.result = db;
      setTimeout(() => {
        openRequest.onsuccess?.({ target: openRequest });
      }, 0);
      return openRequest;
    });

    vi.stubGlobal('indexedDB', { open: openMock });

    const service = new OfflineWorkspaceService();
    await service.saveSnapshot('task-2', {
      activeFile: 'src/app.ts',
      fileContents: { 'src/app.ts': 'console.log("local")' },
      openFiles: ['src/app.ts'],
      unsavedChanges: { 'src/app.ts': true },
    });

    const result = await service.compareWithRemote('task-2', { 'src/app.ts': 'console.log("remote")' });

    expect(result.hasConflict).toBe(true);
    expect(result.conflictingFiles).toEqual(['src/app.ts']);
  });
});
