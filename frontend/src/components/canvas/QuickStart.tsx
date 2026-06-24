import { useCanvasStore } from '../../stores/canvasStore';

export function QuickStart() {
  const { nodes, addNode } = useCanvasStore();

  if (nodes.length > 0) return null;

  const items: Array<{ type: 'text' | 'image' | 'video'; label: string }> = [
    { type: 'video', label: '视频' },
    { type: 'image', label: '图片' },
    { type: 'text', label: '文本' }
  ];

  return (
    <div style={{
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      gap: 18,
      pointerEvents: 'none'
    }}>
      {items.map(item => (
        <button
          key={item.type}
          title={`快速新建${item.label}`}
          onClick={() => addNode(item.type, { x: 220, y: 260 })}
          style={{
            height: 52,
            minWidth: 132,
            padding: '0 28px',
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,.72)',
            background: 'rgba(255,251,245,.92)',
            boxShadow: '0 8px 22px rgba(30,32,35,.05)',
            cursor: 'pointer',
            pointerEvents: 'auto',
            fontSize: 18,
            fontWeight: 600,
            color: '#191c20'
          }}
        >
          {item.label}
        </button>
      ))}
      <span style={{ color: '#6f746f', marginLeft: 10, fontSize: 18, fontWeight: 600 }}>点击快速新建</span>
    </div>
  );
}
