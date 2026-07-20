import React from 'react';
import { Badge, Popover, List, Typography, Button, Tag, Avatar } from 'antd';
import { VirtualizedList } from './VirtualizedList';
import { BellOutlined, CheckOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNotifications } from '../contexts/NotificationContext';
import { formatDistanceToNow } from 'date-fns';

const { Text } = Typography;

export const NotificationBell: React.FC = () => {
  const { 
    notifications = [], 
    unreadCount, 
    loading, 
    markAsRead, 
    markAllAsRead, 
    archive,
    loadMore,
    hasMore 
  } = useNotifications();

  const content = (
    <div className="w-80 max-h-96 flex flex-col">
      <div className="flex justify-between items-center px-4 py-2 border-b border-gray-100">
        <Text strong>Notifications</Text>
        <Button 
          type="link" 
          size="small" 
          onClick={() => markAllAsRead()}
          disabled={unreadCount === 0}
        >
          Mark all as read
        </Button>
      </div>
      
      <div style={{ height: 350, overflow: 'hidden' }}>
        <VirtualizedList
          data={notifications}
          height={350}
          emptyText="No notifications"
          renderItem={(item: any) => (
            <List.Item
              style={{
                cursor: 'pointer',
                backgroundColor: item.status === 'UNREAD' ? '#f0f5ff' : '#fff',
                padding: '12px 16px',
                borderBottom: '1px solid #f0f0f0'
              }}
              actions={[
                item.status === 'UNREAD' && (
                  <Button 
                    key="read" 
                    type="text" 
                    icon={<CheckOutlined />} 
                    size="small"
                    onClick={() => markAsRead(item.id)}
                  />
                ),
                <Button 
                  key="archive" 
                  type="text" 
                  danger 
                  icon={<DeleteOutlined />} 
                  size="small"
                  onClick={() => archive(item.id)}
                />
              ].filter(Boolean) as React.ReactNode[]}
            >
              <List.Item.Meta
                avatar={
                  <Avatar style={{ backgroundColor: item.status === 'UNREAD' ? '#1890ff' : '#d9d9d9' }}>
                    {item.type?.charAt(0) || 'N'}
                  </Avatar>
                }
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong={item.status === 'UNREAD'} className="text-sm">{item.title}</Text>
                    {item.priority === 'HIGH' && <Tag color="red">High</Tag>}
                  </div>
                }
                description={
                  <div className="flex flex-col mt-1">
                    <Text className="text-xs text-gray-500 mb-1 line-clamp-2">
                      {item.message}
                    </Text>
                    <Text type="secondary" className="text-[10px]">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </Text>
                  </div>
                }
              />
            </List.Item>
          )}
        />
        {hasMore && (
          <div className="text-center p-2">
            <Button size="small" onClick={loadMore} loading={loading}>
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      placement="bottomRight"
      overlayClassName="p-0"
      arrow={false}
    >
      <Badge count={unreadCount} size="small" offset={[-2, 2]}>
        <Button 
          type="text" 
          icon={<BellOutlined className="text-gray-300 hover:text-white text-lg" />} 
          className="flex items-center justify-center border-0 hover:bg-white/10"
        />
      </Badge>
    </Popover>
  );
};
