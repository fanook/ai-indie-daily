# AI × INDIE LAB

面向 AI 辅助独立游戏开发者的阅读与知识积累入口。

**线上地址：https://fanook.github.io/ai-indie-daily/**

## 维护方式

日常内容由用户的**定时模型会话**完成：查阅来源、判断价值、撰写文章、校验数据、提交并推送。模型可以利用 RSS 作为线索，但文章不是固定脚本搬运的摘要。

- 四个栏目：AI 资讯、AI 学习、游戏工具、游戏创意。支持图文网格 / 纯文字列表切换，并记住阅读偏好。
- 模型决定文章的章节与深度；前端统一排版。无需硬凑章节、字数或每日条数。
- 仓库不会自行唤醒模型。每日北京时间 09:30 的会话需要在用户使用的工具中另行设置；本次代码不创建该会话。
- 原有 GitHub Actions 每日 RSS 定时任务已取消。保留 `Collect RSS candidates (manual)` 供手动取素材，生成候选 JSON 下载产物，**不自动改动或发布内容**。

写文章请先读 [内容维护说明](docs/CONTENT_GUIDE.md)；定时会话可采用文末的任务提示词。

## 本地开发

长期项目目录：`/Users/huhufan/work/dev/ai-indie-daily`。

纯 HTML / CSS / JavaScript；无需前端框架、依赖安装、打包或 API Key。

```sh
python3 -m http.server 8767 --bind 127.0.0.1
```

打开 `http://127.0.0.1:8767/`。不要直接双击 HTML，浏览器需要 HTTP 才能加载内容数据。

验证（Node.js 22+ 与 Python 3.11+）：

```sh
npm run check
npm test
```

## 页面与数据

| 文件 | 用途 |
| --- | --- |
| `index.html` | 栏目下拉选择、搜索、分类、日期排序、月份归档与全站收藏 |
| `article.html` | 独立文章地址：`article.html?id=稳定ID` |
| `styles.css` | 唯一的样式文件，共用浅色 / 深色设计变量与手机布局 |
| `theme.js` | 首次渲染前读取明确保存的主题，默认浅色 |
| `app.js` | 页面交互、加载错误处理、详情展示和收藏 |
| `content.mjs` | 数据筛选、富文本块、安全渲染与数据校验 |
| `data/news.json` | 全部文章和历史内容，新增时保留旧条目 |
| `scripts/validate.mjs` | 发布前内容和页面资源检查 |
| `scripts/update.py` | 可选的手动 RSS/Atom 素材收集器 |

25 条原有内容及其字段保留；新增固定 ID 和旧链接映射，不再使用数组下标定位文章。旧的 `#article-数字` 链接通过固定的 `legacyIndex` 跳转，旧 localStorage 收藏首次访问时迁移。

收藏保存在当前浏览器的 `indielab_saved_v2`，不跨设备同步。主题使用 `indielab_theme`，阅读模式使用 `indielab_view`。浏览器禁用存储时仍可阅读，并提示收藏只能临时使用。

详情支持段落、分级标题、列表、操作步骤、代码、引用、图片和链接；不会把短笔记用空白撑成长文。未经复核的旧新闻已加提示；本轮只迁移内容，不能据此认为原报道全部核实。工具未提供可靠依据的价格、平台和授权显示未知。

## 发布

沿用 GitHub Pages 的 `main` 分支根目录部署方式，无须更换原地址。

1. 拉取最新内容，阅读并保留工作区中的其他修改。
2. 修改后运行 `npm run check` 与 `npm test`，使用浏览器检查页面。
3. 提交并推送 `main`；以 GitHub Actions 中 Pages 的部署结果和线上页面为准。
4. `Validate site and content` 检查失败时及时修复。它是独立检查，并不阻止基于分支的 Pages 发布，因此发布前必须本地通过检查。

CSS 与脚本入口使用版本参数，设计变更时同步提升两页中的版本。文章数据用 `cache: no-store` 加载，避免浏览器长期复用旧 JSON；GitHub Pages/CDN 本身仍可能有短暂部署延迟。

如果未来用工作流自动提交，要注意：`GITHUB_TOKEN` 推送通常不会触发新的 Pages 构建。当前日常发布设计为定时模型会话使用已授权的 Git 凭证推送，而手动 RSS 工作流只提供候选产物。

## 手动 RSS 工具（可选）

只读测试，不改数据：

```sh
python3 scripts/update.py --dry-run
```

生成待审候选文件：

```sh
python3 scripts/update.py --output /tmp/news-candidates.json
```

读取 Codex、Claude Code、ComfyUI 与 Godot 的官方 Atom 发布源。仅收录近 14 天且带有效时间的条目，不强行补齐四栏目；去除跟踪参数后按链接去重，按上海时区生成展示日期。保存原始时间，不补造分析。全部源失败则退出并保留原文件，部分失败会明确输出；写入使用原子替换，不再截断为 250 条。

本轮使用离线 RSS/Atom 样例验证边界行为；没有执行真实源采集，当前各源网络可达性尚未验证。运行此工具时遵守个人网络策略。

未接入 LLM API，也不需要在仓库存放密钥。定时会话使用其自身已配置的模型能力；如果未来新增 API 调用，密钥只能使用 Secrets 或运行环境，不能写进仓库。
