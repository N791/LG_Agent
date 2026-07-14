import React, { useState } from 'react';
import { Card, Input, Button, Breadcrumb, message, Alert } from 'antd';
import { ArrowLeftOutlined, RobotOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';

const { TextArea } = Input;

export const GenerateTaskPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!document.trim()) {
      void message.error('请输入或粘贴文档内容');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/v1/ai/generate-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token ?? ''}`,
        },
        body: JSON.stringify({ document }),
      });

      if (!response.ok) {
        throw new Error('AI 生成失败，请重试');
      }

      const generatedDraft = (await response.json()) as unknown;
      void message.success('生成成功！请对草稿进行调整并保存。');

      // Navigate back to the Task Editor (or list) passing the draft state
      // For now we'll pass it via location state back to the List page which will pop open the modal
      // Or better: pass it to a new route for draft creation. Since edit route exists, we can use the list modal.
      navigate(`/courses/${courseId ?? ''}/tasks`, { state: { draftTask: generatedDraft } });
    } catch (e: unknown) {
      void message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Breadcrumb className="mb-4">
        <Breadcrumb.Item>
          <a
            onClick={() => {
              navigate('/courses');
            }}
          >
            课程管理
          </a>
        </Breadcrumb.Item>
        <Breadcrumb.Item>
          <a
            onClick={() => {
              navigate(`/courses/${courseId ?? ''}/tasks`);
            }}
          >
            任务管理
          </a>
        </Breadcrumb.Item>
        <Breadcrumb.Item>AI 生成任务</Breadcrumb.Item>
      </Breadcrumb>

      <div className="flex items-center gap-4 mb-6">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => {
            navigate(`/courses/${courseId ?? ''}/tasks`);
          }}
        >
          返回
        </Button>
        <h1 className="text-2xl font-bold mb-0">✨ AI 智能任务生成器</h1>
      </div>

      <Card>
        <Alert
          message="基于已有文档一键生成任务草稿"
          description="将需求文档、API 文档或技术博客（纯文本或 Markdown 格式）粘贴到下方。AI 将自动分析知识点，提取目标，并生成代码模板与自动化测试脚本的草稿。"
          type="info"
          showIcon
          className="mb-6"
        />

        <TextArea
          rows={15}
          placeholder="在此粘贴文档内容 (支持 Plain Text, Markdown)..."
          value={document}
          onChange={(e) => {
            setDocument(e.target.value);
          }}
          className="mb-4 font-mono text-sm"
        />

        <div className="flex justify-end">
          <Button
            type="primary"
            size="large"
            icon={<RobotOutlined />}
            loading={loading}
            onClick={() => void handleGenerate()}
            style={{ background: 'linear-gradient(90deg, #1890ff, #722ed1)', border: 'none' }}
          >
            {loading ? 'AI 正在努力思考中...' : '开始生成'}
          </Button>
        </div>
      </Card>
    </div>
  );
};
