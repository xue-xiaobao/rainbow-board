<p align="center">
  <a href="https://github.com/xue-xiaobao/rainbow-board">
    <img src="https://img.shields.io/badge/GitHub-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub" />
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="MIT License" />
  </a>
</p>

<div align="center">

# 🌈 RainbowBoard 七彩画板

<p align="center">
  <b>
    面向 AIGC 创作者的无限画布工作流编辑器
    <br />
    在一张画布上串联文本、图像与视频的连续生产
  </b>
</p>

<p align="center">
  <a href="https://github.com/xue-xiaobao/rainbow-board/stargazers">
    <img src="https://img.shields.io/github/stars/xue-xiaobao/rainbow-board?style=for-the-badge&logo=github" alt="Stars Badge" />
  </a>
</p>

> 不是单点模型调用器，而是一个强调项目化、连续性和可追溯执行的可视化工作台。

</div>

---

## 🌟 项目简介

**RainbowBoard（七彩画板）** 是一个以无限画布为核心的 AIGC 内容生产平台，面向 AI 创作者、设计师和短视频生产者，帮助你在同一张画布上完成从创意构思到素材成片的完整工作流。

它不是简单的聊天界面或单点工具，而是一个强调**节点化编排**、**资产沉淀**和**多模态串联**的可视化工作台：

- ✅ **无限画布工作流**
  用节点和连线组织文本、图片、视频与执行关系，支持在同一画布内持续迭代。
- ✅ **多模态节点系统**
  支持文本节点（直接输入 / AI 生成）、图片节点（上传 / 即梦生成 / gpt-image-2）、视频节点（文本生成 / 图像参考生成）。
- ✅ **节点间引用与资产复用**
  通过 `@` 引用和连线拖拽，将上游节点的输出作为下游节点的输入，形成连续生产链路。
- ✅ **多模型统一接入**
  支持即梦（Jimeng/Seedance）、GPT Image、OpenAI 协议文本模型等多类模型接入。
- ✅ **项目化资产沉淀**
  画布、节点、连线与生成结果持久化存储，资产随项目持续积累，而不是停留在一次性对话里。
- ✅ **轻量桌面级交互**
  类 Figma 的拖拽缩放体验，支持右键菜单、节点拖线连接、键盘快捷键与画布状态持久化。

---

## 📦 主要能力

- **画布化内容生产**
  在同一界面中编排文本、参考图、图片生成、视频生成与项目素材。
- **文本节点双模式**
  支持直接输入文本，或调用配置好的 LLM 自动生成内容，并支持 `@` 引用其他节点。
- **图像到视频链路**
  图片节点可作为视频节点的参考资产，形成 "文生图 → 图生视频" 的连续生成闭环。
- **多模型配置管理**
  后端支持灵活配置即梦 CLI、GPT Image、OpenAI 协议文本模型等，前端统一调用。
- **前后端分离架构**
  前端基于 React + Vite，后端基于 Express + SQLite，轻量可独立部署。
- **数据持久化**
  画布状态、节点数据、连线关系全部落库存储，刷新不丢失。

---

## 🧩 适用场景

- AI 短片 / 漫剧 / 连续镜头的视觉分镜生产
- 角色卡、场景图、道具图的项目化沉淀
- 需要多步内容生产的工作流编排
- 需要在同一工作台里管理模型、素材与结果资产的创作者

---

## 📸 界面预览

### RainbowBoard 实际工作流画布
![RainbowBoard 工作流演示](./assets/demo-workflow.png)

---

## 🛠 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite |
| 状态管理 | Zustand |
| 样式 | 原生 CSS（温暖灰调设计系统） |
| 后端 | Node.js + Express + TypeScript |
| 数据库 | SQLite3 |
| 存储 | 本地文件系统（上传资源） |
| AI 接入 | 即梦 CLI、OpenAI API、GPT Image |

---

## 🚀 快速开始

### 环境要求

- Node.js >= 20.0.0
- pnpm / npm
- 即梦 CLI（可选，用于图片/视频生成）
- OpenAI API Key（可选，用于文本生成与 GPT Image）

### 1. 克隆仓库

```bash
git clone https://github.com/xue-xiaobao/rainbow-board.git
cd rainbow-board
```

### 2. 安装依赖

```bash
# 安装根目录依赖（如果有）
npm install

# 安装前端依赖
cd frontend && npm install && cd ..

# 安装后端依赖
cd backend && npm install && cd ..
```

### 3. 配置后端

```bash
cd backend
cp .env.example .env
# 编辑 .env，填入你的 OpenAI API Key 等配置
cd ..
```

### 4. 启动服务

```bash
# 终端 1：启动后端
cd backend
npm run build
npm start
# 服务运行在 http://localhost:3971

# 终端 2：启动前端
cd frontend
npm run dev
# 服务运行在 http://localhost:5173
```

打开浏览器访问 `http://localhost:5173` 即可开始使用。

---

## 📁 项目结构

```
rainbow-board/
├── frontend/          # React 前端
│   ├── src/
│   │   ├── components/    # 画布、节点、工具栏等组件
│   │   ├── stores/        # Zustand 状态管理
│   │   ├── utils/         # API 封装、数据库、辅助函数
│   │   └── types/         # TypeScript 类型定义
│   └── package.json
├── backend/           # Express 后端
│   ├── src/
│   │   ├── routes/        # API 路由（节点、边、上传、AI 生成等）
│   │   ├── services/      # 业务服务（即梦、GPT、存储等）
│   │   ├── db/            # SQLite 数据库与表结构
│   │   └── config/        # 运行时配置
│   └── package.json
├── docs/              # 需求文档与设计规范
├── assets/            # README 截图与演示素材
├── README.md
└── LICENSE
```

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

- 提交 bug 请描述复现步骤
- 提交功能建议请先查阅已有 Issue
- 代码风格保持与现有代码一致

---

## 📄 License

本项目基于 [MIT License](./LICENSE) 开源。

---

> 🎨 **RainbowBoard** — 让 AIGC 创作像画画一样自由。
