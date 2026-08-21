import type { OfflineSnapshotPort } from '../ports';
import type { WorkspaceOfflineSnapshot } from '../model';

interface LegacySnapshot {
  taskId: string;
  activeFile: string | null;
  openFiles: string[];
  fileContents: Record<string, string>;
  unsavedChanges: Record<string, boolean>;
  updatedAt: string;
}

export class IndexedDbWorkspaceSnapshotAdapter implements OfflineSnapshotPort {
  private database: Promise<IDBDatabase | null> | null = null;

  private open(): Promise<IDBDatabase | null> {
    if (this.database) return this.database;
    this.database = new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
      const request = indexedDB.open('lg-agent-offline', 2);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('workspace-snapshots')) {
          request.result.createObjectStore('workspace-snapshots', { keyPath: 'taskId' });
        }
      };
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        resolve(null);
      };
    });
    return this.database;
  }

  async load(taskId: string): Promise<WorkspaceOfflineSnapshot | null> {
    const db = await this.open();
    if (!db) return null;
    const value = await new Promise<WorkspaceOfflineSnapshot | LegacySnapshot | null>((resolve) => {
      const request = db
        .transaction('workspace-snapshots', 'readonly')
        .objectStore('workspace-snapshots')
        .get(taskId);
      request.onsuccess = () => {
        resolve((request.result as WorkspaceOfflineSnapshot | LegacySnapshot | undefined) ?? null);
      };
      request.onerror = () => {
        resolve(null);
      };
    });
    if (!value) return null;
    if ('schemaVersion' in value) return value;
    const legacy = value;
    return {
      schemaVersion: 2,
      taskId,
      baselineFiles: {},
      draftFiles: legacy.fileContents,
      dirtyFiles: Object.keys(legacy.unsavedChanges).filter((path) => legacy.unsavedChanges[path]),
      activeFile: legacy.activeFile,
      openFiles: legacy.openFiles,
      updatedAt: legacy.updatedAt,
    };
  }

  async save(snapshot: WorkspaceOfflineSnapshot): Promise<void> {
    const db = await this.open();
    if (!db) return;
    await this.write(db, 'put', snapshot);
  }

  async clear(taskId: string): Promise<void> {
    const db = await this.open();
    if (!db) return;
    await this.write(db, 'delete', taskId);
  }

  private async write(
    db: IDBDatabase,
    operation: 'put' | 'delete',
    value: WorkspaceOfflineSnapshot | string,
  ): Promise<void> {
    await new Promise<void>((resolve) => {
      const store = db
        .transaction('workspace-snapshots', 'readwrite')
        .objectStore('workspace-snapshots');
      const request = operation === 'put' ? store.put(value) : store.delete(value as string);
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        resolve();
      };
    });
  }
}
