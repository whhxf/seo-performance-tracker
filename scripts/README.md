# scripts/ — 脚本与配置

本目录用于存放 GSC/GA4/Bing 查询脚本，供 seo-performance-tracker skill 的 Agent 通过 `node scripts/xxx.cjs` 调用。**推荐把原先在 `~/.openclaw/workspace/scripts` 下的脚本迁移到此处**，便于在 skill 目录内自包含测试。

---

## 从 ~/.openclaw/workspace/scripts 迁移

1. **复制脚本与依赖**
   ```bash
   SKILL_DIR="/Users/conan/project/AI-SEOer/.cursor/skills/seo-performance-tracker"
   cp ~/.openclaw/workspace/scripts/gsc-report.cjs "$SKILL_DIR/scripts/"
   cp ~/.openclaw/workspace/scripts/ga4-report.cjs "$SKILL_DIR/scripts/"
   cp ~/.openclaw/workspace/scripts/bing-report.cjs "$SKILL_DIR/scripts/"
   cp ~/.openclaw/workspace/scripts/config.json "$SKILL_DIR/scripts/"  # 见下步修改路径
   cp ~/.openclaw/workspace/scripts/package.json "$SKILL_DIR/scripts/" 2>/dev/null || true
   cd "$SKILL_DIR/scripts" && npm install googleapis
   ```

2. **修改 config.json 中的凭证路径**  
   脚本通过 `config.json` 读取 `credentials.gcp_key_path` 和 `sites.default`。  
   将 `gcp_key_path` 改为指向**本 skill 的 credentials 目录**，例如：
   - 相对路径（以 scripts 为当前目录）：`../credentials/gcp-service-account.json`
   - 或绝对路径：`/Users/conan/project/AI-SEOer/.cursor/skills/seo-performance-tracker/credentials/gcp-service-account.json`

3. **Bing API Key**  
   若脚本从文件读 Bing Key，请确保该文件在 skill 的 `credentials/` 下（如 `bing-webmaster-api-key.txt`），并在脚本或 config 中指向该路径；或从环境变量 `BING_WEBMASTER_API_KEY` 读取（若脚本支持）。

4. **执行与权限**  
   - 在终端测试：`cd <skill目录>/scripts && node gsc-report.cjs default 7`
   - 若使用 Claude Code / Cursor 的「允许的 Bash」权限，需把 `.claude/settings.local.json` 里所有 `~/.openclaw/workspace/scripts` 改为**本 skill 的 scripts 绝对路径**，例如：  
     `Bash(cd /Users/conan/project/AI-SEOer/.cursor/skills/seo-performance-tracker/scripts && node gsc-report.cjs default 7)`  
   详见 skill 根目录的 **MIGRATE-CLAUDE-SETTINGS.md**。

---

## 配置文件说明

| 文件 | 说明 |
|------|------|
| **config.example.json** | 配置示例。复制为 `config.json` 后填写 `gsc_url`、`ga4_property_id`，并将 `gcp_key_path` 指向本 skill 的 `../credentials/gcp-service-account.json`。勿提交 `config.json`。 |
| **config.json** | 实际配置（由你创建），已被 skill 根目录 .gitignore 忽略。 |

---

## 依赖

- **googleapis**：GSC、GA4 官方 Node 库。在**本目录**执行：`npm install googleapis`
- Bing：多为 HTTP 请求，无额外 npm 依赖（视你的 bing-report.cjs 实现而定）
