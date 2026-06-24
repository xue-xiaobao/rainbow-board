import { useEffect, useMemo, useRef, useState } from 'react';

import type { ImageNode as ImageNodeType, NodeSize } from '../../types';
import { useCanvasStore } from '../../stores/canvasStore';
import { AtMentionPicker } from '../common/AtMentionPicker';
import { generateImage, generateImageFromImage, uploadFile, cancelTask, toBackendAssetUrl } from '../../utils/api';
import { buildGenerateRequest } from '../../utils/helpers';

interface Props {
  node: ImageNodeType;
  onClick: (id: string, e: React.MouseEvent) => void;
  onDragStart?: (id: string, e: React.MouseEvent) => void;
  onContextMenu?: (id: string, e: React.MouseEvent) => void;
  onOutputPortMouseDown: (id: string, e: React.MouseEvent) => void;
  onInputPortMouseUp: (id: string, e: React.MouseEvent) => void;
  onInputPortMouseEnter?: (id: string) => void;
  onInputPortMouseLeave?: (id: string) => void;
  isDragging?: boolean;
  isSelected?: boolean;
}

const DEFAULT_SIZE: NodeSize = { width: 326, height: 180 };
const MIN_SIDE = 180;
const MAX_SIDE = 600;

function fitMediaSize(width: number, height: number): NodeSize {
  if (!width || !height) return DEFAULT_SIZE;
  const scaleDown = Math.min(MAX_SIDE / width, MAX_SIDE / height, 1);
  let nextWidth = Math.round(width * scaleDown);
  let nextHeight = Math.round(height * scaleDown);
  const currentMin = Math.min(nextWidth, nextHeight);
  if (currentMin < MIN_SIDE) {
    const scaleUp = MIN_SIDE / currentMin;
    nextWidth = Math.round(nextWidth * scaleUp);
    nextHeight = Math.round(nextHeight * scaleUp);
  }
  if (Math.max(nextWidth, nextHeight) > MAX_SIDE) {
    const finalScale = MAX_SIDE / Math.max(nextWidth, nextHeight);
    nextWidth = Math.round(nextWidth * finalScale);
    nextHeight = Math.round(nextHeight * finalScale);
  }
  return { width: nextWidth, height: nextHeight };
}

export function ImageNode({ node, onClick, onDragStart, onContextMenu, onOutputPortMouseDown, onInputPortMouseUp, onInputPortMouseEnter, onInputPortMouseLeave, isDragging, isSelected }: Props) {
  const { updateNode, nodes, edges, updateNodeStatus } = useCanvasStore();
  const [showPicker, setShowPicker] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ x: 0, y: 0 });
  const [textareaRef, setTextareaRef] = useState<HTMLTextAreaElement | null>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isUploadMode = node.data.mode === 'upload';

  const isGenerating = node.data.result?.status === 'running' || (!!node.data.result?.submitId && !node.data.result?.localPath && node.data.result?.status !== 'failed' && node.data.result?.status !== 'canceled');

  const mediaUrl = useMemo(() => {
    const localPath = node.data.result?.localPath;
    if (!localPath) return undefined;
    return toBackendAssetUrl(localPath);
  }, [node.data.result?.localPath]);

  useEffect(() => {
    if (!mediaUrl) return;
    const img = new window.Image();
    img.onload = () => {
      const next = fitMediaSize(img.naturalWidth, img.naturalHeight);
      const current = node.data.mediaSize;
      if (!current || current.width !== next.width || current.height !== next.height) {
        updateNode(node.id, {
          data: {
            ...node.data,
            mediaSize: next
          }
        });
      }
    };
    img.src = mediaUrl;
  }, [mediaUrl]);

  const previewSize = node.data.mediaSize || DEFAULT_SIZE;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadFile(file);
      updateNode(node.id, {
        data: {
          ...node.data,
          mode: 'upload',
          uploadPath: result.path,
          result: { status: 'success' as const, localPath: toBackendAssetUrl(result.url) }
        }
      });
    } catch (err) {
      console.error('上传失败:', err);
      alert('上传失败,请检查后端服务是否运行');
    }
  };

  const handleConfigChange = (key: string, value: string) => {
    if (node.data.mode === 'generate' && node.data.config) {
      updateNode(node.id, {
        data: {
          ...node.data,
          config: { ...node.data.config, [key]: value }
        }
      });
    }
  };

  const handleTextareaFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    setTextareaRef(e.target);
    promptTextareaRef.current = e.target;
  };

  const getCaretScreenPosition = (textarea: HTMLTextAreaElement) => {
    const rect = textarea.getBoundingClientRect();
    const style = window.getComputedStyle(textarea);
    const lineHeight = parseFloat(style.lineHeight || '18') || 18;
    const paddingLeft = parseFloat(style.paddingLeft || '0') || 0;
    const paddingTop = parseFloat(style.paddingTop || '0') || 0;
    return {
      x: rect.left + paddingLeft + 8,
      y: rect.top + paddingTop + lineHeight + 8,
    };
  };

  const getConnectedInputNodes = () => {
    return edges
      .filter(e => e.to === node.id)
      .map(e => nodes.find(n => n.id === e.from))
      .filter((n): n is any => !!n);
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPosition = e.target.selectionStart;
    if (value[cursorPosition - 1] === '@') {
      const caret = getCaretScreenPosition(e.target);
      setPickerPosition(caret);
      setShowPicker(true);
    }
    handleConfigChange('prompt', value);
  };

  const handleSelectNode = (selectedNode: any) => {
    if (!textareaRef) return;
    const value = textareaRef.value;
    const cursorPosition = textareaRef.selectionStart;
    const lastAt = value.lastIndexOf('@', cursorPosition - 1);
    if (lastAt === -1) return;
    const before = value.slice(0, lastAt);
    const after = value.slice(cursorPosition);
    const newValue = `${before}[@${selectedNode.name}]${after}`;
    handleConfigChange('prompt', newValue);
    setShowPicker(false);
    setTimeout(() => {
      textareaRef.focus();
      textareaRef.setSelectionRange(lastAt + selectedNode.name.length + 3, lastAt + selectedNode.name.length + 3);
    }, 0);
  };

  const handleGenerate = async () => {
    if (node.data.mode === 'upload') return;
    updateNodeStatus(node.id, 'running');
    try {
      const request = buildGenerateRequest(node as any, nodes as any, edges as any);
      if (!request) {
        updateNodeStatus(node.id, 'failed', '请求构建失败');
        return;
      }
      let result;
      const startedAt = new Date().toISOString();
      updateNode(node.id, {
        data: {
          ...node.data,
          result: {
            status: 'running',
            submitId: undefined,
            localPath: undefined,
            error: undefined,
            startedAt,
          }
        }
      });
      if (request.endpoint === '/api/image/image2image') {
        result = await generateImageFromImage(request.body);
      } else {
        result = await generateImage(request.body);
      }
      const immediateLocalPath = toBackendAssetUrl((result as any).result?.local_path || (result as any).result?.url);
      const backendReturnedSuccess = (result as any).status === 'success' && immediateLocalPath;
      updateNode(node.id, {
        data: {
          ...node.data,
          result: {
            status: 'running',
            submitId: result.submit_id,
            localPath: undefined,
            error: undefined,
            startedAt,
          }
        }
      });
      if (backendReturnedSuccess && immediateLocalPath) {
        const submitId = result.submit_id;
        const img = new window.Image();
        img.onload = () => {
          const latestNode = useCanvasStore.getState().nodes.find(n => n.id === node.id) as any;
          if (latestNode?.data?.result?.submitId !== submitId) return;
          updateNode(node.id, {
            data: {
              ...latestNode.data,
              result: {
                ...(latestNode.data.result || {}),
                status: 'success',
                submitId,
                localPath: immediateLocalPath,
                error: undefined,
                startedAt: latestNode.data.result?.startedAt,
              }
            }
          });
        };
        img.onerror = () => {
          const latestNode = useCanvasStore.getState().nodes.find(n => n.id === node.id) as any;
          if (latestNode?.data?.result?.submitId !== submitId) return;
          updateNode(node.id, {
            data: {
              ...latestNode.data,
              result: {
                ...(latestNode.data.result || {}),
                status: 'failed',
                submitId,
                localPath: immediateLocalPath,
                error: '图片结果加载失败',
                startedAt: latestNode.data.result?.startedAt,
              }
            }
          });
        };
        img.src = immediateLocalPath;
      }
    } catch (err) {
      console.error('生成失败:', err);
      updateNodeStatus(node.id, 'failed', '生成失败,请检查后端服务和额度');
    }
  };

  const mediaBlockWidth = Math.max(326, previewSize.width + 28);
  const promptPanelWidth = 520;
  const contentWidth = Math.max(mediaBlockWidth, isSelected ? promptPanelWidth : 0);
  const portTop = 48 + previewSize.height / 2;
  const promptBadges = [
    node.data.config?.model_version || '5.0',
    (node.data.config?.resolution_type || '2k').toUpperCase(),
    node.data.config?.ratio || '16:9'
  ];

  return (
    <div
      className="card"
      onClick={(e) => onClick(node.id, e)}
      onContextMenu={(e) => onContextMenu?.(node.id, e)}
      style={{
        position: 'absolute',
        left: node.position.x,
        top: node.position.y,
        width: contentWidth,
        padding: 0,
        cursor: 'grab',
        opacity: isDragging ? 0.82 : 1,
        transition: isDragging ? 'opacity 0.12s ease' : 'opacity 0.18s ease',
        zIndex: isSelected ? 120 : 40,
        background: 'transparent',
        border: 'none',
        boxShadow: 'none'
      }}
    >
      <div style={{ padding: 14, borderRadius: 18, background: '#fffdf8', border: '1px solid #e7ded2', boxShadow: '0 14px 34px rgba(61,52,42,0.08)', width: mediaBlockWidth }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13, cursor: 'grab', userSelect: 'none' }} onMouseDown={(e) => onDragStart?.(node.id, e)} data-drag-handle="true">
          <strong>{node.name}</strong>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: isUploadMode ? '#a7693f' : '#4f8d63' }}>
              {isUploadMode ? '上传模式' : '生成模式'}
            </span>
          </div>
        </div>

        {isUploadMode ? (
          mediaUrl && node.data.result?.status !== 'failed' ? (
            <a href={mediaUrl} target="_blank" rel="noreferrer" style={{ display: 'block' }} onClick={(e) => e.stopPropagation()}>
              <img
                src={mediaUrl}
                alt="预览"
                style={{ width: previewSize.width, height: previewSize.height, objectFit: 'cover', borderRadius: 16, display: 'block', cursor: 'zoom-in' }}
              />
            </a>
          ) : (
            <div style={{
              width: '100%',
              height: 180,
              border: '1px dashed #c8b6a0',
              borderRadius: 16,
              display: 'grid',
              placeItems: 'center',
              color: '#a7693f',
              textAlign: 'center',
              padding: 12
            }}>
              {node.data.result?.error || '请上传图片'}
            </div>
          )
        ) : (
          mediaUrl ? (
            <a href={mediaUrl} target="_blank" rel="noreferrer" style={{ display: 'block' }} onClick={(e) => e.stopPropagation()}>
              <img
                src={mediaUrl}
                alt="预览"
                style={{ width: previewSize.width, height: previewSize.height, objectFit: 'cover', borderRadius: 16, display: 'block', cursor: 'zoom-in' }}
              />
            </a>
          ) : (
            <div style={{
              width: '100%',
              height: 180,
              background: 'linear-gradient(145deg, #8aa8b4, #d1c6b8 55%, #bf7c4d)',
              borderRadius: 16
            }} />
          )
        )}

        {!isSelected && !isUploadMode && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {promptBadges.map((badge) => (
              <span key={badge} style={{ padding: '4px 8px', borderRadius: 999, background: '#f3ece3', border: '1px solid #e5d9cb', color: '#6c6158', fontSize: 11, lineHeight: 1 }}>
                {badge}
              </span>
            ))}
          </div>
        )}
      </div>

      {isSelected && !isUploadMode && (
        <div style={{ width: promptPanelWidth, marginTop: 6, padding: 14, borderRadius: 18, background: '#fffdf8', border: '1px solid #e7ded2', boxShadow: '0 14px 34px rgba(61,52,42,0.06)' }}>
          <div style={{ position: 'relative' }}>
            <textarea
              ref={setTextareaRef}
              value={node.data.config?.prompt || ''}
              onChange={handleTextareaInput}
              onFocus={handleTextareaFocus}
              placeholder="提示词... 输入 @ 引用其他节点"
              style={{
                width: '100%',
                minHeight: 88,
                border: '1px solid #e2d8cb',
                borderRadius: 12,
                padding: 10,
                fontSize: 12,
                resize: 'vertical',
                fontFamily: 'inherit',
                outline: 'none',
                marginBottom: 8
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
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <select
              value={node.data.config?.model_version || '5.0'}
              onChange={(e) => {
                const nextModel = e.target.value;
                const nextRatio = nextModel === 'gpt-image-2'
                  ? 'auto'
                  : (node.data.config?.ratio === 'auto' ? '16:9' : (node.data.config?.ratio || '16:9'));
                const nextResolution = nextModel === 'gpt-image-2'
                  ? '1k'
                  : (node.data.config?.resolution_type === '1k' ? '2k' : (node.data.config?.resolution_type || '2k'));
                updateNode(node.id, {
                  data: {
                    ...node.data,
                    config: {
                      ...node.data.config!,
                      model_version: nextModel,
                      ratio: nextRatio,
                      resolution_type: nextResolution,
                    }
                  }
                });
              }}
              className="select"
              style={{ flex: 1, fontSize: 11 }}
            >
              <option value="3.0">即梦 3.0</option>
              <option value="4.0">即梦 4.0</option>
              <option value="4.1">即梦 4.1</option>
              <option value="4.5">即梦 4.5</option>
              <option value="4.6">即梦 4.6</option>
              <option value="4.7">即梦 4.7</option>
              <option value="5.0">即梦 5.0</option>
              <option value="gpt-image-2">gpt-image-2</option>
            </select>
            <select
              value={node.data.config?.resolution_type || (node.data.config?.model_version === 'gpt-image-2' ? '1k' : '2k')}
              onChange={(e) => handleConfigChange('resolution_type', e.target.value)}
              className="select"
              style={{ flex: 1, fontSize: 11 }}
            >
              {node.data.config?.model_version === 'gpt-image-2' ? (
                <>
                  <option value="1k">1K</option>
                  <option value="2k">2K</option>
                  <option value="4k">4K</option>
                </>
              ) : (
                <>
                  <option value="2k">2K</option>
                  <option value="4k">4K</option>
                </>
              )}
            </select>
            <select
              value={node.data.config?.ratio || (node.data.config?.model_version === 'gpt-image-2' ? 'auto' : '16:9')}
              onChange={(e) => handleConfigChange('ratio', e.target.value)}
              className="select"
              style={{ flex: 1, fontSize: 11 }}
            >
              {node.data.config?.model_version === 'gpt-image-2' ? <option value="auto">Auto</option> : null}
              <option value="21:9">21:9</option>
              <option value="16:9">16:9</option>
              <option value="3:2">3:2</option>
              <option value="4:3">4:3</option>
              <option value="1:1">1:1</option>
              <option value="3:4">3:4</option>
              <option value="2:3">2:3</option>
              <option value="9:16">9:16</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isGenerating ? '1fr 88px' : '1fr', gap: 8 }}>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              style={{
                width: '100%',
                padding: '10px',
                background: isGenerating ? '#6f746f' : '#191c20',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                fontSize: 13,
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                opacity: isGenerating ? 0.7 : 1
              }}
            >
              {isGenerating ? '生成中...' : '生成图片'}
            </button>
            {isGenerating && node.data.result?.submitId && (
              <button
                onClick={async () => {
                  await cancelTask(node.data.result!.submitId!);
                  updateNodeStatus(node.id, 'failed', '任务已取消');
                }}
                className="btn"
              >
                取消
              </button>
            )}
          </div>
        </div>
      )}

      {!isUploadMode && (
        <div
          data-input-port="true"
          data-port-kind="input"
          data-node-id={node.id}
          onMouseUp={(e) => onInputPortMouseUp(node.id, e)}
          onMouseEnter={() => onInputPortMouseEnter?.(node.id)}
          onMouseLeave={() => onInputPortMouseLeave?.(node.id)}
          style={{
            position: 'absolute',
            left: -18,
            top: portTop,
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
          onOutputPortMouseDown(node.id, e);
        }}
        style={{
          position: 'absolute',
          right: -18,
          top: portTop,
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

      {isUploadMode && !node.data.result?.localPath && (
        <label style={{
          display: 'block',
          width: '100%',
          padding: '10px',
          textAlign: 'center',
          background: '#191c20',
          color: '#fff',
          borderRadius: 12,
          cursor: 'pointer',
          fontSize: 13,
          marginTop: 6
        }}>
          上传图片
          <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
        </label>
      )}
    </div>
  );
}
