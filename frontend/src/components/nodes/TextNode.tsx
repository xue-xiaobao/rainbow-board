import { useMemo, useRef, useState, useEffect } from 'react';
import type { TextNode as TextNodeType, TextModelSettings } from '../../types';
import { useCanvasStore } from '../../stores/canvasStore';
import { generateText, getTextModelSettings } from '../../utils/api';
import { buildGenerateRequest } from '../../utils/helpers';
import { AtMentionPicker } from '../common/AtMentionPicker';

interface Props {
  node: TextNodeType;
  onClick: (id: string, e: React.MouseEvent) => void;
  onDragStart?: (id: string, e: React.MouseEvent) => void;
  onOutputPortMouseDown?: (id: string, e: React.MouseEvent) => void;
  onContextMenu?: (id: string, e: React.MouseEvent) => void;
  onInputPortMouseUp?: (id: string, e: React.MouseEvent) => void;
  onInputPortMouseEnter?: (id: string) => void;
  onInputPortMouseLeave?: (id: string) => void;
  isDragging?: boolean;
}

export function TextNode({ node, onClick, onDragStart, onOutputPortMouseDown, onContextMenu, onInputPortMouseUp, onInputPortMouseEnter, onInputPortMouseLeave, isDragging }: Props) {
  const { updateNode, nodes, edges } = useCanvasStore();
  const [isResizing, setIsResizing] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ x: 0, y: 0 });
  const [textModelSettings, setTextModelSettings] = useState<TextModelSettings>({ protocol: 'openai', apiUrl: '', apiKey: '', model: '' });
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const resizeStart = useRef({ y: 0, height: 0 });

  const isGenerateMode = node.data.mode === 'generate';
  const outputText = useMemo(() => {
    if (isGenerateMode) return node.data.result?.content || '';
    return node.data.content || '';
  }, [isGenerateMode, node.data.result?.content, node.data.content]);

  useEffect(() => {
    if (!isGenerateMode) return;
    getTextModelSettings().then((settings) => {
      setTextModelSettings(settings);
      const currentModel = node.data.config?.model;
      const configuredModel = settings.model || '';
      if (!currentModel && configuredModel) {
        updateNode(node.id, {
          data: {
            ...node.data,
            config: {
              ...(node.data.config || { prompt: '', model: configuredModel }),
              model: configuredModel,
            }
          }
        });
      }
    }).catch(() => {});
  }, [isGenerateMode]);

  const handleDirectChange = (value: string) => {
    updateNode(node.id, { data: { ...node.data, content: value } });
  };

  const handleConfigChange = (key: string, value: string) => {
    updateNode(node.id, { data: { ...node.data, config: { ...(node.data.config || { prompt: '', model: '' }), [key]: value } } });
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    resizeStart.current = {
      y: e.clientY,
      height: node.data.height || 120
    };
  };

  const handleResizeMove = (e: React.MouseEvent) => {
    if (!isResizing) return;
    const deltaY = e.clientY - resizeStart.current.y;
    const newHeight = Math.max(80, resizeStart.current.height + deltaY);
    updateNode(node.id, { data: { ...node.data, height: newHeight } as TextNodeType['data'] });
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
  };

  const getConnectedInputNodes = () => {
    return edges
      .filter(e => e.to === node.id)
      .map(e => nodes.find(n => n.id === e.from))
      .filter((n): n is any => !!n && n.type === 'text');
  };

  const getCaretScreenPosition = (textarea: HTMLTextAreaElement) => {
    const rect = textarea.getBoundingClientRect();
    const style = window.getComputedStyle(textarea);
    const lineHeight = parseFloat(style.lineHeight || '18') || 18;
    const paddingLeft = parseFloat(style.paddingLeft || '0') || 0;
    const paddingTop = parseFloat(style.paddingTop || '0') || 0;
    const textBeforeCursor = textarea.value.slice(0, textarea.selectionStart || 0);
    const lines = textBeforeCursor.split('\n');
    const currentLine = lines[lines.length - 1] || '';
    const approxCharWidth = parseFloat(style.fontSize || '13') * 0.56;
    const x = rect.left + paddingLeft + Math.min(currentLine.length * approxCharWidth, rect.width - paddingLeft - 32);
    const y = rect.top + paddingTop + (Math.max(lines.length - 1, 0) * lineHeight) + lineHeight + 8;
    return {
      x,
      y,
    };
  };

  const handlePromptInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPosition = e.target.selectionStart;
    textareaRef.current = e.target;
    if (value[cursorPosition - 1] === '@') {
      const caret = getCaretScreenPosition(e.target);
      setPickerPosition(caret);
      setShowPicker(true);
    }
    handleConfigChange('prompt', value);
  };

  const handleSelectNode = (selectedNode: any) => {
    if (!textareaRef.current) return;
    const value = textareaRef.current.value;
    const cursorPosition = textareaRef.current.selectionStart;
    const lastAt = value.lastIndexOf('@', cursorPosition - 1);
    if (lastAt === -1) return;
    const before = value.slice(0, lastAt);
    const after = value.slice(cursorPosition);
    const newValue = `${before}[@${selectedNode.name}]${after}`;
    handleConfigChange('prompt', newValue);
    setShowPicker(false);
    setTimeout(() => {
      textareaRef.current?.focus();
      const pos = lastAt + selectedNode.name.length + 3;
      textareaRef.current?.setSelectionRange(pos, pos);
    }, 0);
  };

  const handleGenerate = async () => {
    updateNode(node.id, {
      data: {
        ...node.data,
        result: {
          ...(node.data.result || {}),
          status: 'running',
          error: undefined,
          startedAt: new Date().toISOString(),
        }
      }
    });
    try {
      const request = buildGenerateRequest(node as any, nodes as any, edges as any);
      if (!request) throw new Error('请求构建失败');
      const activeModel = textModelSettings.model || '';
      request.body.model = activeModel;
      if (!request.body?.model) throw new Error('请先在设置中配置文本模型名称');
      const result = await generateText(request.body);
      updateNode(node.id, {
        data: {
          ...node.data,
          result: {
            status: 'success',
            content: result.content,
            error: undefined,
            startedAt: node.data.result?.startedAt || new Date().toISOString(),
          }
        }
      });
    } catch (err: any) {
      updateNode(node.id, {
        data: {
          ...node.data,
          result: {
            ...(node.data.result || {}),
            status: 'failed',
            error: err?.message || '文本生成失败',
            startedAt: node.data.result?.startedAt || new Date().toISOString(),
          }
        }
      });
    }
  };

  return (
    <div
      className="card"
      onClick={(e) => onClick(node.id, e)}
      onContextMenu={(e) => onContextMenu?.(node.id, e)}
      onMouseMove={handleResizeMove}
      onMouseUp={handleResizeEnd}
      onMouseLeave={handleResizeEnd}
      style={{
        position: 'absolute',
        left: node.position.x,
        top: node.position.y,
        width: 320,
        minHeight: node.data.height || 120,
        maxHeight: 600,
        padding: 14,
        cursor: isResizing ? 'ns-resize' : 'grab',
        opacity: isDragging ? 0.82 : 1,
        transition: isDragging ? 'opacity 0.12s ease' : 'opacity 0.18s ease',
        zIndex: 40,
        overflow: 'hidden'
      }}
    >
      <div data-drag-handle="true" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, cursor: 'grab', userSelect: 'none' }} onMouseDown={(e) => onDragStart?.(node.id, e)}>
        <strong>{node.name}</strong>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: isGenerateMode ? '#4f8d63' : '#6f746f' }}>{isGenerateMode ? '生成模式' : `${(node.data.content || '').length} 字`}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <button className="btn" style={{ flex: 1, background: !isGenerateMode ? '#191c20' : undefined, color: !isGenerateMode ? '#fff' : undefined }} onClick={() => updateNode(node.id, { data: { ...node.data, mode: 'direct' } })}>直接输入</button>
        <button className="btn" style={{ flex: 1, background: isGenerateMode ? '#191c20' : undefined, color: isGenerateMode ? '#fff' : undefined }} onClick={() => updateNode(node.id, { data: { ...node.data, mode: 'generate', config: node.data.config || { prompt: '', model: textModelSettings.model || '' } } })}>生成模式</button>
      </div>

      {!isGenerateMode ? (
        <textarea
          value={node.data.content}
          onChange={(e) => handleDirectChange(e.target.value)}
          placeholder="输入提示词..."
          data-block-canvas-wheel="true"
          style={{
            width: '100%',
            minHeight: 80,
            border: 'none',
            background: 'rgba(255, 255, 255, 0.44)',
            borderRadius: 12,
            padding: 10,
            fontSize: 13,
            resize: 'vertical',
            fontFamily: 'inherit',
            outline: 'none'
          }}
        />
      ) : (
        <>
          <textarea
            value={node.data.config?.prompt || ''}
            onChange={handlePromptInput}
            onFocus={(e) => { textareaRef.current = e.target; }}
            placeholder="提示词... 输入 @ 引用其他文本节点"
            data-block-canvas-wheel="true"
            style={{
              width: '100%',
              minHeight: 76,
              border: '1px solid #e2d8cb',
              background: 'rgba(255, 255, 255, 0.44)',
              borderRadius: 12,
              padding: 10,
              fontSize: 13,
              resize: 'vertical',
              fontFamily: 'inherit',
              outline: 'none',
              marginBottom: 8,
            }}
          />
          {showPicker && (
            <AtMentionPicker
              nodes={getConnectedInputNodes()}
              onSelect={handleSelectNode}
              onClose={() => setShowPicker(false)}
              position={pickerPosition}
            />
          )}
          <select
            className="select"
            value={node.data.config?.model || textModelSettings.model || ''}
            onChange={(e) => handleConfigChange('model', e.target.value)}
            style={{ marginBottom: 8, width: '100%' }}
          >
            {(textModelSettings.model ? [textModelSettings.model] : []).map((modelName) => (
              <option key={modelName} value={modelName}>{modelName}</option>
            ))}
            {!textModelSettings.model && <option value="">请先在设置中配置文本模型</option>}
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: 8 }}>
            <button
              onClick={handleGenerate}
              disabled={node.data.result?.status === 'running'}
              style={{
                width: '100%',
                padding: '10px',
                background: node.data.result?.status === 'running' ? '#6f746f' : '#191c20',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                fontSize: 13,
                cursor: node.data.result?.status === 'running' ? 'not-allowed' : 'pointer',
                opacity: node.data.result?.status === 'running' ? 0.7 : 1
              }}
            >
              {node.data.result?.status === 'running' ? '生成中...' : '生成文本'}
            </button>
          </div>
          <div data-block-canvas-wheel="true" style={{ borderRadius: 12, background: '#f7f3ec', border: '1px solid #e2d8cb', padding: 10, minHeight: 80, maxHeight: 220, overflowY: 'auto', whiteSpace: 'pre-wrap', fontSize: 13, color: node.data.result?.status === 'failed' ? '#a14b4b' : '#191c20' }}>
            {node.data.result?.status === 'failed'
              ? (node.data.result?.error || '生成失败')
              : outputText || '生成后的文本会显示在这里'}
          </div>
        </>
      )}

      {isGenerateMode && (
        <div
          data-input-port="true"
          data-port-kind="input"
          data-node-id={node.id}
          onMouseUp={(e) => onInputPortMouseUp?.(node.id, e)}
          onMouseEnter={() => onInputPortMouseEnter?.(node.id)}
          onMouseLeave={() => onInputPortMouseLeave?.(node.id)}
          style={{
            position: 'absolute',
            left: -18,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 36,
            height: 36,
            borderRadius: 999,
            display: 'grid',
            placeItems: 'center',
            cursor: 'crosshair',
            zIndex: 8,
            userSelect: 'none'
          }}
        >
          <div style={{ width: 16, height: 16, borderRadius: 999, background: '#999', border: '2px solid #fff' }} />
        </div>
      )}

      <div
        data-output-port="true"
        data-port-kind="output"
        data-node-id={node.id}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOutputPortMouseDown?.(node.id, e);
        }}
        style={{
          position: 'absolute',
          right: -18,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 36,
          height: 36,
          borderRadius: 999,
          display: 'grid',
          placeItems: 'center',
          cursor: 'crosshair',
          zIndex: 8,
          userSelect: 'none'
        }}
      >
        <div style={{ width: 16, height: 16, borderRadius: 999, background: '#191c20', border: '2px solid #fff' }} />
      </div>

      <div
        onMouseDown={handleResizeStart}
        style={{
          position: 'absolute',
          right: 4,
          bottom: 4,
          width: 16,
          height: 16,
          cursor: 'ns-resize',
          display: 'grid',
          placeItems: 'center',
          fontSize: 10,
          color: '#999'
        }}
      >
        ⤢
      </div>
    </div>
  );
}
