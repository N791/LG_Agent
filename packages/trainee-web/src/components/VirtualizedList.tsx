import React from 'react';
import { List } from 'antd';
import VirtualList from 'rc-virtual-list';

interface VirtualizedListProps<T> {
  data: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  height?: number;
  itemHeight?: number;
  itemKey?: (item: T) => React.Key;
  onScroll?: (e: React.UIEvent<HTMLElement, UIEvent>) => void;
  emptyText?: string;
  className?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export function VirtualizedList<T>({
  data,
  renderItem,
  height = 400,
  itemHeight = 47,
  itemKey,
  onScroll,
  emptyText,
  className,
  header,
  footer,
}: VirtualizedListProps<T>) {
  return (
    <List 
      className={className} 
      locale={{ emptyText: emptyText || 'No data' }}
      header={header}
      footer={footer}
    >
      <VirtualList
        data={data}
        height={height}
        itemHeight={itemHeight}
        itemKey={itemKey || ((item: any) => item.id || item.key || JSON.stringify(item))}
        onScroll={onScroll}
      >
        {(item: T, index: number) => renderItem(item, index)}
      </VirtualList>
    </List>
  );
}
