import { useState } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import { importWorkflow, parseWorkflowFile, validateWorkflow } from '../../utils/workflowIO';

const menuButtonStyle: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 999,
  display: 'grid',
  placeItems: 'center',
  border: 'none',
  cursor: 'pointer',
  fontSize: 16,
  background: 'transparent'
};

export function Toolbar() {
  const { addNode, importWorkflow: importWF } = useCanvasStore();
  const [open, setOpen] = useState(false);

  const handleAddNode = (type: 'text' | 'image' | 'video') => {
    const position = { x: 200, y: 200 };
    addNode(type, position);
    setOpen(false);
  };

  const handleOpenWorkflow = async () => {
    try {
      const file = await importWorkflow();
      const workflow = await parseWorkflowFile(file);
      const validation = validateWorkflow(workflow);
      if (!validation.valid) {
        alert('工作流文件格式无效');
        return;
      }
      importWF(workflow);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <div style={{
        position: 'fixed',
        left: 18,
        top: 250,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '10px 0',
        width: 48,
        borderRadius: 999,
        border: '1px solid #d9cfc1',
        background: 'rgba(255, 251, 245, 0.82)',
        alignItems: 'center',
        zIndex: 5000,
        pointerEvents: 'auto'
      }}>
        <button
          onClick={() => setOpen(v => !v)}
          title="添加节点"
          style={{
            width: 38,
            height: 38,
            borderRadius: 999,
            display: 'grid',
            placeItems: 'center',
            background: '#191c20',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontSize: 18
          }}
        >
          {open ? '✕' : '＋'}
        </button>
        <button title="打开工作流" style={menuButtonStyle} onClick={handleOpenWorkflow}>📂</button>
      </div>

      {open && (
        <div style={{
          position: 'fixed',
          left: 78,
          top: 225,
          width: 220,
          borderRadius: 22,
          border: '1px solid rgba(255,255,255,.75)',
          background: 'rgba(255,251,245,.96)',
          boxShadow: '0 20px 50px rgba(34,36,39,.12)',
          padding: 12,
          zIndex: 5050
        }}>
          {[
            { key: 'text', label: '文本节点', desc: '编写提示词与脚本' },
            { key: 'image', label: '图片节点', desc: '上传图片或生成图片' },
            { key: 'video', label: '视频节点', desc: '生成视频结果' }
          ].map(item => (
            <button
              key={item.key}
              onClick={() => handleAddNode(item.key as 'text' | 'image' | 'video')}
              style={{
                width: '100%',
                textAlign: 'left',
                border: 'none',
                background: 'transparent',
                borderRadius: 16,
                padding: '10px 12px',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{item.label}</div>
              <div style={{ fontSize: 11, color: '#6f746f', marginTop: 2 }}>{item.desc}</div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
