# 密切关系威胁识别网站

面向 **审计 / 鉴证业务** 的「密切关系威胁（Familiarity Threat）」识别与独立性教育工具。
纯前端静态站点，手机、电脑均可访问，可一键部署到 GitHub Pages。

## 功能一览

- **威胁情形知识库**：四类密切关系威胁的定义、判定要点与防范措施
- **威胁自测**：14 道结构化问卷，自动计算风险等级并给出建议
- **情景决策演练**：3 个互动情景题，即时判定与解析
- **案例库**：安永恋爱关系案、安永礼品款待案、安然/安达信案
- **防范清单**：可勾选的合规检查清单
- **报告导出**：本地生成 Markdown 格式识别报告（不联网）
- **AI 辅助问答**：调用 DeepSeek 大模型，对用户描述的具体情境判断是否存在密切关系威胁并给出建议
- **PWA / 手机端**：支持添加到手机主屏幕，可离线访问，响应式适配手机与电脑

## 本地运行

无需构建，直接用任意静态服务器打开即可，例如：

```bash
# 方式一：Python
python -m http.server 8080
# 浏览器访问 http://localhost:8080

# 方式二：VS Code Live Server 插件
# 右键 index.html -> Open with Live Server
```

也可以直接双击 `index.html` 打开（部分浏览器对本地 `file://` 的脚本加载有安全限制，推荐用静态服务器）。

## 部署到 GitHub Pages

### 方式一：使用 GitHub Actions（推荐）

1. 将本目录推送到 GitHub 仓库（例如 `familiar-threat`）。
2. 仓库已内置 `.github/workflows/deploy.yml`。
3. 在仓库 **Settings → Pages** 中，将 Source 设为 `GitHub Actions`。
4. 每次推送到 `main` 分支会自动构建并部署。

### 方式二：手动部署

1. 在仓库 **Settings → Pages** 中，将 Source 设为 `Deploy from a branch`，选择 `main` 分支与 `/ (root)` 目录。
2. 确保 `index.html`、`style.css`、`data.js`、`app.js` 位于仓库根目录。

## 目录结构

```
familiar-threat/
├── index.html            # 页面结构
├── style.css             # 样式（响应式）
├── data.js               # 数据（威胁情形/问卷/情景/案例/清单/AI 配置）
├── app.js                # 交互逻辑（测评、演练、导出、AI 问答）
├── manifest.json         # PWA 应用清单
├── service-worker.js     # 离线缓存
├── icon-192.png          # 应用图标
├── icon-512.png          # 应用图标（高清）
├── apple-touch-icon.png  # iOS 主屏幕图标
├── README.md
└── .github/workflows/
    └── deploy.yml        # GitHub Pages 自动部署
```

## 手机端使用（PWA）

- **添加到主屏幕**：在手机浏览器（Chrome/Safari）打开站点后，选择「添加到主屏幕 / 安装应用」，即可像原生 App 一样从桌面直接打开。
- **离线访问**：首次打开后，核心资源会被缓存，之后即使断网也能访问已缓存内容（AI 问答需联网）。
- **响应式适配**：手机、平板、电脑自动适配布局。

> 注：PWA 的离线缓存与「添加到主屏幕」需在 HTTPS 或 localhost 下生效；GitHub Pages 默认 HTTPS，直接可用。

## 隐私

- 测评、情景、防范清单等数据仅保存在访问者浏览器本地（`localStorage`），不经过任何服务器，不上传云端。
- **AI 辅助问答**会把用户输入的问题发送至 DeepSeek API 处理，请勿输入敏感或隐私信息。

## AI 辅助问答配置

AI 功能配置位于 `data.js` 中的 `AI_CONFIG`，包括：

- `apiKey`：DeepSeek API Key
- `url`：DeepSeek 接口地址（`https://api.deepseek.com/chat/completions`）
- `model`：`deepseek-chat`
- `systemPrompt`：AI 人设与回答结构提示词
- `examples`：示例问题

> ⚠️ **安全警告**：API Key 硬编码在前端，公开部署（如 GitHub Pages）后任何人都能通过浏览器开发者工具查看到该 Key，存在被盗用的风险。仅建议用于教学/演示；正式使用请改用后端代理或服务端环境变量注入，切勿在公开仓库中提交真实 Key。
