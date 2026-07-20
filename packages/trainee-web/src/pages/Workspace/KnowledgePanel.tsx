import React, { useEffect, useState } from 'react';
import { Input, Spin, Modal, Tag } from 'antd';
import { VirtualizedList } from '../../components/VirtualizedList';
import { List } from 'antd'; // keep for List.Item
import { BookOutlined } from '@ant-design/icons';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { KnowledgeDocumentDTO, KnowledgeSearchResultDTO } from '@lg-agent/contracts';
import { knowledgeService } from '../../services/knowledgeService';

export const KnowledgePanel: React.FC = () => {
  const [documents, setDocuments] = useState<KnowledgeDocumentDTO[]>([]);
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResultDTO[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDocumentDTO | null>(null);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    knowledgeService.getDocuments()
      .then(docs => {
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
    setIsSearching(true);
    try {
      const results = await knowledgeService.search(value);
      setSearchResults(results);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
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

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-4 border-b border-gray-100">
        <Input.Search
          placeholder="Search Knowledge Base..."
          allowClear
          onSearch={handleSearch}
          onChange={(e) => setSearchQuery(e.target.value)}
          loading={isSearching}
        />
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex justify-center p-4"><Spin /></div>
        ) : searchQuery && searchResults.length > 0 ? (
          <VirtualizedList
            header={<div className="font-bold text-gray-500 text-xs uppercase">Search Results</div>}
            data={searchResults}
            height={400}
            renderItem={(item: any) => (
              <List.Item
                className="cursor-pointer hover:bg-blue-50 rounded px-2"
                onClick={() => handleDocClick(item.source.replace('.md', ''))}
              >
                <div className="flex flex-col w-full">
                  <div className="text-sm font-medium flex justify-between">
                    <span>{item.source}</span>
                    <Tag color="blue">Score: {item.score.toFixed(2)}</Tag>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {item.chunkContent}
                  </div>
                </div>
              </List.Item>
            )}
          />
        ) : (
          <VirtualizedList
            header={<div className="font-bold text-gray-500 text-xs uppercase">Wiki Reference</div>}
            data={documents}
            height={400}
            renderItem={(item: any) => (
              <List.Item
                className="cursor-pointer hover:bg-blue-50 rounded px-2"
                onClick={() => handleDocClick(item.id)}
              >
                <List.Item.Meta
                  avatar={<BookOutlined className="text-blue-500" />}
                  title={<span className="text-sm">{item.title}</span>}
                />
              </List.Item>
            )}
          />
        )}
      </div>

      <Modal
        title={selectedDoc?.title}
        open={!!selectedDoc}
        onCancel={() => setSelectedDoc(null)}
        footer={null}
        width={800}
      >
        <div className="prose prose-sm dark:prose-invert max-w-none max-h-[60vh] overflow-y-auto">
          <Markdown remarkPlugins={[remarkGfm]}>{selectedDoc?.content ?? ''}</Markdown>
        </div>
      </Modal>
    </div>
  );
};
