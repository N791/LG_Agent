import { useState } from 'react';
import { Alert, Button, Modal, Space, Tag, Typography } from 'antd';
import { CodeOutlined, FileTextOutlined, LinkOutlined } from '@ant-design/icons';
import type { CitationDTO, CitationOpenResponseDTO, EvidenceSupportDTO } from '@lg-agent/contracts';
import { aiService } from '../../services/aiService';
import { workspaceSessionCommands } from '../../modules/workspace-session';
import { useWorkspaceStore } from '../../store/workspaceStore';

interface CitationListProps {
  citations: CitationDTO[];
  evidenceSupport?: EvidenceSupportDTO;
  degraded?: boolean;
}

function locatorLabel(citation: CitationDTO): string {
  const locator = citation.locator;
  if (citation.repositorySnapshotId) {
    const lines =
      locator.startLine === undefined
        ? ''
        : `:${String(locator.startLine)}${locator.endLine ? `-${String(locator.endLine)}` : ''}`;
    return `${locator.path ?? citation.title}${lines}${locator.symbol ? ` · ${locator.symbol}` : ''}`;
  }
  return [locator.heading, locator.page === undefined ? undefined : `p.${String(locator.page)}`]
    .filter(Boolean)
    .join(' · ');
}

export function CitationList({
  citations,
  evidenceSupport = 'INSUFFICIENT',
  degraded = false,
}: CitationListProps) {
  const [preview, setPreview] = useState<CitationOpenResponseDTO>();
  const [loadingId, setLoadingId] = useState<string>();
  const setCursorPosition = useWorkspaceStore((state) => state.setCursorPosition);
  const supportColor =
    evidenceSupport === 'SUPPORTED' ? 'green' : evidenceSupport === 'INFERENCE' ? 'gold' : 'red';

  const open = async (citation: CitationDTO) => {
    setLoadingId(citation.id);
    try {
      setPreview(await aiService.openCitation(citation));
    } finally {
      setLoadingId(undefined);
    }
  };

  const jumpToCode = (citation: CitationDTO) => {
    const path = citation.locator.path;
    if (!path) return;
    const lineNumber = citation.locator.startLine ?? 1;
    setCursorPosition(path, { lineNumber, column: 1 });
    workspaceSessionCommands.open(path);
    setPreview(undefined);
  };

  return (
    <div className="mt-3 border-t border-gray-100 pt-2">
      <Space size={4} wrap>
        <Tag color={supportColor}>
          {evidenceSupport === 'SUPPORTED'
            ? '证据支持'
            : evidenceSupport === 'INFERENCE'
              ? '模型推断'
              : '证据不足'}
        </Tag>
        {degraded ? <Tag color="orange">索引降级</Tag> : null}
      </Space>
      {citations.length > 0 ? (
        <div className="mt-2 flex flex-col gap-1">
          {citations.map((citation, index) => (
            <Button
              key={citation.id}
              type="link"
              size="small"
              loading={loadingId === citation.id}
              icon={citation.repositorySnapshotId ? <CodeOutlined /> : <FileTextOutlined />}
              onClick={() => {
                void open(citation);
              }}
              className="h-auto justify-start whitespace-normal px-0 text-left"
            >
              [{String(index + 1)}] {citation.title} · {locatorLabel(citation)} ·{' '}
              {citation.revision.slice(0, 12)}
            </Button>
          ))}
        </div>
      ) : null}
      <Modal
        open={Boolean(preview)}
        title={preview?.citation.title}
        onCancel={() => {
          setPreview(undefined);
        }}
        footer={null}
      >
        {preview?.available ? (
          <>
            <Typography.Paragraph type="secondary">
              <LinkOutlined /> {locatorLabel(preview.citation)} · {preview.citation.revision}
            </Typography.Paragraph>
            <Typography.Paragraph>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded bg-gray-950 p-3 text-gray-100">
                {preview.content}
              </pre>
            </Typography.Paragraph>
            {preview.citation.repositorySnapshotId && preview.citation.locator.path ? (
              <Button
                type="primary"
                icon={<CodeOutlined />}
                onClick={() => {
                  jumpToCode(preview.citation);
                }}
              >
                跳转到文件与行
              </Button>
            ) : null}
          </>
        ) : (
          <Alert
            type="warning"
            showIcon
            message="来源当前不可访问"
            description={preview?.recovery}
          />
        )}
      </Modal>
    </div>
  );
}
