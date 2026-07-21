import React, { useEffect, useState } from 'react';
import { Input, Spin, Tag, Button } from 'antd';

import { BookOutlined, ArrowLeftOutlined, SearchOutlined, ReadOutlined } from '@ant-design/icons';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { KnowledgeDocumentDTO, KnowledgeSearchResultDTO } from '@lg-agent/contracts';
import { knowledgeService } from '../../services/knowledgeService';
import { useTranslation } from 'react-i18next';

export const KnowledgePanel: React.FC = () => {
  const { t } = useTranslation('workspace');
  const [documents, setDocuments] = useState<KnowledgeDocumentDTO[]>([]);
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResultDTO[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDocumentDTO | null>(null);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    knowledgeService
      .getDocuments()
      .then((docs) => {
        if (mounted) {
          setDocuments(docs);
          setIsLoading(false);
        }
      })
      .catch(console.error);
    return () => {
      mounted = false;
    };
  }, []);

  const handleSearch = async (value: string) => {
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const results = await knowledgeService.search(value);
      setSearchResults(results);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDocClick = async (docId: string) => {
    try {
      const doc = await knowledgeService.getDocument(docId);
      setSelectedDoc(doc);
    } catch (err) {
      console.error(err);
    }
  };

  if (selectedDoc) {
    return (
      <div className="h-full flex flex-col bg-white">
        <div className="flex-shrink-0 p-3 border-b border-gray-100 flex items-center gap-2 sticky top-0 bg-white z-10 shadow-sm">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => {
              setSelectedDoc(null);
            }}
            className="flex-shrink-0"
          />
          <h2
            className="text-sm font-semibold text-gray-800 m-0 truncate"
            title={selectedDoc.title}
          >
            {selectedDoc.title}
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700">
            <Markdown remarkPlugins={[remarkGfm]}>{selectedDoc.content}</Markdown>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex-shrink-0 p-4 border-b border-gray-100 bg-gray-50/50">
        <h2 className="text-sm font-semibold text-gray-800 m-0 mb-3 flex items-center gap-2">
          <ReadOutlined /> {t('knowledgePanel.title')}
        </h2>
        <Input
          prefix={<SearchOutlined className="text-gray-400" />}
          placeholder={t('knowledgePanel.searchPlaceholder')}
          allowClear
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!e.target.value) {
              setSearchResults([]);
            }
          }}
          onPressEnter={(e) => {
            void handleSearch((e.target as HTMLInputElement).value);
          }}
          className="rounded-md"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Spin />
          </div>
        ) : searchQuery && searchResults.length > 0 ? (
          <div className="p-2">
            <div className="px-2 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
              {t('knowledgePanel.searchResults')}
            </div>
            {searchResults.map((item, idx) => (
              <div
                key={idx}
                className="cursor-pointer hover:bg-blue-50/50 p-3 rounded-md mb-1 border border-transparent hover:border-blue-100 transition-colors group"
                onClick={() => {
                  void handleDocClick(item.source.replace('.md', ''));
                }}
              >
                <div className="flex flex-col w-full">
                  <div className="text-sm font-medium flex justify-between items-center text-gray-800 group-hover:text-blue-600">
                    <span className="truncate pr-2">{item.source}</span>
                    <Tag
                      color="blue"
                      className="m-0 text-[10px] leading-tight px-1.5 flex-shrink-0 border-0 bg-blue-100/50"
                    >
                      Score: {item.score.toFixed(2)}
                    </Tag>
                  </div>
                  <div className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">
                    {item.chunkContent}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-2">
            <div className="px-2 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
              {t('knowledgePanel.referenceDocs')}
            </div>
            {documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-gray-400 gap-2">
                <BookOutlined className="text-3xl text-gray-200" />
                <span className="text-sm">{t('knowledgePanel.emptyState')}</span>
              </div>
            ) : (
              documents.map((item) => (
                <div
                  key={item.id}
                  className="cursor-pointer hover:bg-gray-50 p-2.5 rounded-md mb-1 flex items-center gap-3 border border-transparent hover:border-gray-200 transition-colors"
                  onClick={() => {
                    void handleDocClick(item.id);
                  }}
                >
                  <div className="w-8 h-8 rounded bg-blue-50 text-blue-500 flex items-center justify-center flex-shrink-0">
                    <BookOutlined />
                  </div>
                  <span className="text-sm text-gray-700 font-medium truncate">{item.title}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
