import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  message,
  Modal,
  Row,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { ReloadOutlined, SearchOutlined, SwapOutlined } from '@ant-design/icons';
import type {
  CitationDTO,
  CitationOpenResponseDTO,
  RetrievalIndexItemDTO,
  RetrievalPreviewResponseDTO,
} from '@lg-agent/contracts';
import request from '../../utils/request';
import { useTranslation } from 'react-i18next';

export default function Retrieval() {
  const { t } = useTranslation('admin');
  const [indexes, setIndexes] = useState<RetrievalIndexItemDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<RetrievalPreviewResponseDTO>();
  const [citationPreview, setCitationPreview] = useState<CitationOpenResponseDTO>();

  const loadIndexes = useCallback(async () => {
    setLoading(true);
    try {
      setIndexes(await request.get<unknown, RetrievalIndexItemDTO[]>('/ai/retrieval/indexes'));
    } catch {
      message.error('无法加载检索索引状态');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIndexes();
  }, [loadIndexes]);

  const runPreview = async (values: { taskId: string; content: string; activeFile?: string }) => {
    try {
      setPreview(
        await request.post<unknown, RetrievalPreviewResponseDTO>('/ai/retrieval/preview', {
          action: 'chat',
          ...values,
        }),
      );
    } catch {
      message.error('预览失败：请检查任务权限和索引状态');
    }
  };

  const activate = async (item: RetrievalIndexItemDTO) => {
    await request.post(`/ai/retrieval/indexes/${item.kind}/${item.id}/activate`, {});
    message.success('检索版本已切换');
    await loadIndexes();
  };

  const retry = async (item: RetrievalIndexItemDTO) => {
    await request.post(`/ai/retrieval/indexes/${item.kind}/${item.id}/retry`, {});
    message.success('索引重试已排队');
    await loadIndexes();
  };

  const openCitation = async (citation: CitationDTO) => {
    setCitationPreview(
      await request.post<unknown, CitationOpenResponseDTO>(
        '/ai/retrieval/citations/open',
        citation,
      ),
    );
  };

  return (
    <Space direction="vertical" size="large" className="w-full">
      <Typography.Title level={2}>{t('retrieval.title')}</Typography.Title>
      <Row gutter={16}>
        <Col xs={24} lg={10}>
          <Card title={t('retrieval.previewTitle')}>
            <Form<{ taskId: string; content: string; activeFile?: string }>
              layout="vertical"
              onFinish={(values) => void runPreview(values)}
            >
              <Form.Item name="taskId" label={t('retrieval.taskId')} rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="content" label={t('retrieval.query')} rules={[{ required: true }]}>
                <Input.TextArea rows={3} />
              </Form.Item>
              <Form.Item name="activeFile" label={t('retrieval.activeFile')}>
                <Input placeholder="src/example.ts" />
              </Form.Item>
              <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                {t('retrieval.preview')}
              </Button>
            </Form>
            {preview ? (
              <div className="mt-4">
                <Descriptions size="small" column={1} bordered>
                  <Descriptions.Item label={t('retrieval.route')}>
                    {t(`retrieval.routes.${preview.traceSummary.route}`, {
                      defaultValue: preview.traceSummary.route,
                    })}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('retrieval.reasons')}>
                    {preview.traceSummary.routeReasons?.join(', ') ?? '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('retrieval.candidates')}>
                    {preview.traceSummary.totalCandidates} / {preview.traceSummary.evidenceCount}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('retrieval.budget')}>
                    {preview.context.budget.usedEvidence} / {preview.context.budget.total}{' '}
                    {t('retrieval.tokens')}
                  </Descriptions.Item>
                </Descriptions>
                {preview.context.evidence.length === 0 ? (
                  <Alert
                    className="mt-3"
                    type="warning"
                    showIcon
                    message="证据不足或索引不可用"
                    description="检查下方索引状态、失败原因与活动版本。"
                  />
                ) : (
                  <ol className="mt-3 pl-5">
                    {preview.context.evidence.map((item, index) => (
                      <li key={item.id}>
                        <Button
                          type="link"
                          className="h-auto px-0"
                          onClick={() => {
                            void openCitation(item.citation);
                          }}
                        >
                          [{String(index + 1)}] {item.citation.title} ·{' '}
                          {item.citation.locator.path ??
                            item.citation.locator.heading ??
                            item.citation.uri}{' '}
                          · {item.citation.revision} · {t('retrieval.score')}{' '}
                          {item.score.toFixed(2)}
                        </Button>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ) : null}
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card
            title={t('retrieval.indexVersions')}
            extra={
              <Button icon={<ReloadOutlined />} onClick={() => void loadIndexes()}>
                {t('retrieval.refresh')}
              </Button>
            }
          >
            <Table
              rowKey="id"
              loading={loading}
              dataSource={indexes}
              pagination={{ pageSize: 8 }}
              columns={[
                {
                  title: t('retrieval.source'),
                  render: (_, item: RetrievalIndexItemDTO) => (
                    <>
                      <Tag color={item.kind === 'CODE' ? 'purple' : 'blue'}>
                        {t(`retrieval.kinds.${item.kind}`, { defaultValue: item.kind })}
                      </Tag>
                      {item.sourceName}
                    </>
                  ),
                },
                { title: t('retrieval.revision'), dataIndex: 'revision', ellipsis: true },
                {
                  title: t('retrieval.status'),
                  render: (_, item: RetrievalIndexItemDTO) => (
                    <Space direction="vertical" size={0}>
                      <Tag color={item.readyAt ? 'green' : item.failureReason ? 'red' : 'gold'}>
                        {t(`retrieval.statuses.${item.status}`, { defaultValue: item.status })}
                      </Tag>
                      {item.failureReason ? (
                        <Typography.Text type="danger" className="text-xs">
                          {item.failureReason}
                        </Typography.Text>
                      ) : null}
                    </Space>
                  ),
                },
                {
                  title: t('retrieval.version'),
                  render: (_, item: RetrievalIndexItemDTO) =>
                    item.failureReason ? (
                      <Button
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={() => void retry(item)}
                      >
                        {t('retrieval.retry')}
                      </Button>
                    ) : item.active ? (
                      <Tag color="cyan">{t('retrieval.active')}</Tag>
                    ) : (
                      <Button
                        size="small"
                        icon={<SwapOutlined />}
                        disabled={!item.readyAt}
                        onClick={() => void activate(item)}
                      >
                        {t('retrieval.activate')}
                      </Button>
                    ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
      <Modal
        open={Boolean(citationPreview)}
        title={citationPreview?.citation.title}
        footer={null}
        onCancel={() => {
          setCitationPreview(undefined);
        }}
      >
        {citationPreview?.available ? (
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded bg-slate-950 p-3 text-slate-100">
            {citationPreview.content}
          </pre>
        ) : (
          <Alert
            type="warning"
            showIcon
            message={citationPreview?.errorCode ?? t('retrieval.accessDenied')}
            description={citationPreview?.recovery ?? t('retrieval.accessRecovery')}
          />
        )}
      </Modal>
    </Space>
  );
}
