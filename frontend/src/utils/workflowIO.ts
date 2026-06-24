import type { Workflow } from '../types';

/**
 * 导出工作流为 JSON 文件
 */
export function exportWorkflow(workflow: Workflow, filename?: string): void {
  const dataStr = JSON.stringify(workflow, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `rainbow-workflow-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 导入工作流 JSON 文件
 */
export function importWorkflow(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        reject(new Error('未选择文件'));
        return;
      }
      resolve(file);
    };
    
    input.click();
  });
}

/**
 * 解析工作流 JSON 文件
 */
export async function parseWorkflowFile(file: File): Promise<Workflow> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workflow = JSON.parse(e.target?.result as string);
        resolve(workflow);
      } catch (err) {
        reject(new Error('JSON 格式无效'));
      }
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsText(file);
  });
}

/**
 * 验证工作流数据
 */
export function validateWorkflow(workflow: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!workflow.version) {
    errors.push('缺少 version 字段');
  }
  
  if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
    errors.push('缺少 nodes 数组');
  }
  
  if (!workflow.edges || !Array.isArray(workflow.edges)) {
    errors.push('缺少 edges 数组');
  }
  
  if (!workflow.viewport) {
    errors.push('缺少 viewport 配置');
  }
  
  // 验证节点
  if (workflow.nodes) {
    for (const node of workflow.nodes) {
      if (!node.id || !node.type || !node.position) {
        errors.push(`节点 ${node.id || 'unknown'} 缺少必要字段`);
      }
      if (!['text', 'image', 'video'].includes(node.type)) {
        errors.push(`节点 ${node.id} 类型无效：${node.type}`);
      }
    }
  }
  
  // 验证连线
  if (workflow.edges) {
    for (const edge of workflow.edges) {
      if (!edge.from || !edge.to) {
        errors.push(`连线 ${edge.id || 'unknown'} 缺少 from 或 to`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 检查文件路径是否有效
 */
export async function checkFilePath(path: string): Promise<boolean> {
  // 前端无法直接检查本地文件路径
  // 这个检查需要后端支持
  // 这里只检查路径格式
  return typeof path === 'string' && path.length > 0;
}
