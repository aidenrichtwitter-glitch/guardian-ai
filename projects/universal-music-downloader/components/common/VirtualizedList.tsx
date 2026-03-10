'use client';
import React from 'react';
import { FixedSizeList as List } from 'react-window';

interface VirtualizedListProps {
    items: any[];
    renderItem: (item: any, index: number) => React.ReactNode;
    height: number;
    itemHeight?: number;
}

export function VirtualizedList({
    items,
    renderItem,
    height,
    itemHeight = 120,
}: VirtualizedListProps) {
    const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
        <div style={style}>
            {renderItem(items[index], index)}
        </div>
    );

    return (
        <List
            height={height}
            itemCount={items.length}
            itemSize={itemHeight}
            width="100%"
        >
            {Row}
        </List>
    );
}
