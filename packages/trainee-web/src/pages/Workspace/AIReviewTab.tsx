import React, { useEffect, useState } from 'react';
import { Card, Button, Typography, Spin, Alert } from 'antd';
import { CodeOutlined, SyncOutlined } from '@ant-design/icons';
import { AiReviewDTO } from '@lg-agent/contracts';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { store } from '../../store';
import { useTranslation } from 'react-i18next';

const { Text, Paragraph, Title } = Typography;

export interface AIReviewTabProps {
  submissionId: string;
  initialReview?: AiReviewDTO | null;
  status: string;
}

export const AIReviewTab: React.FC<AIReviewTabProps> = ({
  submissionId,
  initialReview,
  status,
}) => {
  const { t } = useTranslation('workspace');
  const [review, setReview] = useState<AiReviewDTO | null>(initialReview ?? null);
  const [loading, setLoading] = useState(
    !initialReview && (status === 'FAILED' || status === 'ERROR'),
  );
  const [error, setError] = useState<string | null>(null);

  const updateFileContent = useWorkspaceStore((state) => state.updateFileContent);

  useEffect(() => {
    if (initialReview) {
      setReview(initialReview);
      setLoading(false);
      return;
    }

    if (!submissionId) return;

    let mounted = true;
    let pollInterval: ReturnType<typeof setInterval> | undefined;

    const fetchReview = async () => {
      try {
        const token = store.getState().auth.token;
        const res = await fetch(`/api/v1/ai/tutor/review/${submissionId}`, {
          headers: { Authorization: `Bearer ${token ?? ''}` },
        });

        if (res.ok) {
          const data = (await res.json()) as AiReviewDTO;
          if (mounted) {
            setReview(data);
            setLoading(false);
            if (pollInterval) clearInterval(pollInterval);
          }
        } else if (res.status === 404) {
          // If auto-generation is still processing, it might not be ready yet
          // Keep polling every 2s for MVP if it's FAILED/ERROR
          if (status !== 'FAILED' && status !== 'ERROR') {
            if (mounted) setLoading(false);
            if (pollInterval) clearInterval(pollInterval);
          }
        } else {
          if (mounted) {
            setError(t('aiReview.fetchFailed'));
            setLoading(false);
            if (pollInterval) clearInterval(pollInterval);
          }
        }
      } catch (_err) {
        if (mounted) {
          setError(t('aiReview.networkError'));
          setLoading(false);
          if (pollInterval) clearInterval(pollInterval);
        }
      }
    };

    if (loading) {
      void fetchReview();
      pollInterval = setInterval(() => {
        void fetchReview();
      }, 2000);
    }

    return () => {
      mounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [submissionId, initialReview, status, loading]);

  const handleApplyFix = (file: string, content: string) => {
    updateFileContent(file, content);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-gray-400 flex-col gap-4">
        <Spin indicator={<SyncOutlined spin />} size="large" />
        <div>{t('aiReview.generating')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Alert type="error" message={error} />
      </div>
    );
  }

  if (!review) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-gray-500">
        {t('aiReview.noReview')}
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 overflow-y-auto bg-[#1e1e1e] text-gray-300">
      <Card
        size="small"
        className="mb-4 bg-[#2d2d2d] border-gray-600"
        title={<span className="text-white">{t('aiReview.summary')}</span>}
      >
        <Paragraph className="text-gray-300 m-0">{review.summary}</Paragraph>
      </Card>

      {review.suggestions.length > 0 && (
        <Card
          size="small"
          className="mb-4 bg-[#2d2d2d] border-gray-600"
          title={<span className="text-white">{t('aiReview.suggestions')}</span>}
        >
          <ul className="list-disc pl-5 m-0 text-gray-300">
            {review.suggestions.map((sug, i) => (
              <li key={i} className="mb-1">
                {sug}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {review.errors.length > 0 && (
        <div className="mt-4">
          <Title level={5} className="text-gray-300 mb-2 mt-0">
            {t('aiReview.issues')}
          </Title>
          <div className="flex flex-col gap-4">
            {review.errors.map((err, i) => {
              const fixFile =
                err.fix?.strategy === 'FULL_FILE' && err.fix.files.length > 0
                  ? err.fix.files[0]
                  : null;

              return (
                <Card
                  key={i}
                  size="small"
                  className="bg-[#2a2626] border-red-900 border"
                  title={
                    <div className="flex justify-between items-center text-red-400">
                      <span className="font-mono text-sm">
                        {err.file} {err.line ? `:${String(err.line)}` : ''}
                      </span>
                      {fixFile && (
                        <Button
                          size="small"
                          type="primary"
                          danger
                          icon={<CodeOutlined />}
                          onClick={() => {
                            handleApplyFix(fixFile.path, fixFile.content);
                          }}
                        >
                          {t('aiReview.applyFix')}
                        </Button>
                      )}
                    </div>
                  }
                >
                  <Text className="text-gray-300">{err.message}</Text>
                  {fixFile && (
                    <div className="mt-3 p-2 bg-[#1a1a1a] rounded font-mono text-xs overflow-auto max-h-[300px]">
                      <pre className="text-green-400 m-0">{fixFile.content}</pre>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
