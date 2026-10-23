# AI × INDIE LAB

面向 AI 辅助独立游戏开发者的阅读与知识积累入口。

**生产域名：https://daily.yifanook.com/**

Cloudflare Pages 默认地址：https://ai-indie-daily.pages.dev/

## 阅读体验

- 首页页头只保留标题与紧凑栏目选择，详情页头只留标题。默认「全部」，栏目选择保存在当前浏览器。
- 四个栏目：AI 资讯、AI 学习、游戏工具、游戏创意。
- 紧凑、普通字体的响应式新闻卡片。白色无边框卡片与浅灰背景区分清楚，不提供打乱入口。
- 每篇有独立稳定链接 `article.html?id=<slug>`；旧 `#article-数字` 链接仍兼容。
- 封面只能采用对应原文或官方素材，附来源与使用依据；无法验证或加载失败时显示文字卡片，不使用无关插画。

## 新增文章：只加一个文件

1. 先读 [内容维护说明](docs/CONTENT_GUIDE.md)。复制 [文章模板](docs/article-template.json) 到 `_data/articles/<稳定ID>.json`。
2. 文件名、`id`、`slug` 一致；填写栏目、日期、摘要、正文 blocks、sources、coverProvenance。已发布 ID 不改。
3. 执行 `npm run check`、`npm test`、`npm run build`。
4. 预览后在已获授权范围内提交这个文章文件（有本地配图时一并提交素材）。

不需要编辑首页、路由、清单或索引。25 篇历史文章完整迁移，原始字段、正文、固定 ID、`legacyIndex` 和未经核实的新闻标记均保留。`legacyCover` 只是旧概念插画的迁移记录，不参与显示。

日常内容由用户的定时模型会话负责查来源、选题、撰写和校验。仓库不自行唤醒模型、不自动生成文章，不需要 API Key。保留手动 RSS 候选收集工作流，不自动写入或发布内容。

## 本地开发

原生 HTML / CSS / JavaScript；Node.js 22+、Python 3.11+，无 npm 运行时依赖。

```sh
npm run check
npm test
npm run build
python3 -m http.server 8767 --bind 127.0.0.1 --directory dist
```

打开 `http://127.0.0.1:8767/`。修改文件后重新构建。不要用静态 HTTP 服务直接打开源码根目录：`data/news.json` 是 Jekyll Liquid 模板，必须先编译。

长期项目目录：`/Users/huhufan/work/dev/ai-indie-daily`。

## 页面与内容分离

- `_data/articles/*.json`：唯一文章源，一篇一个文件，自动发现。
- `data/news.json`：保留的旧 Jekyll 兼容模板，不直接作为生产 JSON 发布。Cloudflare 构建由 `scripts/build.mjs` 从文章源生成 `dist/data/news.json`。
- `scripts/articles.mjs`：本地构建/检查使用相同文件集合；文件名、slug、日期、正文、来源、封面 provenance 校验。
- `scripts/build.mjs`：本地与 Cloudflare 共用的无依赖构建，产出 `dist/` 和可浏览 JSON 索引。
- `index.html` / `article.html` / `app.js` / `styles.css`：共用展示和交互，不嵌入文章。
- `content.mjs`：安全渲染、过滤、打乱与 schema 校验。正文不执行 HTML。
- `docs/article-template.json`：不参与发布的贡献模板。

栏目偏好只保存在当前浏览器；禁用存储时仍可阅读。界面不提供收藏、复制链接或额外返回入口，使用浏览器后退恢复列表位置与顺序。历史收藏存储不主动删除。2026-10-22 对现有内容完成来源复核与扩写，二手报道和原创原型的证据边界在正文中说明。

## 发布：Cloudflare Pages

GitHub 仓库 `fanook/ai-indie-daily` 继续保存源码和内容；生产托管改为 Cloudflare Pages 项目 `ai-indie-daily`，不影响独立的 motes 站点。

- 生产分支：`main`
- 根目录：仓库根目录
- 构建命令：`npm run build`
- 输出目录：`dist`
- 生产域名：`daily.yifanook.com`
- 默认地址：`ai-indie-daily.pages.dev`

Cloudflare 的 GitHub 集成在 main 更新后自动构建，不需要在仓库添加 API Key、部署 Token 或新的定时任务。只提交一篇独立文章及其素材即可，索引仍自动生成；索引更新时间取文章 `revised` / `date`，不是构建时间。`dist/`、`_site/` 为生成目录，不提交。

`Validate site and content` 继续执行数据检查、回归测试、构建和浏览器验收；保留的 Jekyll 检查仅用于旧格式兼容，不再代表生产部署。发布前仍需本地通过检查。

迁移时先核实 Cloudflare 部署、生产域名和 HTTPS 正常，再停用旧 GitHub Pages。以后不要恢复 GitHub Pages 发布。合并或直接推送 main 会触发 Cloudflare 构建；分支和草稿 PR 不代表生产上线。发布需用户授权，完成后核实远程提交、Cloudflare 部署状态与线上结果，不把成功 push 当成成功上线。

### 迁移验收记录（2026-10-23）

已实测生产域名与 Pages 默认地址均可通过 HTTPS 阅读 25 篇文章；首页分页、详情与浏览器后退正常，CSS、JavaScript、JSON 索引及四种本地封面均使用根目录路径，不依赖旧 `/ai-indie-daily/` 前缀。Cloudflare 将 `article.html` 规范化为 `/article` 时保留文章 ID 参数。此记录仅覆盖桌面浏览器；旧 GitHub Pages 停用及本次提交的自动构建仍需单独核实。

## 手动 RSS 候选工具

```sh
python3 scripts/update.py --dry-run
python3 scripts/update.py --output /tmp/news-candidates.json
```

读取 Codex、Claude Code、ComfyUI、Godot 官方 Atom 源；只输出近 14 天候选，不改文章。定时模型需自己核实和写作，不能将候选 JSON 直接覆盖文章源。密钥不得写入仓库。
