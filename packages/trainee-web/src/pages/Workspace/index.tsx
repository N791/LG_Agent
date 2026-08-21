import React, { useCallback, useEffect, useState } from 'react';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { Button, Modal, Spin, Switch, message } from 'antd';
import {
  CheckSquareOutlined,
  CloudUploadOutlined,
  ExperimentOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import type { SandboxAction } from '@lg-agent/contracts';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LeftPanel } from './LeftPanel';
import { EditorPanel } from './EditorPanel';
import { BottomPanel } from './BottomPanel';
import type { ExecutionState } from './ExecutionCenterPanel';
import { TopNavbar } from '../../components/TopNavbar';
import { useViewport } from '../../hooks/useViewport';
import { useWorkspaceStore } from '../../store/workspaceStore';
import {
  useWorkspaceSession,
  workspaceSessionCommands,
  workspaceSessionSelectors,
  useWorkspaceAutoSave,
} from '../../modules/workspace-session';

const WorkspacePage: React.FC = () => {
  const { t } = useTranslation('workspace');
  const { t: tCommon } = useTranslation('common');
  const { taskId } = useParams<{ taskId: string }>();
  const [isSandboxEnabled, setIsSandboxEnabled] = useState(true);
  const [historicalExecution, setHistoricalExecution] = useState<ExecutionState | null>(null);
  const { isNarrow } = useViewport();

  const phase = useWorkspaceSession((state) => state.phase);
  const execution = useWorkspaceSession((state) => state.execution);
  const isBusy = useWorkspaceSession(workspaceSessionSelectors.isBusy);
  const hasDirtyFiles = useWorkspaceSession(workspaceSessionSelectors.hasDirtyFiles);
  const editorLayoutSizes = useWorkspaceStore((state) => state.editorLayoutSizes);
  const setEditorLayoutSizes = useWorkspaceStore((state) => state.setEditorLayoutSizes);
  const setTaskId = useWorkspaceStore((state) => state.setTaskId);
  const clearWorkspaceUi = useWorkspaceStore((state) => state.clearWorkspace);
  const { saveNow, isSaving } = useWorkspaceAutoSave(taskId);

  useEffect(() => {
    if (!taskId) return;
    let active = true;
    setTaskId(taskId);
    void workspaceSessionCommands
      .load(taskId)
      .then((state) => {
        if (!active || !state.conflict) return;
        Modal.confirm({
          title: t('recovery.conflictTitle'),
          content: t('recovery.conflictContent'),
          okText: t('recovery.useServer'),
          cancelText: t('recovery.keepLocal'),
          onOk: () => workspaceSessionCommands.resolveConflict('REMOTE'),
          onCancel: () => workspaceSessionCommands.resolveConflict('LOCAL'),
        });
      })
      .catch((error: unknown) => {
        if (active) message.error(error instanceof Error ? error.message : String(error));
      });
    return () => {
      active = false;
      if (workspaceSessionCommands.getState().taskId === taskId) {
        workspaceSessionCommands.clear();
      }
      clearWorkspaceUi();
    };
  }, [clearWorkspaceUi, setTaskId, t, taskId]);

  const execute = useCallback(async (action: SandboxAction) => {
    setHistoricalExecution(null);
    try {
      await workspaceSessionCommands.run(action);
    } catch (error) {
      console.error('Workspace execution failed', error);
    }
  }, []);

  const submit = useCallback(async () => {
    setHistoricalExecution(null);
    try {
      await workspaceSessionCommands.submit();
    } catch (error) {
      console.error('Workspace submission failed', error);
    }
  }, []);

  const actionToolbar = (
    <div className="flex gap-2 items-center">
      <Button ghost icon={<SaveOutlined />} onClick={() => void saveNow()} disabled={isBusy}>
        {tCommon('save')}
      </Button>
      <Button
        ghost
        icon={<PlayCircleOutlined />}
        onClick={() => void execute('run')}
        disabled={isBusy || !isSandboxEnabled}
      >
        {tCommon('run')}
      </Button>
      <Button
        ghost
        icon={<ToolOutlined />}
        onClick={() => void execute('build')}
        disabled={isBusy || !isSandboxEnabled}
      >
        {t('actions.build')}
      </Button>
      <Button
        ghost
        icon={<CheckSquareOutlined />}
        onClick={() => void execute('lint')}
        disabled={isBusy || !isSandboxEnabled}
      >
        {t('actions.lint')}
      </Button>
      <Button
        ghost
        icon={<ExperimentOutlined />}
        onClick={() => void execute('test')}
        disabled={isBusy || !isSandboxEnabled}
      >
        {t('actions.test')}
      </Button>
      <div className="flex items-center gap-2 mx-2">
        <span className="text-sm text-gray-500 font-medium">{t('actions.sandbox')}</span>
        <Switch
          checked={isSandboxEnabled}
          onChange={setIsSandboxEnabled}
          disabled={isBusy}
          size="small"
        />
      </div>
      <Button
        type="primary"
        icon={<CloudUploadOutlined />}
        onClick={() => void submit()}
        disabled={isBusy || !isSandboxEnabled}
        loading={isBusy}
        className="font-medium"
      >
        {tCommon('submit')}
      </Button>
    </div>
  );

  const status = isSaving
    ? t('status.saving')
    : hasDirtyFiles
      ? t('status.unsaved')
      : t('status.saved');

  const handleHorizontalResize = useCallback(
    (sizes: number[]) => {
      const total = (sizes[0] ?? 0) + (sizes[1] ?? 0);
      if (sizes.length === 2 && total > 0) {
        setEditorLayoutSizes({
          leftPanel: Math.round(((sizes[0] ?? 0) / total) * 100),
          editor: Math.round(((sizes[1] ?? 0) / total) * 100),
        });
      }
    },
    [setEditorLayoutSizes],
  );

  const handleVerticalResize = useCallback(
    (sizes: number[]) => {
      const total = (sizes[0] ?? 0) + (sizes[1] ?? 0);
      if (sizes.length === 2 && total > 0) {
        setEditorLayoutSizes({ logs: Math.round(((sizes[1] ?? 0) / total) * 100) });
      }
    },
    [setEditorLayoutSizes],
  );

  if (phase === 'IDLE' || phase === 'LOADING') {
    return (
      <div className="h-screen flex flex-col bg-gray-50 items-center justify-center">
        <Spin size="large" />
        <div className="mt-4 text-gray-500 font-medium">{t('initializing')}</div>
      </div>
    );
  }

  const executionState = historicalExecution ?? execution;
  const leftPanel = <LeftPanel setExecutionState={setHistoricalExecution} />;
  const workArea = (
    <div className="h-full w-full flex flex-col">
      <Allotment vertical onChange={handleVerticalResize}>
        <Allotment.Pane minSize={180} preferredSize={`${String(100 - editorLayoutSizes.logs)}%`}>
          <EditorPanel />
        </Allotment.Pane>
        <Allotment.Pane minSize={100} preferredSize={`${String(editorLayoutSizes.logs)}%`}>
          <BottomPanel executionState={executionState} />
        </Allotment.Pane>
      </Allotment>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <TopNavbar
        title={t('title', { taskId: taskId ?? '' })}
        status={status}
        actions={actionToolbar}
      />
      <div className="flex-1 min-h-0 overflow-hidden">
        {isNarrow ? (
          <div
            className="h-full flex flex-col overflow-auto"
            role="region"
            aria-label={t('aria.layout')}
          >
            <div className="flex-1 min-h-[220px] border-b bg-white">{leftPanel}</div>
            <div className="flex-1 min-h-[320px]">{workArea}</div>
          </div>
        ) : (
          <Allotment onChange={handleHorizontalResize}>
            <Allotment.Pane minSize={250} preferredSize={`${String(editorLayoutSizes.leftPanel)}%`}>
              {leftPanel}
            </Allotment.Pane>
            <Allotment.Pane minSize={400} preferredSize={`${String(editorLayoutSizes.editor)}%`}>
              {workArea}
            </Allotment.Pane>
          </Allotment>
        )}
      </div>
    </div>
  );
};

export default WorkspacePage;
