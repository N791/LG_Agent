import React, { useState, useCallback } from 'react';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { LeftPanel } from './LeftPanel';
import { aiService } from '../../services/aiService';
import { FileTree } from './FileTree';
import { EditorPanel } from './EditorPanel';
import { BottomPanel } from './BottomPanel';
import { ExecutionState } from './ExecutionCenterPanel';
import { TopNavbar } from '../../components/TopNavbar';
import { useParams } from 'react-router-dom';
import { workspaceService } from '../../services/workspace/WorkspaceService';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { Button, Modal, Spin } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useAutoSave } from '../../hooks/useAutoSave';
import { offlineWorkspaceService } from '../../services/offlineWorkspaceService';
import { useViewport } from '../../hooks/useViewport';

const WorkspacePage: React.FC = () => {
  const { taskId } = useParams<{ courseId: string; taskId: string }>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [executionId, setExecutionId] = useState<string | null>(null);

  const [executionState, setExecutionState] = useState<ExecutionState>({
    mode: 'LIVE',
    status: 'IDLE',
    logs: '',
    metrics: null,
    report: null,
    score: null,
    error: null,
  });

  const { isNarrow } = useViewport();

  const setTaskId = useWorkspaceStore((state) => state.setTaskId);
  const editorLayoutSizes = useWorkspaceStore((state) => state.editorLayoutSizes);
  const setEditorLayoutSizes = useWorkspaceStore((state) => state.setEditorLayoutSizes);

  // Auto-save lifecycle (debounce, Ctrl+S, beforeunload)
  const { saveNow, isSaving } = useAutoSave(taskId);

  React.useEffect(() => {
    setTaskId(taskId ?? null);
    return () => {
      useWorkspaceStore.getState().clearWorkspace();
    };
  }, [taskId, setTaskId]);

  const unsavedChanges = useWorkspaceStore((state) => state.unsavedChanges);

  React.useEffect(() => {
    if (taskId) {
      setIsInitializing(true);
      workspaceService
        .loadWorkspace(taskId)
        .then((workspace) => {
          // Check local storage for recovery data
          const recoveryKey = `lg_workspace_recovery_${taskId}`;
          const recoveryDataRaw = localStorage.getItem(recoveryKey);
          let recoveredContents: Record<string, string> | null = null;

          if (recoveryDataRaw) {
            try {
              recoveredContents = JSON.parse(recoveryDataRaw) as Record<string, string>;
            } catch (e) {
              console.error('Failed to parse recovery data', e);
            }
          }

          const recoveryPromise = taskId
            ? offlineWorkspaceService.loadSnapshot(taskId).then((offlineSnapshot) => {
                return offlineSnapshot && (!recoveredContents || Object.keys(recoveredContents).length === 0)
                  ? offlineSnapshot.fileContents
                  : recoveredContents;
              })
            : Promise.resolve(recoveredContents);

          return recoveryPromise.then(async (recoverySource) => {
            const remoteFiles = workspace.workspace.files.reduce<Record<string, string>>((acc, file) => {
              acc[file.path] = file.content;
              return acc;
            }, {});
            const syncComparison = taskId
              ? await offlineWorkspaceService.compareWithRemote(taskId, remoteFiles)
              : { hasConflict: false, conflictingFiles: [], localFiles: {}, remoteFiles };

            const hasRecoveryData = recoverySource && Object.keys(recoverySource).length > 0;
            if (hasRecoveryData || syncComparison.hasConflict) {
              Modal.confirm({
                title: syncComparison.hasConflict ? 'Offline changes conflict with the server' : 'Unsaved Changes Found',
                content: syncComparison.hasConflict
                  ? 'Your local draft differs from the latest workspace on the server. Choose whether to keep the local draft or use the server version.'
                  : 'You have unsaved changes from a previous session. Do you want to recover them?',
                okText: syncComparison.hasConflict ? 'Use server version' : 'Recover',
                cancelText: syncComparison.hasConflict ? 'Keep local draft' : 'Discard',
                onOk: () => {
                  workspace.workspace.files.forEach((f) => {
                    const remoteContent = remoteFiles[f.path];
                    useWorkspaceStore.getState().openFile(f.path, remoteContent ?? f.content);
                    if (remoteContent !== undefined) {
                      useWorkspaceStore.getState().updateFileContent(f.path, remoteContent);
                    } else {
                      useWorkspaceStore.getState().markFileSaved(f.path);
                    }
                  });
                  if (taskId) {
                    void offlineWorkspaceService.syncWithRemote(taskId, remoteFiles);
                  }
                  localStorage.removeItem(recoveryKey);
                },
                onCancel: () => {
                  if (hasRecoveryData) {
                    workspace.workspace.files.forEach((f) => {
                      const recoveredContent = recoverySource[f.path];
                      useWorkspaceStore.getState().openFile(f.path, recoveredContent ?? f.content);
                      if (recoveredContent && recoveredContent !== f.content) {
                        useWorkspaceStore.getState().updateFileContent(f.path, recoveredContent);
                      } else {
                        useWorkspaceStore.getState().markFileSaved(f.path);
                      }
                    });
                  } else {
                    workspace.workspace.files.forEach((f) => {
                      useWorkspaceStore.getState().openFile(f.path, f.content);
                      useWorkspaceStore.getState().markFileSaved(f.path);
                    });
                  }
                  localStorage.removeItem(recoveryKey);
                  if (taskId) {
                    void offlineWorkspaceService.clearSnapshot(taskId);
                  }
                }
              });
            } else {
              workspace.workspace.files.forEach((f) => {
                useWorkspaceStore.getState().openFile(f.path, f.content);
              });
            }
          });
        })
        .catch(console.error)
        .finally(() => { setIsInitializing(false); });
    }
  }, [taskId]);

  const handleSubmit = async () => {
    if (!taskId) return;

    await saveNow();

    try {
      await workspaceService.createVersion(taskId, 'RUN');
    } catch (err) {
      console.error('Failed to create pre-run snapshot', err);
    }

    setIsSubmitting(true);
    const startTime = Date.now();
    setExecutionState({
      mode: 'LIVE',
      status: 'PENDING',
      logs: '',
      metrics: {
        executionId: 'submission',
        status: 'PENDING',
        startTime,
        endTime: null,
        durationMs: 0,
        stageDurations: {},
        exitCode: null,
        retryCount: 0,
        logCount: 0,
      },
      report: null,
      score: null,
      error: null,
    });

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/submissions/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token ?? ''}`,
        },
        body: JSON.stringify({ taskId }),
      });

      if (!res.ok) {
        throw new Error('Failed to start submission');
      }

      const { submissionId } = await res.json() as { submissionId: string };
      setExecutionId(submissionId);

      setExecutionState(prev => ({
        ...prev,
        submissionId,
        metrics: prev.metrics ? { ...prev.metrics, executionId: submissionId } : null
      }));

      await fetchEventSource(`/api/v1/submissions/${submissionId}/logs`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token ?? ''}`,
        },
        onmessage(msg) {
          if (msg.event === 'FatalError') {
            throw new Error(msg.data);
          }
          if (msg.data === '[DONE]') {
            setIsSubmitting(false);
            setExecutionId(null);
            setExecutionState(prev => ({
              ...prev,
              metrics: prev.metrics ? {
                ...prev.metrics,
                endTime: Date.now(),
                durationMs: Date.now() - (prev.metrics.startTime ?? Date.now()),
                status: prev.status as 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'ERROR' | 'STOPPED',
              } : null
            }));
            return;
          }

          try {
            const event = JSON.parse(msg.data) as {
              type?: string;
              message?: string;
              data?: { text?: string; score?: number; report?: unknown; exitCode?: number };
            };

            setExecutionState(prev => {
              const newState = { ...prev };
              const metrics = newState.metrics ? { ...newState.metrics } : null;

              if (event.type === 'RUNNING') {
                newState.status = 'RUNNING';
                if (metrics) metrics.status = 'RUNNING';
              } else if (event.type === 'LOG' && event.data?.text) {
                newState.logs += event.data.text;
                if (metrics) metrics.logCount += 1;
              } else if (event.type === 'ERROR') {
                newState.status = 'ERROR';
                newState.error = event.message ?? 'Unknown error';
                if (metrics) metrics.status = 'ERROR';
              } else if (event.type === 'SUCCESS' || event.type === 'FAILED') {
                newState.status = event.type;
                newState.score = event.data?.score ?? 0;
                newState.report = event.data?.report ?? null;
                if (metrics) {
                  metrics.status = newState.status;
                  metrics.exitCode = event.data?.exitCode ?? null;
                }

                if (event.type === 'FAILED') {
                  useWorkspaceStore.getState().setLeftPanelTab('mentor');
                  const activeFile = useWorkspaceStore.getState().activeFile;
                  void aiService.chat(
                    taskId,
                    'code-review',
                    `Please review my code and the failure report:\n\n${JSON.stringify(event.data?.report ?? {})}`,
                    activeFile ?? undefined
                  );
                }
              }
              newState.metrics = metrics;
              return newState;
            });
          } catch (e) {
            console.error('Failed to parse SSE message', e);
          }
        },
        onclose() {
          setIsSubmitting(false);
          setExecutionId(null);
        },
        onerror(err: unknown) {
          console.error('SSE Error:', err);
          setExecutionState(prev => ({
            ...prev,
            status: 'ERROR',
            error: (err as Error).message,
            metrics: prev.metrics ? {
              ...prev.metrics,
              status: 'ERROR',
              endTime: Date.now(),
              durationMs: Date.now() - (prev.metrics.startTime ?? Date.now())
            } : null
          }));
          setIsSubmitting(false);
          setExecutionId(null);
          throw err;
        },
      });
    } catch (error: unknown) {
      console.error(error);
      setIsSubmitting(false);
      setExecutionId(null);
    }
  };


  const handleSandboxAction = async (action: import('@lg-agent/contracts').SandboxAction) => {
    if (!taskId) return;
    await saveNow();
    try {
      await workspaceService.createVersion(taskId, 'RUN');
    } catch (err) {
      console.error('Failed to create pre-run snapshot', err);
    }

    setIsSubmitting(true);
    const startTime = Date.now();
    setExecutionState({
      mode: 'LIVE',
      status: 'PENDING',
      logs: '',
      metrics: {
        executionId: 'pending',
        status: 'PENDING',
        startTime,
        endTime: null,
        durationMs: 0,
        stageDurations: {},
        exitCode: null,
        retryCount: 0,
        logCount: 0,
      },
      report: null,
      score: null,
      error: null,
    });

    try {
      const { executeSandboxAction, streamExecutionLogs } = await import('../../services/sandboxService');
      const response = await executeSandboxAction(taskId, action);
      setExecutionId(response.executionId);

      setExecutionState(prev => ({
        ...prev,
        metrics: prev.metrics ? { ...prev.metrics, executionId: response.executionId } : null
      }));

      const stream = streamExecutionLogs(response.executionId, taskId, action);

      for await (const rawEvent of stream) {
        const event = rawEvent as {
          type?: string;
          message?: string;
          data?: { text?: string; score?: number; report?: unknown; exitCode?: number };
        };
        
        setExecutionState(prev => {
          const newState = { ...prev };
          const metrics = newState.metrics ? { ...newState.metrics } : null;

          if (event.type === 'RUNNING') {
            newState.status = 'RUNNING';
            if (metrics) metrics.status = 'RUNNING';
          } else if (event.type === 'LOG' && event.data?.text) {
            newState.logs += event.data.text;
            if (metrics) metrics.logCount += 1;
          } else if (event.type === 'ERROR') {
            newState.status = 'ERROR';
            newState.error = event.message ?? 'Unknown error';
            if (metrics) metrics.status = 'ERROR';
          } else if (event.type === 'SUCCESS' || event.type === 'FAILED') {
            newState.status = event.type;
            newState.score = event.data?.score ?? 0;
            newState.report = event.data?.report ?? null;
            if (metrics) {
              metrics.status = newState.status;
              metrics.exitCode = event.data?.exitCode ?? null;
            }
          }
          newState.metrics = metrics;
          return newState;
        });
      }

      // Update end time
      setExecutionState(prev => ({
        ...prev,
        metrics: prev.metrics ? {
          ...prev.metrics,
          endTime: Date.now(),
          durationMs: Date.now() - (prev.metrics.startTime ?? Date.now()),
          status: prev.status as 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'ERROR' | 'STOPPED',
        } : null
      }));

    } catch (error: unknown) {
      console.error(error);
      setExecutionState(prev => ({
        ...prev,
        status: 'ERROR',
        error: (error as Error).message,
        metrics: prev.metrics ? {
          ...prev.metrics,
          status: 'ERROR',
          endTime: Date.now(),
          durationMs: Date.now() - (prev.metrics.startTime ?? Date.now())
        } : null
      }));
    } finally {
      setIsSubmitting(false);
      setExecutionId(null);
    }
  };

  const handleStop = async () => {
    if (executionId) {
      const { stopExecution } = await import('../../services/sandboxService');
      await stopExecution(executionId).catch(console.error);
      setExecutionState(prev => ({
        ...prev,
        status: 'STOPPED',
        metrics: prev.metrics ? {
          ...prev.metrics,
          status: 'STOPPED',
          endTime: Date.now(),
          durationMs: Date.now() - (prev.metrics.startTime ?? Date.now())
        } : null
      }));
    }
  };

  const ActionToolbar = (
    <div className="flex gap-2">
      {isSubmitting ? (
        <Button
          type="primary"
          danger
          onClick={() => { void handleStop(); }}
          className="font-medium"
        >
          Stop Execution
        </Button>
      ) : (
        <>
          <Button onClick={() => { void handleSandboxAction('build'); }} disabled={isSubmitting}>Build</Button>
          <Button onClick={() => { void handleSandboxAction('lint'); }} disabled={isSubmitting}>Lint</Button>
          <Button onClick={() => { void handleSandboxAction('test'); }} disabled={isSubmitting}>Test</Button>
          <Button
            icon={<PlayCircleOutlined />}
            onClick={() => { void handleSandboxAction('run'); }}
            disabled={isSubmitting}
            className="font-medium"
          >
            Run Code
          </Button>
          <Button
            type="primary"
            onClick={() => { void handleSubmit(); }}
            disabled={isSubmitting}
            className="font-medium"
          >
            Submit
          </Button>
        </>
      )}
    </div>
  );

  const hasUnsaved = Object.values(unsavedChanges).some(Boolean);
  const status = isSaving ? 'Saving...' : hasUnsaved ? 'Unsaved' : 'Saved';

  const handleHorizontalResize = useCallback((sizes: number[]) => {
    const s0 = sizes[0] ?? 0;
    const s1 = sizes[1] ?? 0;
    const s2 = sizes[2] ?? 0;
    if (sizes.length === 3) {
      const total = s0 + s1 + s2;
      if (total > 0) {
        setEditorLayoutSizes({
          leftPanel: Math.round((s0 / total) * 100),
          fileTree: Math.round((s1 / total) * 100),
          editor: Math.round((s2 / total) * 100),
        });
      }
    }
  }, [setEditorLayoutSizes]);

  const handleVerticalResize = useCallback((sizes: number[]) => {
    const s0 = sizes[0] ?? 0;
    const s1 = sizes[1] ?? 0;
    if (sizes.length === 2) {
      const total = s0 + s1;
      if (total > 0) {
        setEditorLayoutSizes({
          logs: Math.round((s1 / total) * 100),
        });
      }
    }
  }, [setEditorLayoutSizes]);

  if (isInitializing) {
    return (
      <div className="h-screen flex flex-col bg-gray-50 items-center justify-center">
        <Spin size="large" />
        <div className="mt-4 text-gray-500 font-medium">Initializing Workspace...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <TopNavbar title={`Workspace - ${taskId ?? ''}`} status={status} actions={ActionToolbar} />
      <div className="flex-1 min-h-0 overflow-hidden">
        {isNarrow ? (
          <div className="h-full flex flex-col overflow-auto" role="region" aria-label="Workspace layout">
            <div className="flex-1 min-h-[220px] border-b bg-white">
              <LeftPanel setExecutionState={setExecutionState} />
            </div>
            <div className="flex-1 min-h-[220px] border-b bg-white">
              <FileTree />
            </div>
            <div className="flex-1 min-h-[320px]">
              <Allotment vertical onChange={handleVerticalResize}>
                <Allotment.Pane minSize={180} preferredSize={`${(100 - editorLayoutSizes.logs).toString()}%`}>
                  <EditorPanel />
                </Allotment.Pane>
                <Allotment.Pane minSize={100} preferredSize={`${editorLayoutSizes.logs.toString()}%`}>
                  <BottomPanel executionState={executionState} />
                </Allotment.Pane>
              </Allotment>
            </div>
          </div>
        ) : (
          <Allotment onChange={handleHorizontalResize}>
            <Allotment.Pane minSize={250} preferredSize={`${editorLayoutSizes.leftPanel.toString()}%`}>
              <LeftPanel setExecutionState={setExecutionState} />
            </Allotment.Pane>
            <Allotment.Pane minSize={150} preferredSize={`${editorLayoutSizes.fileTree.toString()}%`}>
              <FileTree />
            </Allotment.Pane>
            <Allotment.Pane minSize={400} preferredSize={`${editorLayoutSizes.editor.toString()}%`}>
              <Allotment vertical onChange={handleVerticalResize}>
                <Allotment.Pane minSize={200} preferredSize={`${(100 - editorLayoutSizes.logs).toString()}%`}>
                  <EditorPanel />
                </Allotment.Pane>
                <Allotment.Pane minSize={100} preferredSize={`${editorLayoutSizes.logs.toString()}%`}>
                  <BottomPanel executionState={executionState} />
                </Allotment.Pane>
              </Allotment>
            </Allotment.Pane>
          </Allotment>
        )}
      </div>
    </div>
  );
};

export default WorkspacePage;
