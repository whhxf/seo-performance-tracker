# seo-performance-tracker Skill

通过 **GSC / GA4 / Bing Webmaster API** 让 AI Agent 用自然语言查询 SEO 数据并生成分析报告或周报。配置一次后，说「帮我看看某站最近一周的 SEO 表现」或「生成本周周报」即可获得结构化报告与行动建议。

**不依赖特定父项目**：将本目录复制到任意项目的 `.cursor/skills/` 或用户级 `~/.cursor/skills/` 即可使用。

---

## 安装

任选其一：

1. **项目级**：复制到目标项目的 `.cursor/skills/` 下。  
   `cp -r seo-performance-tracker /path/to/your-project/.cursor/skills/`
2. **用户级**：复制到 `~/.cursor/skills/`，则所有项目可用。  
   `cp -r seo-performance-tracker ~/.cursor/skills/`

---

## 配置（仅需本目录下一个环境变量文件）

所有参数均通过**本 skill 目录下的 `.env`** 配置，无需在别处建 `credentials/` 或写死路径。

1. 在本 skill 目录执行：  
   `cp env.example .env`
2. 编辑 `.env`，按注释填写：
   - **GCP_CREDENTIALS_PATH**：GCP Service Account JSON 路径。**推荐**将 JSON 放在本 skill 的 `credentials/` 下（如 `credentials/gcp-service-account.json`），并设 `GCP_CREDENTIALS_PATH=credentials/gcp-service-account.json`，便于在本目录直接测试。
   - **BING_WEBMASTER_API_KEY**：Bing Webmaster Tools → 设置 → API access 中生成的 Key
   - **DEFAULT_SITE**（可选）：默认站点代号，与你在 GSC/GA4 中的约定一致
3. **不要将 `.env` 提交到 Git**；本目录已含 `.gitignore`。

**若你之前用的是 `~/.openclaw/workspace/credentials`**：把该目录下的 `gcp-service-account.json` 复制到本 skill 的 `credentials/` 下，在 `.env` 中设 `GCP_CREDENTIALS_PATH=credentials/gcp-service-account.json` 即可；Bing Key 直接填到 `BING_WEBMASTER_API_KEY`。

GSC/GA4 的授权步骤（为 SA 的 client_email 在 Search Console 与 GA4 中授权）见 SKILL.md 内「第二步」「第三步」。

---

## 使用方式

在 Cursor 中直接说需求即可，例如：

- 「帮我看看 example.com 最近一周的 SEO 表现」
- 「跟踪一下某站 GSC 数据」
- 「生成本周周报」「帮我做独立站周报」「weekly report」
- 「自动分析 GSC/GA4 数据并给建议」

Agent 会按 SKILL.md 与 `weekly-report.md` 执行：调用脚本拉取数据、按模板生成报告，周报会存档到 `outputs/weekly-report-YYYY-MM-DD.md`。

---

## 脚本说明与迁移

本 skill 的 **`scripts/`** 目录用于存放 GSC/GA4/Bing 查询脚本（如 `gsc-report.cjs`、`ga4-report.cjs`、`bing-report.cjs`）。若你之前在 **`~/.openclaw/workspace/scripts`** 下已有脚本，**建议迁移到本 skill 的 `scripts/`**，便于在 skill 目录内自包含测试：

1. 复制脚本与 `config.json` 到本 skill 的 `scripts/`，并修改 `config.json` 中的 `gcp_key_path` 指向本 skill 的 `credentials/`（详见 **scripts/README.md**）。
2. 在 `scripts/` 下执行 `npm install googleapis`。
3. 若使用 Claude/Codex 的 Bash 权限白名单，把 `settings.local.json` 里所有 `~/.openclaw/workspace/scripts` 改为本 skill 的 `scripts` 绝对路径，详见 **MIGRATE-CLAUDE-SETTINGS.md**。

脚本通过 `scripts/config.json` 读取凭证路径与站点（GSC URL、GA4 Property ID）；`.env` 用于 Agent 与文档约定，脚本若需从环境变量读可自行扩展。

---

## 文件说明

| 文件 | 说明 |
|------|------|
| **SKILL.md** | 主说明、触发条件、配置流程、报告模板、安全与踩坑 |
| **weekly-report.md** | 周报执行手册（7 大维度、步骤、模板） |
| **reference.md** | 参考来源与官方 API 文档链接 |
| **env.example** | 环境变量示例，复制为 `.env` 后填写 |
| **AUDIT.md** | 按 skill-creator 标准的审计报告（可选阅读） |
| **README.md** | 本安装与使用说明 |

---

## 与话题树技能的关系

- **topic-tree-architect**：负责「写什么、发什么」——话题规划、内链与发布顺序。
- **seo-performance-tracker**：负责「发布后效果如何、下一步优化什么」——GSC/GA4/Bing 数据与周报。

两者可独立使用，也可在同一项目中配合使用。
