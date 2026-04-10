# 将 Claude/Codex 权限从 ~/.openclaw/workspace/scripts 迁到本 skill

若你在 **`.claude/settings.local.json`**（或项目/用户级 settings）里配置了大量 `Bash(cd ~/.openclaw/workspace/scripts && ...)` 的允许权限，迁移到本 skill 后需要把**工作目录**改为本 skill 的 `scripts/` 路径，这样 Agent 才能在本目录下执行脚本。

---

## 1. 本 skill 的 scripts 绝对路径

```
/Users/conan/project/AI-SEOer/.cursor/skills/seo-performance-tracker/scripts
```

（若 AI-SEOer 或 skill 位置不同，请替换为你的实际路径。）

---

## 2. 替换规则

在 `settings.local.json` 的 `permissions.allow` 数组里：

- **查找**：`~/.openclaw/workspace/scripts` 或 `cd ~/.openclaw/workspace/scripts`
- **替换为**：`/Users/conan/project/AI-SEOer/.cursor/skills/seo-performance-tracker/scripts` 或  
  `cd /Users/conan/project/AI-SEOer/.cursor/skills/seo-performance-tracker/scripts`

例如：

- 原：`"Bash(cd ~/.openclaw/workspace/scripts && node gsc-report.cjs default 7)"`
- 新：`"Bash(cd /Users/conan/project/AI-SEOer/.cursor/skills/seo-performance-tracker/scripts && node gsc-report.cjs default 7)"`

---

## 3. 批量替换（可选）

在项目根或任意目录执行（请先备份 `settings.local.json`）：

```bash
SETTINGS="/Users/conan/project/AI-SEOer/.claude/settings.local.json"
SKILL_SCRIPTS="/Users/conan/project/AI-SEOer/.cursor/skills/seo-performance-tracker/scripts"

# 备份
cp "$SETTINGS" "$SETTINGS.bak"

# 替换（macOS sed）
sed -i '' "s|~/.openclaw/workspace/scripts|$SKILL_SCRIPTS|g" "$SETTINGS"
sed -i '' 's|cd ~/.openclaw/workspace/scripts|cd '"$SKILL_SCRIPTS"'|g' "$SETTINGS"
```

替换后检查 `settings.local.json` 格式是否仍为合法 JSON（括号、引号匹配）。

---

## 4. Read 权限

若原来有：

`"Read(//Users/conan/.openclaw/workspace/scripts/**)"`

可改为指向本 skill 的 scripts：

`"Read(/Users/conan/project/AI-SEOer/.cursor/skills/seo-performance-tracker/scripts/**)"`

---

完成后，Agent 会从**本 skill 的 scripts 目录**执行 `gsc-report.cjs`、`ga4-report.cjs`、`bing-report.cjs` 等，并读取同目录下的 `config.json`（凭证路径已在 config 中指向本 skill 的 `credentials/`）。
