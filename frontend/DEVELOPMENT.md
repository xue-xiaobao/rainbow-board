# RainbowBoard 前端开发文档

## 项目概述

七彩画板前端是一个基于 React + TypeScript 的无限画布工作流编辑器，用于 AIGC 创作。

**技术栈**：
- React 18
- TypeScript 5
- Vite 5
- Zustand (状态管理)
- idb (IndexedDB 封装)

**开发模式**：
- 前端独立运行在 `http://localhost:5173`
- 开发时通过 Vite Proxy 转发 API 请求到后端 `http://localhost:3000`
- 生产环境构建为静态文件，可部署到任意静态托管服务

---

## 项目结构

```
frontend/
├── index.html                 # 入口 HTML
├── package.json               # 依赖配置
├── vite.config.ts             # Vite 配置
├── tsconfig.json              # TypeScript 配置
└── src/
    ├── main.tsx               # React 入口
    ├── App.tsx                # 主应用组件
    ├── types/
    │   └── index.ts           # TypeScript 类型定义
    ├── stores/
    │   └── canvasStore.ts     # Zustand 状态管理
    ├── utils/
    │   └── api.ts             # 后端 API 客户端
    ├── styles/
    │   └── index.css          # 全局样式
    ├── components/
    │   ├── toolbar/
    │   │   └── Toolbar.tsx    # 左侧工具栏
    │   ├── panels/
    │   │   ├── TopBar.tsx     # 顶部状态栏
    │   │   └── BottomBar.tsx  # 底部控制栏
    │   ├── canvas/
    │   │   └── Canvas.tsx     # 无限画布
    │   └── nodes/
    │       ├── TextNode.tsx   # 文本节点
    │       ├── ImageNode.tsx  # 图片节点
    │       └── VideoNode.tsx  # 视频节点
    └── hooks/                 # 自定义 Hooks (待创建)
```

---

## 核心功能实现清单

### 阶段 1：基础画布系统 (已完成 ✅)

- [x] 无限画布容器
- [x] 画布平移 (拖拽)
- [x] 画布缩放 (鼠标滚轮)
- [x] 点阵背景
- [x] 视图状态管理 (zoom, x, y)
- [x] 底部缩放控制栏

### 阶段 2：节点系统 (已完成 ✅)

- [x] 文本节点组件
- [x] 图片节点组件 (上传模式 + 生成模式)
- [x] 视频节点组件
- [x] 节点拖拽移动
- [x] 节点选中状态
- [x] 节点删除

### 阶段 3：连线系统 (部分完成 ⏳)

- [x] 连线渲染 (SVG)
- [x] 输出端口拖拽
- [x] 输入端口连接
- [x] 循环依赖检测
- [ ] 连线删除
- [ ] 连线高亮动画 (选中节点时)

### 阶段 4：节点执行 (进行中 🚧)

- [x] @引用语法解析
- [x] 提示词拼接逻辑
- [x] API 调用封装
- [x] 节点执行状态管理 (idle/running/success/failed)
- [x] 进度轮询
- [x] @引用选择器 UI
- [ ] 错误处理完善
- [ ] 输入依赖检查

### 阶段 5：数据持久化 (待开发 ⏸️)

- [x] 撤销/重做栈 (Store 中已实现)
- [ ] IndexedDB 封装
- [ ] 工作流自动保存
- [ ] 工作流加载

### 阶段 6：导出/导入 (待开发 ⏸️)

- [ ] 导出为 JSON 文件
- [ ] 导入 JSON 文件
- [ ] 文件路径验证
- [ ] 丢失文件处理

### 阶段 7：配置和设置 (待开发 ⏸️)

- [ ] 后端地址配置
- [ ] 后端版本检测
- [ ] 额度显示
- [ ] 存储目录配置

---

## 类型系统

### 节点类型

```typescript
type NodeType = 'text' | 'image' | 'video';
type NodeStatus = 'idle' | 'running' | 'success' | 'failed';
type ImageMode = 'upload' | 'generate';
```

### 节点数据结构

```typescript
interface TextNodeData {
  content: string;
}

interface ImageNodeConfig {
  prompt: string;
  model_version: string;
  ratio: string;
  resolution_type: string;
}

interface ImageNodeData {
  mode: ImageMode;
  uploadPath?: string;
  config?: ImageNodeConfig;
  result?: ImageNodeResult;
}

interface VideoNodeConfig {
  prompt: string;
  model_version: string;
  duration: string;
  ratio: string;
  video_resolution: string;
}

interface VideoNodeData {
  config: VideoNodeConfig;
  result?: VideoNodeResult;
}
```

### 工作流结构

```typescript
interface Workflow {
  version: string;
  exportedAt: string;
  name: string;
  viewport: Viewport;
  nodes: CanvasNode[];
  edges: Edge[];
}
```

---

## API 接口

### 后端 API 基础地址

开发环境：`http://localhost:3000`
生产环境：可配置

### 接口列表

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/version` | GET | 检查后端版本 |
| `/api/credit` | GET | 查询即梦额度 |
| `/api/auth/status` | GET | 检查登录状态 |
| `/api/image/text2image` | POST | 文生图 |
| `/api/image/image2image` | POST | 图生图 |
| `/api/video/text2video` | POST | 文生视频 |
| `/api/video/image2video` | POST | 图生视频 |
| `/api/video/frames2video` | POST | 首尾帧视频 |
| `/api/task/:id` | GET | 查询任务状态 |

---

## 状态管理 (Zustand)

### Store 结构

```typescript
interface CanvasStore {
  // 数据
  nodes: CanvasNode[];
  edges: Edge[];
  viewport: Viewport;
  
  // UI 状态
  selectedNodeId: string | null;
  
  // 配置
  backendUrl: string;
  backendVersion: string | null;
  
  // 撤销/重做
  history: Array<{ nodes: CanvasNode[]; edges: Edge[] }>;
  historyIndex: number;
  
  // Actions
  addNode: (type, position) => void;
  updateNode: (id, data) => void;
  deleteNode: (id) => void;
  moveNode: (id, position) => void;
  
  addEdge: (from, to) => void;
  deleteEdge: (id) => void;
  
  undo: () => void;
  redo: () => void;
  
  exportWorkflow: () => Workflow;
  importWorkflow: (workflow) => void;
  
  saveToIndexedDB: () => Promise<void>;
  loadFromIndexedDB: () => Promise<void>;
}
```

---

## 开发规范

### 代码风格

1. 使用 TypeScript 严格模式
2. 组件使用函数式 + Hooks
3. 状态管理使用 Zustand
4. 样式使用内联 + CSS 类混合

### 命名约定

- 组件：PascalCase (如 `TextNode.tsx`)
- 工具函数：camelCase (如 `parseReferences.ts`)
- 类型：PascalCase (如 `CanvasNode`)
- 常量：UPPER_CASE (如 `API_BASE`)

### Git 提交规范

```
feat: 新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式
refactor: 重构
test: 测试
chore: 构建/工具
```

---

## 已确认方案 (2026-06-21)

### @引用语法
✅ 输入 `@` 后弹出下拉选择框
✅ 选择节点后插入 `[@节点名]` 标记
✅ 支持键盘导航（上下箭头选择，Enter 确认，Esc 关闭）

### 节点执行
✅ 节点卡片常驻"生成"按钮
✅ 执行前检查输入依赖
✅ 执行状态显示（idle/running/success/failed）

### 属性面板
✅ 配置直接集成到节点卡片上编辑
✅ 不做独立右侧属性面板

### 文件上传
✅ 通过后端上传和访问
✅ 前端使用 FormData 上传
✅ 后端返回本地路径和访问 URL

---

## 下一步计划

### 本周 (第 1 周) - 进行中 🚧

1. **完善连线系统**
   - [x] 循环依赖检测
   - [ ] 连线删除功能
   - [ ] 连线高亮动画

2. **实现@引用语法** ✅
   - [x] 输入 `@` 弹出节点选择器
   - [x] 解析引用标记
   - [x] 显示引用标签

3. **节点执行流程** ✅
   - [x] 执行按钮
   - [x] API 调用
   - [x] 状态显示
   - [x] 进度轮询
   - [ ] 输入依赖检查完善

4. **图片上传** ✅
   - [x] 通过后端上传
   - [x] 返回路径和 URL

### 下周 (第 2 周)

1. **数据持久化**
   - IndexedDB 封装
   - 自动保存
   - 撤销/重做

2. **导出/导入**
   - JSON 导出
   - JSON 导入
   - 文件路径验证

3. **配置和设置**
   - 后端地址配置
   - 版本检测
   - 额度显示

---

## 风险和挑战

1. **IndexedDB 兼容性** - 不同浏览器实现可能有差异
2. **文件路径安全** - 跨平台路径处理
3. **性能优化** - 大量节点时的渲染性能
4. **错误处理** - 网络错误、API 错误、用户操作错误

---

## 测试计划

### 单元测试
- 工具函数测试 (引用解析、提示词拼接)
- Store 测试 (状态变更逻辑)

### 集成测试
- 节点创建和删除
- 连线创建和删除
- 工作流导出导入

### E2E 测试
- 完整工作流执行
- 刷新页面状态恢复

---

**最后更新**: 2026-06-21
**状态**: 开发中
