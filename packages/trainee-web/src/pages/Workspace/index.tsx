import React, { useState } from 'react';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { LeftPanel } from './LeftPanel';
import { FileTree } from './FileTree';
import { EditorPanel } from './EditorPanel';
import { LogsPanel } from './LogsPanel';
import { TopNavbar } from '../../components/TopNavbar';
import { useParams } from 'react-router-dom';
import { workspaceService } from '../../services/workspace/WorkspaceService';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { Button } from 'antd';
import { PlayCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '../../store/workspaceStore';
import request from '../../utils/request';

const WorkspacePage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const [logs, setLogs] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const markFileSaved = useWorkspaceStore((state) => state.markFileSaved);
  const fileContents = useWorkspaceStore((state) => state.fileContents);

  const fetchHistory = React.useCallback(async () => {
    if (!taskId) return;
    try {
      const response = await request.get<
        | { data?: { messages?: { id: string; role: string; content: string }[] } }
        | { messages?: { id: string; role: string; content: string }[] }
      >(`/api/v1/ai/tutor/conversations/${taskId}`);
      const data =
        (response as { data?: { messages?: { id: string; role: string; content: string }[] } })
          .data ?? (response as { messages?: { id: string; role: string; content: string }[] });
      if (data.messages) {
        useWorkspaceStore.getState().setAiHistory(data.messages);
      }
    } catch (err) {
      console.error('Failed to fetch AI history', err);
    }
  }, [taskId]);

  const unsavedChanges = useWorkspaceStore((state) => state.unsavedChanges);

  const saveUnsavedFiles = React.useCallback(async () => {
    if (!taskId) return;
    const filesToSave = Object.keys(unsavedChanges).filter((p) => unsavedChanges[p]);
    if (filesToSave.length === 0) return;

    const payload = filesToSave.map((path) => ({
      path,
      content: fileContents[path],
    }));

    try {
      await workspaceService.updateFiles(taskId, payload);
      filesToSave.forEach((path) => {
        markFileSaved(path);
      });
    } catch (err) {
      console.error('Auto save failed', err);
    }
  }, [taskId, unsavedChanges, fileContents, markFileSaved]);

  React.useEffect(() => {
    void fetchHistory();
    if (taskId) {
      workspaceService
        .loadWorkspace(taskId)
        .then((workspace) => {
          // Load files into store
          workspace.workspace.files.forEach((f) => {
            useWorkspaceStore.getState().openFile(f.path, f.content);
          });
        })
        .catch(console.error);
    }
  }, [fetchHistory, taskId]);

  // Debounce Auto Save (1.5s)
  React.useEffect(() => {
    const handler = setTimeout(() => {
      void saveUnsavedFiles();
    }, 1500);
    return () => {
      clearTimeout(handler);
    };
  }, [saveUnsavedFiles]);

  // Ctrl+S Manual Save
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        void saveUnsavedFiles();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [saveUnsavedFiles]);

  // beforeunload Save
  React.useEffect(() => {
    const handleBeforeUnload = () => {
      void saveUnsavedFiles();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [saveUnsavedFiles]);

  const handleSubmit = async () => {
    if (!taskId) return;

    // Auto-save before run/submit
    await saveUnsavedFiles();

    setIsSubmitting(true);
    setLogs('');

    try {
      const token = localStorage.getItem('token'); // Assuming JWT token is stored here

      await fetchEventSource(`/api/v1/submissions/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token ?? ''}`,
        },
        body: JSON.stringify({ taskId }),
        onmessage(msg) {
          if (msg.event === 'FatalError') {
            throw new Error(msg.data);
          }
          if (msg.data === '[DONE]') {
            setIsSubmitting(false);
            return;
          }

          try {
            const event = JSON.parse(msg.data) as {
              type?: string;
              message?: string;
              data?: { text?: string; score?: number; report?: string };
            };
            if (event.type === 'LOG' && event.data?.text) {
              setLogs((prev) => prev + (event.data?.text ?? ''));
            } else if (event.type === 'ERROR') {
              setLogs((prev) => prev + `\n[ERROR] ${event.message ?? ''}\n`);
            } else if (event.type === 'SUCCESS' || event.type === 'FAILED') {
              setLogs(
                (prev) =>
                  prev +
                  `\n\n[EXECUTION ${event.type ?? ''}] Score: ${(event.data?.score ?? 0).toString()}`,
              );

              if (event.type === 'FAILED') {
                useWorkspaceStore.getState().setLeftPanelTab('mentor');
                useWorkspaceStore.getState().setAiFeedback('');
                useWorkspaceStore.getState().setAiLoading(true);

                // Trigger AI Review in background via stream
                void fetchEventSource(`/api/v1/ai/tutor/chat`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token ?? ''}`,
                  },
                  body: JSON.stringify({
                    taskId,
                    action: 'code-review',
                    content: `Please review my code and the failure report:\n\n${event.data?.report ?? ''}`,
                    stream: true,
                  }),
                  onmessage(msg) {
                    if (msg.data === '[DONE]') {
                      useWorkspaceStore.getState().setAiLoading(false);
                      return;
                    }
                    useWorkspaceStore.getState().setAiFeedback((prev: string) => prev + msg.data);
                  },
                  onclose() {
                    useWorkspaceStore.getState().setAiLoading(false);
                    request
                      .get<
                        | { data?: { messages?: { id: string; role: string; content: string }[] } }
                        | { messages?: { id: string; role: string; content: string }[] }
                      >(`/api/v1/ai/tutor/conversations/${taskId}`)
                      .then((response) => {
                        const data =
                          (
                            response as {
                              data?: { messages?: { id: string; role: string; content: string }[] };
                            }
                          ).data ??
                          (response as {
                            messages?: { id: string; role: string; content: string }[];
                          });
                        if (data.messages) {
                          useWorkspaceStore.getState().setAiHistory(data.messages);
                          useWorkspaceStore.getState().setAiFeedback('');
                        }
                      })
                      .catch(console.error);
                  },
                  onerror(err) {
                    console.error('AI Tutor error', err);
                    useWorkspaceStore.getState().setAiLoading(false);
                  },
                });
              }
            }
          } catch (e) {
            console.error('Failed to parse SSE message', e);
          }
        },
        onclose() {
          setIsSubmitting(false);
        },
        onerror(err: unknown) {
          console.error('SSE Error:', err);
          setLogs((prev) => prev + `\n\n[Connection Error]: ${(err as Error).message}`);
          setIsSubmitting(false);
          throw err; // Stop retrying
        },
      });
    } catch (error: unknown) {
      console.error(error);
      setIsSubmitting(false);
    }
  };

  const SubmitButton = (
    <Button
      type="primary"
      icon={isSubmitting ? <LoadingOutlined /> : <PlayCircleOutlined />}
      onClick={() => {
        void handleSubmit();
      }}
      disabled={isSubmitting}
      className="bg-blue-600 hover:bg-blue-500 border-none shadow-md font-medium"
    >
      {isSubmitting ? 'Running...' : 'Run Code'}
    </Button>
  );

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <TopNavbar title={`Workspace - ${taskId ?? ''}`} actions={SubmitButton} />
      <div className="flex-1 min-h-0 overflow-hidden">
        <Allotment>
          <Allotment.Pane minSize={250} preferredSize="25%">
            <LeftPanel />
          </Allotment.Pane>
          <Allotment.Pane minSize={150} preferredSize="15%">
            <FileTree />
          </Allotment.Pane>
          <Allotment.Pane minSize={400} preferredSize="60%">
            <Allotment vertical>
              <Allotment.Pane minSize={200} preferredSize="70%">
                <EditorPanel />
              </Allotment.Pane>
              <Allotment.Pane minSize={100} preferredSize="30%">
                <LogsPanel logs={logs} />
              </Allotment.Pane>
            </Allotment>
          </Allotment.Pane>
        </Allotment>
      </div>
    </div>
  );
};

export default WorkspacePage;
