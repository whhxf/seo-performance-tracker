---
name: seo-performance-tracker
description: 引导用户配置 GSC/GA4/Bing API，通过本地脚本让 AI Agent 用自然语言查询 SEO 数据并生成分析报告。只要用户提到 SEO 表现、效果追踪、GSC、GA4、Bing、Search Console、独立站周报、weekly report、排名与流量、定时报告等，优先考虑使用本 skill。适用场景：跟踪 SEO 表现、查看某站排名与流量、自动分析 GSC/GA4 数据、独立站周报、每周固定复盘。触发词：SEO 表现、跟踪 SEO、效果追踪、帮我看看某站 SEO、GSC 数据、GA4 报告、Search Console、自动分析 SEO、SEO 监控、周报、每周复盘、独立站周报、weekly report。
---

# SEO 表现跟踪（AI Agent 驱动）

基于 [SagaSu 的实践](https://www.sagasu.art/p/gsc-ga4-bing-webmaster-api-integration-openclaw-ai-agent-query-seo-data)（X 推文 [2026955748799119665](https://x.com/sujingshen/status/2026955748799119665)）：用本地 AI Agent + 官方 API，实现「说一句话 → 拿到多站 SEO 分析报告」，零手动导出、本地处理、密钥可控。

## 历史数据追踪

**每次查询自动存档**：所有 GSC/GA4/Bing 查询结果自动保存到 `history/` 目录（JSON），累积后可追踪排名趋势。

### 查看历史记录
```bash
node scripts/history-store.cjs list              # 列出所有历史记录
node scripts/history-store.cjs list gsc 10        # 只看 GSC，最多 10 条
```

### 追踪某个关键词的排名变化
```bash
node scripts/history-store.cjs compare "video hosting" 30    # 对比近 30 天排名
node scripts/history-store.cjs trend "kingsway" md           # 生成排名趋势报告 (md)
node scripts/history-store.cjs trend "video hosting" csv     # 导出为 CSV
```

### 导出历史数据
```bash
node scripts/history-store.cjs export json 90    # 导出近 90 天 JSON
node scripts/history-store.cjs export md 30      # 导出排名汇总 Markdown
node scripts/history-store.cjs export csv 30     # 导出所有关键词 CSV
```

> 导出的文件保存在 `outputs/` 目录，格式为 `{类型}-{日期}.{格式}`。

### GSC 高级查询
```bash
node scripts/gsc-report.cjs default 7                     # 默认概览（Top 20 词）
node scripts/gsc-report.cjs default 30 --queries          # 拉取 Top 500 关键词
node scripts/gsc-report.cjs default 30 --daily            # 按日期拆分（每日数据）
node scripts/gsc-report.cjs default 30 --query="视频翻译"  # 查特定关键词的每日表现

# 自定义日期范围（查询任意历史时段）
node scripts/gsc-report.cjs default --queries --start-date=2026-03-23 --end-date=2026-03-29
node scripts/gsc-report.cjs default --start-date=2026-03-01 --end-date=2026-03-31
```

### 常见场景速查

| 用户说 | Agent 调用 |
|--------|-----------|
| "最近 7 天 GSC 数据" | `gsc-report.cjs default 7` |
| "最近 30 天完整关键词排名" | `gsc-report.cjs default 30 --queries` |
| "上上周（3/23-3/29）的关键词排名" | `gsc-report.cjs default --queries --start-date=2026-03-23 --end-date=2026-03-29` |
| "某个词的每日排名变化" | `gsc-report.cjs default 30 --daily --query="关键词"` |
| "看下历史查询记录" | `history-store.cjs list` |
| "某个词的历史排名变化" | `history-store.cjs compare "关键词" 90` |
| "生成某个词的排名趋势图" | `history-store.cjs trend "关键词" md` |
| "导出所有历史关键词数据" | `history-store.cjs export md 90` |

## 目标效果

- **用户说**：「帮我看看 example.com 最近一周的 SEO 表现」
- **Agent 行为**：调用本地脚本拉取 GSC / GA4 / Bing 数据，返回纯文本
- **Agent 输出**：结构化报告（点击/展示/CTR/排名、环比、机会词、行动建议）

与本项目**话题树技能**的关系：话题树负责「规划写什么」；本技能负责「发布后效果如何、下一步优化什么」。

---

## 技术架构（极简）

1. 用户用自然语言提问（某站、某时间段）
2. Agent 通过 **exec 工具**调用本地 Node.js 脚本
3. 脚本直接调用 **Google / Bing 官方 API**（GSC、GA4、Bing Webmaster）
4. 脚本返回**纯文本/JSON**给 Agent
5. Agent 分析数据并给出**可执行建议**（含机会词、异常、优先级）

可选：配合 **cron** 做每日/每周自动报告，异常及时预警。

---

## 配置流程（按顺序执行）

**配置入口**：所有参数均在本 skill 目录下通过 **环境变量文件** 配置。复制 `env.example` 为 `.env`，填写后保存（勿提交 `.env` 到 Git）。脚本与 Agent 从该 `.env` 读取凭证路径与 API Key。

总时长约 **60 分钟**，一次性配置后可持续使用。

### 第一步：Google Cloud Console（约 15 分钟）

1. 打开 [Google Cloud Console](https://console.cloud.google.com)
2. 创建新项目（例如 `openclaw-seo`）
3. 进入 **IAM & Admin → Service Accounts**
4. **Create Service Account**，名称如 `openclaw-seo-reader`；角色可先不选，后续在各产品单独授权
5. 创建后进入该 SA → **Keys → Add Key → Create new key → JSON**
6. 下载 JSON，保存到**本 skill 目录下的 `credentials/gcp-service-account.json`**（本目录已通过 `.gitignore` 忽略 `credentials/`）。在 `.env` 中设置 **`GCP_CREDENTIALS_PATH=credentials/gcp-service-account.json`**（从本 skill 目录执行脚本时用该相对路径即可）。

### 第二步：Google Search Console 授权（约 10 分钟）

1. 打开 [Google Search Console](https://search.google.com/search-console)
2. **每个站点**需单独操作：选择对应站点
3. 左侧 **设置 → 用户和权限 → 添加用户**
4. 输入 Service Account 的 **client_email**（来自上述 JSON）
5. 权限选择 **「受限」**（只读即可）

### 第三步：Google Analytics 4 授权（约 10 分钟）

1. 打开 [Google Analytics](https://analytics.google.com)
2. 左下角 **管理** → 选择目标**媒体资源（Property）**
3. 「媒体资源」栏 → **媒体资源访问权限管理**
4. 右上角 **+ → 添加用户**
5. 输入 **client_email**，角色选 **「查看者」**

### 第四步：Bing Webmaster Tools（约 5 分钟）

1. 打开 [Bing Webmaster Tools](https://www.bing.com/webmasters)
2. 右上角 **设置（齿轮）→ API access**
3. 点击 **Generate API Key**
4. 将 API Key 填入本 skill 目录下 `.env` 中的 **`BING_WEBMASTER_API_KEY`**（勿提交到 Git）。

### 第五步：安装依赖（约 5 分钟）

脚本需使用 Google / Bing 官方 Node 库，例如：

- `googleapis`（GSC、GA4）
- Bing Webmaster 官方 API（HTTP 请求或官方 SDK 若有）

在脚本所在目录或工作区执行：`npm install googleapis` 等（具体见脚本实现）。

### 第六步：脚本实现（约 15 分钟）

需至少两个能力（可拆成两个脚本或一个脚本多子命令）：

| 能力 | 说明 | 输出 |
|------|------|------|
| **GetRankAndTrafficStats** | 流量与排名概览 | 点击、展示、CTR、平均排名、可选环比 |
| **GetQueryStats** | 关键词/查询维度 | 查询词、展示、点击、排名、CTR 等，**JSON 或表格文本** |

脚本调用方式示例（供 Agent exec 使用）：

- `node scripts/gsc-report.cjs <站点代号> 7` → 最近 7 天 GSC
- `node scripts/ga4-report.cjs <站点代号> 7` → 最近 7 天 GA4
- `node scripts/bing-report.cjs` → Bing Webmaster 数据

站点代号与 GSC/GA4 中站点或 Property 的对应关系，由用户在 `.env` 中通过 **`DEFAULT_SITE`** 等配置（详见 `env.example`）。

---

## 推荐工作区结构

- **本 skill 目录**：放置 `SKILL.md`、`weekly-report.md`、**`.env`**（由 `env.example` 复制并填写）、可选 `scripts/`。
- 若脚本放在本 skill 内：
  ```
  seo-performance-tracker/
  ├── SKILL.md
  ├── env.example
  ├── .env              # 勿提交
  ├── scripts/
  │   ├── gsc-report.cjs
  │   ├── ga4-report.cjs
  │   └── bing-report.cjs
  └── credentials/      # 可选，存 GCP JSON 等；勿提交
  ```
- 凭证与密钥：仅通过 `.env` 中的路径或键值引用，不提交到 Git；`.gitignore` 已包含 `.env`、`credentials/`。

---

## Agent 使用规范

1. **识别意图**：
   - 用户问「某站最近 N 天/周/月 SEO 表现」「帮我看看 GSC 数据」「跟踪一下排名」等 → 启用本技能，按需查询单项数据。
   - 用户说「生成周报」「帮我做独立站周报」「每周复盘」「weekly report」→ 读取 `.cursor/skills/seo-performance-tracker/weekly-report.md`，按周报完整流程执行（7 大维度全量拉取 + 存档）。
2. **解析参数**：从用户话中提取「站点/域名」和「时间范围」（默认可 7 天）。
3. **调用脚本**：通过 exec 依次执行上述脚本，传入站点与天数；捕获 stdout/stderr。
4. **生成报告**：根据脚本输出的纯文本/JSON，整理为：
   - **GSC**：总点击、总展示、平均 CTR、平均排名、环比；高展示低点击词 → 标为机会点
   - **GA4**：活跃用户、流量来源、热门页面
   - **Bing**：爬取状态、Top 关键词
   - **行动建议**：1～3 条可执行、带优先级的建议
5. **安全**：不要求用户把密钥贴到对话里。所有配置仅在本 skill 目录下的 `.env` 中完成（复制 `env.example` 为 `.env` 后填写）；脚本或 Agent 从该 `.env` 读取凭证路径与 API Key。

---

## 报告输出模板（供 Agent 填写）

```markdown
## [域名] 近 [N] 天 SEO 数据

### Google Search Console
- 总点击: [x] 次 (↑/↓ [y]% vs 上周期)
- 总展示: [x] 次 (↑/↓ [y]%)
- 平均 CTR: [x]%
- 平均排名: [x]

### Google Analytics 4
- 活跃用户: [x]
- 主要流量来源: [简要]
- 热门页面: [Top 1–3]

### Bing Webmaster
- 爬取/索引概况
- Top 关键词与排名

### 机会与建议
- [高展示低点击词] → 建议优化 title/description…
- [页面/流量建议]
- [Bing 侧建议]
```

---

## 独立站运营周报（每周固定复盘）

> 触发词：「生成本周周报」「帮我做独立站周报」「每周复盘」「weekly report」

当用户触发周报时，Agent 按以下 **7 大维度** 依次拉取数据并生成结构化报告，完整覆盖独立站运营的核心健康指标。

### 周报执行流程

```
[触发] → 确认站点 & 时间范围（默认本周 vs 上周）
       → 依次调用脚本拉取 7 维度数据
       → 生成结构化周报 Markdown
       → 存档到 outputs/weekly-report-{YYYY-MM-DD}.md
       → 输出 3 条优先级最高的行动建议
```

### 7 大核心维度（每周必 Review）

#### 维度 1：搜索可见性（GSC）
**核心问题**：我的站点在 Google 上被看见了多少次？用户愿不愿意点？

| 指标 | 关注点 | 预警阈值 |
|------|--------|----------|
| 总展示量 | 整体趋势 vs 上周 | 环比下跌 >15% 需排查 |
| 总点击量 | 实际访问意愿 | 环比下跌 >10% 需排查 |
| 平均 CTR | 标题/描述吸引力 | 低于行业均值 2% 需优化 |
| 平均排名 | 整体位置 | 上升 or 下跌 >3 位需关注 |
| 高展示低点击词 | 内容机会点（Top 5） | CTR < 1% 且展示 > 500 |

脚本：`node scripts/gsc-report.cjs <站点> 7`

#### 维度 2：自然流量质量（GA4）
**核心问题**：来的访客是否真实有效？有没有完成我期望的行为？

| 指标 | 关注点 |
|------|--------|
| Organic 活跃用户数 | 自然流量规模趋势 |
| 平均互动时长 | 内容是否留住用户 |
| 互动率（Engagement Rate） | 低于 40% 说明内容与意图不匹配 |
| 跳出率高的落地页 Top 3 | 需要优化内容或加 CTA |
| 新用户 vs 回访用户比例 | 判断品牌沉淀效果 |

脚本：`node scripts/ga4-report.cjs <站点> 7`

#### 维度 3：关键词排名动态（GSC）
**核心问题**：我的核心词和内容词排名是否在向前推进？

| 关注点 | 说明 |
|--------|------|
| 核心词（Pillar 页）排名变化 | 是否进入 Top 10 / Top 3 |
| 长尾词新增排名 | 发布的 Cluster/Leaf 内容是否被索引 |
| 排名骤降词（环比跌 >5 位） | 可能被算法惩罚或竞品超越 |
| 新触达词（上周无排名本周有） | 内容扩散效果 |

脚本：`node scripts/gsc-report.cjs <站点> 7 --queries`

#### 维度 4：页面与内容表现（GA4 + GSC）
**核心问题**：哪些页面在带流量？哪些页面在浪费曝光？

| 关注点 | 说明 |
|--------|------|
| 流量 Top 10 页面（自然） | 验证话题树优先级是否有效 |
| 新发布页面的首周表现 | 收录速度、初始排名 |
| 高展示低点击页面 | Meta Title/Description 需要 A/B 测试 |
| 流量下跌页面（环比 >20%） | 内容老化、竞品入侵 |

#### 维度 5：转化漏斗健康度（GA4）
**核心问题**：流量有没有转化成商业价值？漏斗哪个环节在漏水？

| 指标 | 关注点 |
|------|--------|
| 目标转化率（Lead / 购买 / 注册） | 核心商业指标，周环比 |
| 转化路径 Top 3 页面 | 哪些内容在直接带转化 |
| 高流量零转化页面 | 内容与 CTA 匹配问题 |
| Email 订阅 / 表单提交量（如有） | 私域积累效率 |

脚本：`node scripts/ga4-report.cjs <站点> 7 --conversions`

#### 维度 6：Bing 生态表现（Bing Webmaster）
**核心问题**：Bing 渠道是否健康？（通常占总搜索量 10–20%，不可忽视）

| 指标 | 关注点 |
|------|--------|
| Bing 总点击 & 展示 | 趋势 vs 上周 |
| 爬取健康度 | 有无爬取错误或被封锁 |
| Top 关键词 & 排名 | 与 GSC 对比是否有差异机会 |
| 索引页面数变化 | 新内容是否被 Bing 收录 |

脚本：`node scripts/bing-report.cjs`

#### 维度 7：内容发布节奏（本地文件）
**核心问题**：本周内容产出是否按话题树计划执行？下周优先级是什么？

| 关注点 | 说明 |
|--------|------|
| 本周发布数量 vs 计划 | 执行率 |
| 已发布内容的收录状态 | 未收录需主动提交 |
| 话题树发布日程进展 | 读取 `outputs/*/publish-schedule.md` |
| 下周待发布内容（Top 3） | 优先级最高的 Leaf 页 |

---

### 周报输出模板（Agent 填写）

````markdown
# 独立站 SEO 周报 — {域名} | {YYYY-MM-DD 周一} ~ {YYYY-MM-DD 周日}

> 生成时间：{timestamp} | 对比周期：上一自然周

---

## 🔍 本周一句话总结
{用 1-2 句话概括本周核心亮点和最大风险}

---

## 1. 搜索可见性（GSC）
| 指标 | 本周 | 上周 | 变化 |
|------|------|------|------|
| 总展示 | | | ↑/↓ x% |
| 总点击 | | | ↑/↓ x% |
| 平均 CTR | | | |
| 平均排名 | | | |

**高展示低点击机会词（CTR < 1%）：**
1. [词] — 展示 x 次，CTR x%，建议优化 Title/Description
2. ...

---

## 2. 自然流量质量（GA4）
- Organic 活跃用户：x（↑/↓ x% vs 上周）
- 平均互动时长：xs
- 互动率：x%
- 跳出率最高落地页：[页面] — x%（需优化内容或 CTA）

---

## 3. 关键词排名动态
**上升词（本周涨幅最大 Top 3）：**
- [词] 第 x 位 → 第 x 位

**预警：排名骤降词：**
- [词] 第 x 位 → 第 x 位（↓x 位，需排查）

**新触达词（本周首次出现）：**
- [词] — 当前排名 x 位，展示 x 次

---

## 4. 页面内容表现
**流量 Top 5 页面（自然）：**
1. [URL] — x 次点击
2. ...

**流量下跌页面（环比 > 20%）：**
- [URL] — 下跌 x%（可能原因：内容老化 / 竞品超越）

---

## 5. 转化漏斗
- 目标转化量：x（↑/↓ x% vs 上周）
- 转化率：x%
- 带来转化的内容 Top 3：[页面列表]
- 高流量零转化页面：[页面] — 建议检查 CTA

---

## 6. Bing 生态
- Bing 点击：x（↑/↓ x%）| 展示：x
- 爬取健康：✅ 正常 / ⚠️ 有 x 个错误
- Bing Top 词：[词] 排名 x

---

## 7. 内容发布进度
- 本周发布：x 篇（计划 x 篇，执行率 x%）
- 待收录页面：x 个（建议手动提交 Google Search Console）
- 下周优先发布 Top 3：
  1. [Leaf 标题] — 优先级分: x | 漏斗: TOFU/MOFU/BOFU
  2. ...

---

## ⚡ 本周行动建议（按优先级）

| 优先级 | 行动 | 预期效果 | 负责人 |
|--------|------|----------|--------|
| 🔴 P0 | | | |
| 🟡 P1 | | | |
| 🟢 P2 | | | |

---

*报告由 AI Agent 自动生成 | 数据来源：GSC + GA4 + Bing Webmaster*
````

### 周报存档规则

- 文件路径：`outputs/weekly-report-{YYYY-MM-DD}.md`（日期取周一）
- Agent 在生成完成后**自动写入**，无需用户手动操作
- 历史周报可用「读一下上周/上上周的周报」来调取对比

---

## 进阶：定时报告

用户若需要每日/每周自动报告：

- 编辑 crontab：`crontab -e`
- 示例（每周一 9 点自动生成周报并落盘）：  
  `0 9 * * 1 node /path/to/workspace/scripts/gsc-report.cjs default 7 >> /tmp/weekly-seo-report.log 2>&1`
- 示例（每天 8 点跑 GSC 并落盘）：  
  `0 8 * * * node /path/to/workspace/scripts/gsc-report.cjs default 7 >> /tmp/seo-report.log 2>&1`
- Agent 可提醒用户：日志路径、如何用「读一下最近一次报告」来查看。

---

## 安全与踩坑（简要）

- **配置**：仅在本 skill 目录下使用 `.env`（由 `env.example` 复制）；密钥与凭证路径写在 `.env` 中，不写入对话、不提交版本库。本 skill 已提供 `.gitignore`，包含 `.env`、`credentials/`。
- **GSC**：若多站点，每个站点都需在「用户和权限」里添加同一 Service Account 的 client_email。
- **GA4**：需在「媒体资源」级别授权，且 API 需在 GCP 项目中启用（如 Analytics Data API）。
- **Bing**：API Key 仅需在 Webmaster 后台生成并保存到本地文件。

更多细节与踩坑见原文：[将 GSC、GA4、Bing Webmaster API 接入 OpenClaw](https://www.sagasu.art/p/gsc-ga4-bing-webmaster-api-integration-openclaw-ai-agent-query-seo-data)。

---

## 双市场说明（与本项目一致）

| 市场 | 效果追踪数据源 |
|------|----------------|
| **海外** | GSC + GA4 + Bing Webmaster（本 skill 默认覆盖） |
| **国内** | 百度搜索资源平台 + 百度统计（本项目 Phase 3 规划；本 skill 可后续扩展或单独文档） |

当用户明确做**国内站点**时，可说明：当前技能以海外 GSC/GA4/Bing 为主；国内需百度搜索资源平台/百度统计 API，可按同样「脚本 + exec + 自然语言」思路后续接入。
