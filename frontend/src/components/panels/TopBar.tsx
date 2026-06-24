import { useEffect, useState } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import { exportWorkflow, importWorkflow, parseWorkflowFile, validateWorkflow } from '../../utils/workflowIO';
import { saveSetting, loadSetting } from '../../utils/db';
import { checkFileExists, checkBackendVersion, checkAuth, getCredit, getTextModelSettings, saveTextModelSettings } from '../../utils/api';
import type { TextModelSettings } from '../../types';

export function TopBar() {
  const {
    backendVersion,
    credit,
    exportWorkflow: exportWF,
    importWorkflow: importWF,
    backendUrl,
    setBackendUrl,
    setBackendVersion,
    setCredit,
    isSaved,
  } = useCanvasStore();
  const [showSettings, setShowSettings] = useState(false);
  const [urlDraft, setUrlDraft] = useState(backendUrl);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [textSettings, setTextSettings] = useState<TextModelSettings>({ protocol: 'openai', apiUrl: '', apiKey: '', model: '' });

  useEffect(() => {
    loadSetting('backendUrl').then(v => {
      if (v) {
        setBackendUrl(v);
        setUrlDraft(v);
      }
    }).catch(() => {});
  }, [setBackendUrl]);

  useEffect(() => {
    if (!showSettings) return;
    getTextModelSettings().then(setTextSettings).catch(() => {});
  }, [showSettings]);

  const handleExport = () => {
    const workflow = exportWF();
    exportWorkflow(workflow, `rainbow-workflow-${Date.now()}.json`);
  };

  const handleImport = async () => {
    try {
      const file = await importWorkflow();
      const workflow = await parseWorkflowFile(file);
      const validation = validateWorkflow(workflow);
      if (!validation.valid) {
        alert('工作流文件格式无效:\n' + validation.errors.join('\n'));
        return;
      }
      const repairedNodes = await Promise.all((workflow.nodes || []).map(async (node: any) => {
        if (node.type === 'image' && node.data?.uploadPath) {
          const exists = await checkFileExists(node.data.uploadPath);
          if (!exists) {
            return {
              ...node,
              data: {
                ...node.data,
                result: {
                  ...(node.data.result || {}),
                  status: 'failed',
                  error: '文件路径无效，请重新上传或生成'
                }
              }
            };
          }
        }
        if ((node.type === 'image' || node.type === 'video') && node.data?.result?.localPath) {
          const exists = await checkFileExists(node.data.result.localPath);
          if (!exists) {
            return {
              ...node,
              data: {
                ...node.data,
                result: {
                  ...node.data.result,
                  status: 'failed',
                  error: '文件已丢失，请重新上传或生成'
                }
              }
            };
          }
        }
        return node;
      }));
      importWF({ ...workflow, nodes: repairedNodes });
    } catch (err: any) {
      alert('导入失败：' + err.message);
    }
  };

  const normalizeBackendUrl = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return '';
    return trimmed.replace(/\/+$/, '');
  };

  const handleSaveSettings = async () => {
    const nextUrl = normalizeBackendUrl(urlDraft);
    if (!nextUrl) {
      alert('请填写后端服务器地址');
      return;
    }
    if (!textSettings.apiUrl.trim()) {
      alert('请填写文本模型 API URL');
      return;
    }
    if (!textSettings.apiKey.trim()) {
      alert('请填写文本模型 API Key');
      return;
    }
    if (!textSettings.model.trim()) {
      alert('请填写文本模型名称');
      return;
    }
    setIsSavingSettings(true);
    try {
      window.localStorage.setItem('rainbow-board-backend-url', nextUrl);
      await saveSetting('backendUrl', nextUrl);
      setBackendUrl(nextUrl);
      setUrlDraft(nextUrl);
      await saveTextModelSettings({
        protocol: 'openai',
        apiUrl: normalizeBackendUrl(textSettings.apiUrl),
        apiKey: textSettings.apiKey,
        model: textSettings.model.trim(),
      });
      const [version, credits] = await Promise.all([
        checkBackendVersion(),
        getCredit().catch(() => null),
        checkAuth().catch(() => null),
      ]);
      setBackendVersion(version.version);
      if (credits) setCredit(credits.credits);
      setShowSettings(false);
    } catch (err: any) {
      alert('保存失败：' + (err?.message || '请检查配置'));
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <>
      <div style={{ position: 'fixed', top: 18, left: 18, right: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 5000, pointerEvents: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div>
            <strong style={{ fontSize: 16 }}>七彩画板</strong>
            <span style={{ color: isSaved ? '#4f8d63' : '#8a6d3b', fontSize: 13, marginLeft: 8 }}>● {isSaved ? '已保存' : '保存中...'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {credit !== null && <div style={{ padding: '6px 12px', borderRadius: 999, background: 'rgba(255, 251, 245, 0.88)', border: '1px solid #d9cfc1', fontSize: 13 }}>✦ {credit}</div>}
          {backendVersion && <div style={{ padding: '6px 12px', borderRadius: 999, background: 'rgba(255, 251, 245, 0.88)', border: '1px solid #d9cfc1', fontSize: 12, color: '#6f746f' }}>v{backendVersion}</div>}
          <button onClick={() => setShowSettings(true)} className="btn" style={{ padding: '6px 12px', fontSize: 13 }}>设置</button>
          <button onClick={handleImport} className="btn" style={{ padding: '6px 12px', fontSize: 13 }}>导入</button>
          <button onClick={handleExport} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 13 }}>导出</button>
        </div>
      </div>

      {showSettings && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(32,33,36,.32)', zIndex: 5100 }} onClick={() => setShowSettings(false)}>
          <div className="card" onClick={e => e.stopPropagation()} style={{ width: 520, padding: 20, position: 'absolute', right: 20, top: 70 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <strong>连接设置</strong>
              <button className="btn" onClick={() => setShowSettings(false)}>关闭</button>
            </div>

            <div style={{ marginBottom: 10, fontSize: 13, color: '#6f746f' }}>后端服务器地址</div>
            <input className="input" value={urlDraft} onChange={e => setUrlDraft(e.target.value)} placeholder="http://localhost:3971" />

            <div style={{ marginTop: 16, marginBottom: 10, fontSize: 13, color: '#6f746f' }}>文本模型协议</div>
            <select className="select" value="openai" disabled>
              <option value="openai">OpenAI</option>
            </select>

            <div style={{ marginTop: 16, marginBottom: 10, fontSize: 13, color: '#6f746f' }}>文本模型 API URL</div>
            <input className="input" value={textSettings.apiUrl} onChange={e => setTextSettings(s => ({ ...s, apiUrl: e.target.value }))} placeholder="https://api.openai.com/v1" />

            <div style={{ marginTop: 16, marginBottom: 10, fontSize: 13, color: '#6f746f' }}>文本模型 API Key</div>
            <input className="input" type="password" value={textSettings.apiKey} onChange={e => setTextSettings(s => ({ ...s, apiKey: e.target.value }))} placeholder="sk-..." />

            <div style={{ marginTop: 16, marginBottom: 10, fontSize: 13, color: '#6f746f' }}>文本模型名称</div>
            <input className="input" value={textSettings.model} onChange={e => setTextSettings(s => ({ ...s, model: e.target.value }))} placeholder="例如：gpt-4.1 / qwen-max / 你的兼容模型名" />

            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn" onClick={() => setShowSettings(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleSaveSettings} disabled={isSavingSettings}>{isSavingSettings ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
