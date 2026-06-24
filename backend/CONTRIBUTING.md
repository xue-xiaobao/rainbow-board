# 贡献指南

感谢你考虑为 RainbowBoard 后端做出贡献！

## 行为准则

本项目采用开源社区通用行为准则：
- 尊重不同观点和经验
- 优雅接受建设性批评
- 关注对社区最有利的事
- 对其他社区成员表示同理心

## 如何贡献

### 报告问题

发现 bug？请创建 Issue 并包含：
- 问题简述
- 复现步骤
- 预期行为
- 实际行为
- 环境信息（Node.js 版本、操作系统等）
- 日志或截图（如适用）

### 提交代码

1. Fork 本仓库
2. 创建你的特性分支
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. 进行更改并确保代码通过测试
4. 提交更改
   ```bash
   git commit -m "feat: add your feature description"
   ```
5. 推送到你的分支
   ```bash
   git push origin feature/your-feature-name
   ```
6. 提交 Pull Request

### 代码风格

- 使用 TypeScript
- 遵循现有的代码格式化风格
- 使用有意义的变量和函数名
- 添加必要的注释
- 保持函数单一职责

### 提交信息规范

我们使用约定式提交（Conventional Commits）：

- `feat:` 新功能
- `fix:` 修复 bug
- `docs:` 文档更新
- `style:` 代码格式调整（不影响功能）
- `refactor:` 代码重构（非新功能/非 bug 修复）
- `test:` 添加或修改测试
- `chore:` 构建过程或辅助工具变动

示例：
```
feat: add image crop support
fix: resolve memory leak in video generation
docs: update API documentation
```

## 开发环境设置

```bash
# 克隆你的 fork
git clone https://github.com/YOUR_USERNAME/rainbow-board.git
cd rainbow-board/backend

# 安装依赖
npm install

# 复制环境变量
cp .env.example .env

# 启动开发服务器
npm run dev
```

## 测试

```bash
# 运行测试（如已配置）
npm test

# 类型检查
npm run type-check
```

## 发布流程

1. 更新版本号（遵循语义化版本）
2. 更新 CHANGELOG.md
3. 创建 Git tag
4. 发布到 npm（如适用）

## 需要帮助？

- 查看 [README.md](README.md)
- 浏览现有 Issues
- 在讨论区提问

再次感谢你的贡献！
