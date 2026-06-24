import { useEffect, useMemo, useRef, useState } from 'react';

import type { NodeSize, VideoNode as VideoNodeType } from '../../types';
import { useCanvasStore } from '../../stores/canvasStore';
import { AtMentionPicker } from '../common/AtMentionPicker';
import { generateVideo, generateVideoFromImage, generateVideoFromFrames, cancelTask, toBackendAssetUrl, generateVideoMultimodal } from '../../utils/api';
import { buildGenerateRequest } from '../../utils/helpers';

interface Props {
  node: VideoNodeType;
  onClick: (id: string, e: React.MouseEvent) => void;
  onDragStart?: (id: string, e: React.MouseEvent) => void;
  onContextMenu?: (id: string, e: React.MouseEvent) => void;
  onOutputPortMouseDown?: (id: string, e: React.MouseEvent) => void;
  onInputPortMouseUp: (id: string, e: React.MouseEvent) => void;
  onInputPortMouseEnter?: (id: string) => void;
  onInputPortMouseLeave?: (id: string) => void;
  isDragging?: boolean;
  isSelected?: boolean;
}

const DEFAULT_SIZE: NodeSize = { width: 334, height: 178 };
const MIN_SIDE = 180;
const MAX_SIDE = 600;
const PREVIEW_HEIGHT_MIN = 120;
const PREVIEW_HEIGHT_MAX = 320;
const PREVIEW_HEIGHT_DEFAULT = 180;
const PREVIEW_SCROLL_TARGET_UPDATE_MS = 10;
const PREVIEW_SCROLL_EASING = 0.08;
const PREVIEW_SCROLL_SNAP_PX = 0.5;

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

export function VideoNode({ node, onClick, onDragStart, onContextMenu, onOutputPortMouseDown, onInputPortMouseUp, onInputPortMouseEnter, onInputPortMouseLeave, isDragging, isSelected }: Props) {
  const { updateNode, nodes, edges, updateNodeStatus } = useCanvasStore();
  const [showPicker, setShowPicker] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ x: 0, y: 0 });
  const [textareaRef, setTextareaRef] = useState<HTMLTextAreaElement | null>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewScrollTargetRef = useRef(0);
  const previewAnimationFrameRef = useRef<number | null>(null);
  const lastPreviewTargetUpdateRef = useRef(0);

  const mediaUrl = useMemo(() => {
    const localPath = node.data.result?.localPath;
    if (!localPath) return undefined;
    return toBackendAssetUrl(localPath);
  }, [node.data.result?.localPath]);

  const previewExpanded = node.data.previewExpanded ?? true;
  const previewHeight = node.data.previewHeight ?? PREVIEW_HEIGHT_DEFAULT;
  const resolvedPrompt = node.data.result?.resolvedPrompt?.trim();

  useEffect(() => {
    if (!mediaUrl) return;
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const next = fitMediaSize(video.videoWidth, video.videoHeight);
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
    video.src = mediaUrl;
  }, [mediaUrl]);

  useEffect(() => {
    const previewEl = previewScrollRef.current;
    const videoEl = videoRef.current;
    if (!previewEl || !videoEl || !resolvedPrompt || !previewExpanded) return;

    const stopAnimation = () => {
      if (previewAnimationFrameRef.current != null) {
        cancelAnimationFrame(previewAnimationFrameRef.current);
        previewAnimationFrameRef.current = null;
      }
    };

    const computeTargetScrollTop = () => {
      const maxScroll = Math.max(0, previewEl.scrollHeight - previewEl.clientHeight);
      if (maxScroll <= 0) return 0;
      const duration = Number.isFinite(videoEl.duration) ? videoEl.duration : 0;
      if (!duration || duration <= 1) return 0;
      const progress = Math.min(1, Math.max(0, videoEl.currentTime / Math.max(1, duration - 1)));
      return maxScroll * progress;
    };

    const animateToTarget = () => {
      const current = previewEl.scrollTop;
      const target = previewScrollTargetRef.current;
      const delta = target - current;
      if (Math.abs(delta) <= PREVIEW_SCROLL_SNAP_PX) {
        previewEl.scrollTop = target;
        previewAnimationFrameRef.current = null;
        return;
      }
      previewEl.scrollTop = current + delta * PREVIEW_SCROLL_EASING;
      previewAnimationFrameRef.current = requestAnimationFrame(animateToTarget);
    };

    const ensureAnimation = () => {
      if (previewAnimationFrameRef.current == null) {
        previewAnimationFrameRef.current = requestAnimationFrame(animateToTarget);
      }
    };

    const updateTarget = (force = false) => {
      const now = performance.now();
      if (!force && now - lastPreviewTargetUpdateRef.current < PREVIEW_SCROLL_TARGET_UPDATE_MS) return;
      lastPreviewTargetUpdateRef.current = now;
      previewScrollTargetRef.current = computeTargetScrollTop();
      ensureAnimation();
    };

    const syncImmediately = () => {
      stopAnimation();
      previewScrollTargetRef.current = computeTargetScrollTop();
      previewEl.scrollTop = previewScrollTargetRef.current;
    };

    const resetScroll = () => {
      stopAnimation();
      previewScrollTargetRef.current = 0;
      previewEl.scrollTop = 0;
    };

    const onPlay = () => updateTarget(true);
    const onTimeUpdate = () => updateTarget(false);
    const onSeeked = () => updateTarget(true);
    const onPause = () => syncImmediately();
    const onEnded = () => syncImmediately();
    const onLoadedMetadata = () => updateTarget(true);

    videoEl.addEventListener('play', onPlay);
    videoEl.addEventListener('timeupdate', onTimeUpdate);
    videoEl.addEventListener('seeked', onSeeked);
    videoEl.addEventListener('pause', onPause);
    videoEl.addEventListener('ended', onEnded);
    videoEl.addEventListener('loadedmetadata', onLoadedMetadata);
    videoEl.addEventListener('emptied', resetScroll);

    updateTarget(true);

    return () => {
      stopAnimation();
      videoEl.removeEventListener('play', onPlay);
      videoEl.removeEventListener('timeupdate', onTimeUpdate);
      videoEl.removeEventListener('seeked', onSeeked);
      videoEl.removeEventListener('pause', onPause);
      videoEl.removeEventListener('ended', onEnded);
      videoEl.removeEventListener('loadedmetadata', onLoadedMetadata);
      videoEl.removeEventListener('emptied', resetScroll);
    };
  }, [mediaUrl, resolvedPrompt, previewExpanded, previewHeight]);

  const previewSize = node.data.mediaSize || DEFAULT_SIZE;

  const patchNodeData = (patch: Record<string, any>) => {
    updateNode(node.id, {
      data: {
        ...node.data,
        ...patch,
      }
    });
  };

  const handleConfigChange = (key: string, value: string) => {
    patchNodeData({ config: { ...node.data.config, [key]: value } });
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
    updateNodeStatus(node.id, 'running');
    try {
      const request = buildGenerateRequest(node as any, nodes as any, edges as any);
      if (!request) {
        updateNodeStatus(node.id, 'failed', '请求构建失败');
        return;
      }
      let result;
      if (request.endpoint === '/api/video/multimodal') {
        result = await generateVideoMultimodal(request.body);
      } else if (request.endpoint === '/api/video/image2video') {
        result = await generateVideoFromImage(request.body);
      } else if (request.endpoint === '/api/video/frames2video') {
        result = await generateVideoFromFrames(request.body);
      } else {
        result = await generateVideo(request.body);
      }
      patchNodeData({
        result: {
          ...(node.data.result || {}),
          status: 'running',
          submitId: result.submit_id,
          resolvedPrompt: request.body.prompt_template,
          startedAt: new Date().toISOString(),
        },
        previewExpanded: true,
      });
    } catch (err) {
      console.error('生成视频失败:', err);
      updateNodeStatus(node.id, 'failed', '生成失败，请检查后端服务和额度');
    }
  };

  const mediaBlockWidth = Math.max(334, previewSize.width + 28);
  const promptPanelWidth = 560;
  const contentWidth = Math.max(mediaBlockWidth, isSelected ? promptPanelWidth : 0);
  const portTop = 48 + previewSize.height / 2;
  const previewTitle = mediaUrl ? '渲染后视频提示词（可跟随播放滚动）' : '渲染后视频提示词';
  const metaBadges = [
    node.data.config.model_version,
    node.data.config.video_resolution,
    node.data.config.ratio,
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
        <span style={{ color: node.data.result?.status === 'running' ? '#2f6780' : '#6f746f' }}>
          {node.data.result?.status === 'running' ? '生成中' : node.data.result?.status === 'success' ? '已完成' : '等待中'}
        </span>
      </div>

      {mediaUrl ? (
        <a href={mediaUrl} target="_blank" rel="noreferrer" style={{ display: 'block', marginBottom: 10 }} onClick={(e) => e.stopPropagation()}>
          <video
            ref={videoRef}
            src={mediaUrl}
            controls
            style={{ width: previewSize.width, height: previewSize.height, borderRadius: 16, background: '#000', display: 'block', cursor: 'zoom-in' }}
          />
        </a>
      ) : (
        <div style={{
          width: '100%',
          height: 178,
          background: 'linear-gradient(145deg, #24313a, #5d666f)',
          borderRadius: 16,
          marginBottom: 10,
          position: 'relative',
          display: 'grid',
          placeItems: 'center'
        }}>
          <span style={{ fontSize: 40, opacity: 0.5 }}>▶</span>
        </div>
      )}

      {!isSelected && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {metaBadges.map((badge) => (
            <span key={badge} style={{ padding: '4px 8px', borderRadius: 999, background: '#f3ece3', border: '1px solid #e5d9cb', color: '#6c6158', fontSize: 11, lineHeight: 1 }}>
              {badge}
            </span>
          ))}
        </div>
      )}
      </div>

      {isSelected && (
        <div style={{ width: promptPanelWidth, marginTop: 6, padding: 14, borderRadius: 18, background: '#fffdf8', border: '1px solid #e7ded2', boxShadow: '0 14px 34px rgba(61,52,42,0.06)' }}>
          {resolvedPrompt && (
        <div style={{ marginBottom: 10, borderRadius: 12, background: '#f6efe6', border: '1px solid #e2d8cb', overflow: 'hidden' }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              patchNodeData({ previewExpanded: !previewExpanded });
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '10px 12px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 12,
              color: '#5f564f'
            }}
          >
            <strong>{previewTitle}</strong>
            <span>{previewExpanded ? '收起' : '展开'}</span>
          </button>

          {previewExpanded && (
            <div style={{ padding: '0 12px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, color: '#7a7068', fontSize: 11 }}>
                <span>文本框高度</span>
                <input
                  type="range"
                  min={PREVIEW_HEIGHT_MIN}
                  max={PREVIEW_HEIGHT_MAX}
                  step={10}
                  value={previewHeight}
                  onChange={(e) => patchNodeData({ previewHeight: Number(e.target.value) })}
                  onClick={(e) => e.stopPropagation()}
                  style={{ flex: 1 }}
                />
                <span style={{ minWidth: 40, textAlign: 'right' }}>{previewHeight}px</span>
              </div>
              <div
                ref={previewScrollRef}
                data-block-canvas-wheel="true"
                onWheel={(e) => {
                  e.stopPropagation();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                style={{
                  maxHeight: previewHeight,
                  overflowY: 'auto',
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: '#fffaf4',
                  border: '1px solid #eadfd1',
                  fontSize: 12,
                  color: '#5f564f',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap'
                }}
              >
                {resolvedPrompt}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ position: 'relative' }}>
        <textarea
          value={node.data.config.prompt}
          onChange={handleTextareaInput}
          onFocus={handleTextareaFocus}
          placeholder="提示词... 输入 @ 引用其他节点"
          style={{
            width: '100%',
            minHeight: 50,
            border: '1px solid #e2d8cb',
            borderRadius: 12,
            padding: 8,
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
          value={node.data.config.model_version}
          onChange={(e) => handleConfigChange('model_version', e.target.value)}
          className="select"
          style={{ flex: 1, fontSize: 11 }}
        >
          <option value="seedance1.0pro">Seedance 1.0 Pro</option>
          <option value="seedance1.0lite">Seedance 1.0 Lite</option>
          <option value="seedance2.0">Seedance 2.0</option>
          <option value="seedance2.0fast">Seedance 2.0 Fast</option>
          <option value="seedance2.0vip">Seedance 2.0 VIP</option>
          <option value="seedance2.0fastvip">Seedance 2.0 Fast VIP</option>
        </select>
        <select
          value={node.data.config.duration}
          onChange={(e) => handleConfigChange('duration', e.target.value)}
          className="select"
          style={{ flex: 1, fontSize: 11 }}
        >
          {Array.from({ length: 12 }, (_, idx) => idx + 4).map(sec => (
            <option key={sec} value={`${sec}s`}>{sec} 秒</option>
          ))}
        </select>
        <select
          value={node.data.config.video_resolution}
          onChange={(e) => handleConfigChange('video_resolution', e.target.value)}
          className="select"
          style={{ flex: 1, fontSize: 11 }}
        >
          <option value="720P">720P</option>
          <option value="1080P">1080P</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <select
          value={node.data.config.ratio}
          onChange={(e) => handleConfigChange('ratio', e.target.value)}
          className="select"
          style={{ flex: 1, fontSize: 11 }}
        >
          <option value="16:9">16:9</option>
          <option value="9:16">9:16</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: node.data.result?.status === 'running' ? '1fr 88px' : '1fr', gap: 8 }}>
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
          {node.data.result?.status === 'running' ? '生成中...' : '生成视频'}
        </button>
        {node.data.result?.status === 'running' && node.data.result?.submitId && (
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
    </div>
  );
}
