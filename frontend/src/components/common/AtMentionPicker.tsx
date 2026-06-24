import { useState, useRef, useEffect } from 'react';
import type { CanvasNode } from '../../types';

interface Props {
  nodes: CanvasNode[];
  onSelect: (node: CanvasNode) => void;
  onClose: () => void;
  position: { x: number; y: number };
}

export function AtMentionPicker({ nodes, onSelect, onClose, position }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);

  const availableNodes = nodes;
  const safeLeft = Math.max(16, Math.min(position.x, window.innerWidth - 260));
  const safeTop = Math.max(16, Math.min(position.y, window.innerHeight - 320));

  useEffect(() => {
    setSelectedIndex(0);
  }, [availableNodes.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, Math.max(availableNodes.length - 1, 0)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (availableNodes[selectedIndex]) {
          onSelect(availableNodes[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [availableNodes, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (availableNodes.length === 0) {
    return (
      <div
        ref={pickerRef}
        style={{
          position: 'fixed',
          left: safeLeft,
          top: safeTop,
          minWidth: 200,
          padding: 12,
          background: 'rgba(255, 251, 245, 0.98)',
          border: '1px solid #d9cfc1',
          borderRadius: 16,
          boxShadow: '0 14px 34px rgba(30, 32, 35, 0.12)',
          zIndex: 3000,
          fontSize: 13,
          color: '#6f746f'
        }}
      >
        暂无可引用输入节点
      </div>
    );
  }

  return (
    <div
      ref={pickerRef}
      style={{
        position: 'fixed',
        left: safeLeft,
        top: safeTop,
        minWidth: 220,
        maxHeight: 300,
        overflowY: 'auto',
        background: 'rgba(255, 251, 245, 0.98)',
        border: '1px solid #d9cfc1',
        borderRadius: 16,
        boxShadow: '0 14px 34px rgba(30, 32, 35, 0.12)',
        zIndex: 3000,
        padding: 8
      }}
    >
      <div style={{ padding: '6px 10px', fontSize: 11, color: '#7b7369', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        当前输入节点
      </div>
      {availableNodes.map((node, index) => (
        <div
          key={node.id}
          onClick={() => onSelect(node)}
          style={{
            padding: '8px 12px',
            borderRadius: 12,
            cursor: 'pointer',
            background: index === selectedIndex ? 'rgba(79, 141, 99, 0.12)' : 'transparent',
            color: index === selectedIndex ? '#2a5f3d' : '#191c20',
            marginBottom: 4,
            transition: 'background 0.15s ease'
          }}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <div style={{ fontWeight: 600, fontSize: 13 }}>
            {node.name}
          </div>
          <div style={{ fontSize: 11, color: index === selectedIndex ? '#4f8d63' : '#6f746f', marginTop: 2 }}>
            {node.type === 'text' ? '文本输入' : node.type === 'image' ? '图片输入' : '视频输入'}
          </div>
        </div>
      ))}
    </div>
  );
}
