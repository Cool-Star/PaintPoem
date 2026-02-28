# 贡献指南

感谢您对「绘诗成帖」项目的关注！我们欢迎各种形式的贡献。

## 如何贡献

### 报告问题

如果您发现了 bug 或有功能建议，请通过 [GitHub Issues](https://github.com/xiaoxing/paint-poem/issues) 提交。

提交问题时请包含：
- 问题的详细描述
- 复现步骤
- 期望行为 vs 实际行为
- 系统环境（操作系统、应用版本）
- 截图（如适用）

### 提交代码

1. **Fork 仓库** - 点击右上角的 Fork 按钮
2. **克隆仓库** - `git clone https://github.com/YOUR_USERNAME/paint-poem.git`
3. **创建分支** - `git checkout -b feature/your-feature-name`
4. **提交更改** - `git commit -m "feat: add some feature"`
5. **推送分支** - `git push origin feature/your-feature-name`
6. **创建 Pull Request** - 在 GitHub 上提交 PR

### 开发规范

#### 代码风格

- TypeScript 代码遵循项目现有风格
- 使用有意义的变量名和函数名
- 添加必要的注释说明复杂逻辑

#### 提交信息规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<type>(<scope>): <subject>

<body>
```

类型说明：
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式调整（不影响功能）
- `refactor`: 代码重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具相关

示例：
```
feat(pdf): 添加回宫格支持

- 实现回宫格绘制逻辑
- 添加格子类型选择器
```

### 开发环境设置

```bash
# 1. 克隆仓库
git clone https://github.com/xiaoxing/paint-poem.git
cd paint-poem

# 2. 安装依赖
pnpm install

# 3. 启动开发服务器
pnpm dev
```

### 项目结构说明

```
src/
├── components/    # 可复用组件
├── pages/         # 页面组件
├── services/      # 业务逻辑（PDF生成、AI服务等）
├── store/         # Redux 状态管理
├── db/            # 数据库操作
├── datas/         # 数据源配置
└── types/         # TypeScript 类型定义
```

### 测试

提交 PR 前请确保：
- [ ] 代码可以正常编译 (`pnpm tsc --noEmit`)
- [ ] 没有引入新的 TypeScript 错误
- [ ] 功能在本地测试通过

## 行为准则

- 尊重所有参与者
- 接受建设性的批评
- 关注对社区最有利的事情

## 许可证

通过贡献代码，您同意您的贡献将在 [MIT 许可证](LICENSE) 下发布。
