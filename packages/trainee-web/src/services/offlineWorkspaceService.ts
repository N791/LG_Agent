export interface OfflineWorkspaceSnapshot {
  taskId: string;
  activeFile: string | null;
  openFiles: string[];
  fileContents: Record<string, string>;
  unsavedChanges: Record<string, boolean>;
  updatedAt: string;
}

export interface OfflineSyncComparison {
  hasConflict: boolean;
  conflictingFiles: string[];
  localFiles: Record<string, string>;
  remoteFiles: Record<string, string>;
}

export class OfflineWorkspaceService {
  private dbName = 'lg-agent-offline';
  private storeName = 'workspace-snapshots';
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  private openDb(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }

      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'taskId' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });

    return this.dbPromise;
  }

  async saveSnapshot(taskId: string, snapshot: Omit<OfflineWorkspaceSnapshot, 'taskId' | 'updatedAt'>): Promise<void> {
    const db = await this.openDb();
    if (!db) return;

    const payload: OfflineWorkspaceSnapshot = {
      taskId,
      ...snapshot,
      updatedAt: new Date().toISOString(),
    };

    await new Promise<void>((resolve) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.put(payload);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  }

  async loadSnapshot(taskId: string): Promise<OfflineWorkspaceSnapshot | null> {
    const db = await this.openDb();
    if (!db) return null;

    return new Promise((resolve) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get(taskId);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    });
  }

  async clearSnapshot(taskId: string): Promise<void> {
    const db = await this.openDb();
    if (!db) return;

    await new Promise<void>((resolve) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.delete(taskId);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  }

  private normalizeRemoteFiles(
    remoteFiles: Record<string, string> | Array<{ path: string; content: string }> | undefined,
  ): Record<string, string> {
    if (!remoteFiles) return {};

    if (Array.isArray(remoteFiles)) {
      return remoteFiles.reduce<Record<string, string>>((acc, file) => {
        acc[file.path] = file.content;
        return acc;
      }, {});
    }

    return remoteFiles;
  }

  async compareWithRemote(
    taskId: string,
    remoteFiles: Record<string, string> | Array<{ path: string; content: string }> | undefined,
  ): Promise<OfflineSyncComparison> {
    const snapshot = await this.loadSnapshot(taskId);
    const localFiles = snapshot?.fileContents ?? {};
    const normalizedRemoteFiles = this.normalizeRemoteFiles(remoteFiles);

    const conflictingFiles = Object.keys(normalizedRemoteFiles).filter((path) => {
      const localContent = localFiles[path];
      return typeof localContent === 'string' && localContent !== normalizedRemoteFiles[path];
    });

    return {
      hasConflict: conflictingFiles.length > 0,
      conflictingFiles,
      localFiles,
      remoteFiles: normalizedRemoteFiles,
    };
  }

  async syncWithRemote(
    taskId: string,
    remoteFiles: Record<string, string> | Array<{ path: string; content: string }> | undefined,
  ): Promise<OfflineSyncComparison> {
    const comparison = await this.compareWithRemote(taskId, remoteFiles);
    if (!comparison.hasConflict) {
      await this.clearSnapshot(taskId);
    }
    return comparison;
  }
}

export const offlineWorkspaceService = new OfflineWorkspaceService();
