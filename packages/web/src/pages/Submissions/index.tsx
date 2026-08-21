import React, { useEffect, useState } from 'react';
import {
  Alert,
  Card,
  Collapse,
  List,
  Table,
  Button,
  Space,
  Modal,
  Typography,
  message,
  Tag,
} from 'antd';
import { submissionsService, Submission } from '../../services/submissions';
import { reportsService } from '../../services/reports';
import { DownloadOutlined, EyeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { AiReviewDTO, AiReviewSeverity } from '@lg-agent/contracts';

const { Title } = Typography;

const Submissions: React.FC = () => {
  const { t } = useTranslation('submissions');
  const [data, setData] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedReview, setSelectedReview] = useState<AiReviewDTO | null>(null);
  const [selectedExecutionReport, setSelectedExecutionReport] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await submissionsService.findAll({});
      setData((res as unknown as { data?: Submission[] }).data ?? (res as unknown as Submission[]));
    } catch (_error) {
      void message.error(t('loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await reportsService.exportReport('submissions', 'csv');
      // Create a blob URL and trigger download
      const url = window.URL.createObjectURL(new Blob([response as unknown as BlobPart]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `submissions_export_${String(new Date().getTime())}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      void message.success(t('exportSuccess'));
    } catch (_error) {
      void message.error(t('exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const showReport = async (record: Submission) => {
    setIsModalVisible(true);
    setSelectedExecutionReport(record.report ?? null);
    setReviewError(null);
    setSelectedReview(null);
    setReviewLoading(true);
    try {
      setSelectedReview(await submissionsService.getAiReview(record.id));
    } catch (_error) {
      setReviewError(t('loadFailed'));
    } finally {
      setReviewLoading(false);
    }
  };

  const columns = [
    { title: t('columns.id'), dataIndex: 'id', key: 'id', ellipsis: true },
    {
      title: t('columns.trainee'),
      key: 'trainee',
      render: (_: unknown, record: Submission) => record.user?.username ?? t('common:unknown'),
    },
    {
      title: t('columns.task'),
      key: 'task',
      render: (_: unknown, record: Submission) => record.task?.title ?? t('common:unknown'),
    },
    {
      title: t('columns.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'default';
        if (status === 'PASSED') color = 'success';
        if (status === 'FAILED') color = 'error';
        if (status === 'RUNNING') color = 'processing';
        return <Tag color={color}>{t(`statuses.${status}`, { defaultValue: status })}</Tag>;
      },
    },
    { title: t('columns.score'), dataIndex: 'score', key: 'score' },
    {
      title: t('columns.date'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: t('columns.action'),
      key: 'action',
      render: (_: unknown, record: Submission) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => {
              void showReport(record);
            }}
          >
            {t('columns.aiReview')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Title level={3} style={{ margin: 0 }}>
          {t('title')}
        </Title>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={() => void handleExport()}
          loading={exporting}
        >
          {t('exportCsv')}
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={t('aiReviewReport')}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
        }}
        footer={[
          <Button
            key="close"
            onClick={() => {
              setIsModalVisible(false);
            }}
          >
            {t('buttons.close')}
          </Button>,
        ]}
        width={800}
      >
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {reviewError ? <Alert type="warning" showIcon message={reviewError} /> : null}
          {reviewLoading ? <div className="py-8 text-center">{t('review.loading')}</div> : null}
          {selectedReview ? (
            <Space direction="vertical" size="middle" className="w-full">
              <Card size="small" title={t('review.summary')}>
                {selectedReview.summary}
              </Card>
              <List
                header={t('review.findings')}
                bordered
                locale={{ emptyText: t('review.noFindings') }}
                dataSource={selectedReview.findings ?? []}
                renderItem={(finding) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space>
                          <Tag color={severityColor(finding.severity)}>
                            {t(`severities.${finding.severity}`, {
                              defaultValue: finding.severity,
                            })}
                          </Tag>
                          <span>{finding.title}</span>
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size={2}>
                          <span>
                            <strong>{t('review.evidence')}</strong> {finding.evidence}
                          </span>
                          <span>
                            <strong>{t('review.suggestion')}</strong> {finding.suggestion}
                          </span>
                          {finding.file ? (
                            <code>
                              {finding.file}
                              {finding.line ? `:${String(finding.line)}` : ''}
                            </code>
                          ) : null}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
              <Card size="small" title={t('review.suggestions')}>
                <List
                  size="small"
                  dataSource={selectedReview.suggestions}
                  renderItem={(item) => <List.Item>{item}</List.Item>}
                />
              </Card>
              <Alert
                showIcon
                type={selectedReview.retrievalState?.status === 'SUPPORTED' ? 'success' : 'info'}
                message={t('review.retrieval', {
                  status: t(`statuses.${selectedReview.retrievalState?.status ?? 'UNAVAILABLE'}`),
                })}
                description={selectedReview.retrievalState?.note ?? t('review.noRetrieval')}
              />
            </Space>
          ) : null}
          {selectedExecutionReport ? (
            <Collapse
              className="mt-4"
              items={[
                {
                  key: 'execution',
                  label: t('review.executionReport'),
                  children: (
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(selectedExecutionReport, null, 2)}
                    </pre>
                  ),
                },
              ]}
            />
          ) : null}
        </div>
      </Modal>
    </div>
  );
};

export default Submissions;

function severityColor(severity: AiReviewSeverity): string {
  if (severity === 'CRITICAL' || severity === 'HIGH') return 'red';
  if (severity === 'MEDIUM') return 'orange';
  if (severity === 'LOW') return 'gold';
  return 'blue';
}
