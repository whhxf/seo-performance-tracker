# seo-performance-tracker Skill 审计报告

按 **skill-creator** 标准对本 skill 进行审计，便于打包上传 GitHub 供他人使用。审计日期：2026-03-16。

---

## 一、Skill 解剖结构（Anatomy）

| 规范项 | 要求 | 当前状态 | 说明 |
|--------|------|----------|------|
| **SKILL.md** | 必有，含 YAML frontmatter | ✅ | 有 `name`、`description` |
| **Bundled scripts** | 可选，放 `scripts/` | ⚠️ 缺失 | 当前未捆绑脚本，仅文档约定 `gsc-report.cjs` 等由用户自备；若开源发布建议提供示例脚本或明确「用户自行实现」 |
| **references/** | 可选，大文档可拆 | ✅ | 有 `reference.md`，体量适中 |
| **assets/** | 可选 | ❌ 无 | 无模板/图标等，可接受 |

**结论**：结构基本符合。若仅以「工作流 + 文档」形式发布，可不带脚本，但需在 README 中写清「脚本需自行实现或从某处获取」。

---

## 二、Frontmatter 与触发（Description）

| 规范项 | 要求 | 当前状态 |
|--------|------|----------|
| **name** | 必填，标识用 | ✅ `seo-performance-tracker` |
| **description** | 主触发依据，需包含「何时用」+「做什么」 | ✅ 已含触发词与场景 |
| **触发倾向** | description 应稍「主动」，避免 undertrigger | ✅ 已列多组触发词（SEO 表现、周报、weekly report 等） |

**建议**：description 可再补一句「只要用户提到 GSC、GA4、Bing、Search Console、独立站周报、效果追踪等，优先考虑使用本 skill」，以进一步减少漏触发。

---

## 三、渐进式披露（Progressive Disclosure）

| 规范项 | 要求 | 当前状态 |
|--------|------|----------|
| **SKILL.md 体量** | 建议 <500 行 | ✅ 约 320 行，合规 |
| **层级与跳转** | 大文档需有层级与「何时读什么」 | ✅ 周报拆到 `weekly-report.md`，SKILL 内有关联 |
| **references 体量** | >300 行建议给目录 | ✅ reference.md 很短，无需目录 |

**结论**：符合。主说明 + 周报子模块 + 参考来源分离清晰。

---

## 四、写作风格与原则

| 规范项 | 要求 | 当前状态 |
|--------|------|----------|
| **祈使句** | 指令用祈使句 | ✅ 多为「打开…」「创建…」「保存到…」 |
| **解释原因** | 用「为什么」替代堆砌 MUST | ✅ 有目标效果、核心问题、预警阈值说明 |
| **输出格式** | 可固定模板 | ✅ 报告模板、周报模板已给出 |
| **原则** | 无恶意、不误导、可预期 | ✅ 符合 |

---

## 五、配置与安全（针对「仅文件夹下环境变量」）

| 规范项 | 要求 | 当前状态 | 待改 |
|--------|------|----------|------|
| **配置入口** | 用户期望：**仅在本 skill 目录下配置一个环境变量文件** | ❌ | 当前写的是 `~/.openclaw/workspace/credentials/` 或项目内 `credentials/`，路径分散 |
| **密钥不入对话** | 不要求用户把密钥贴到对话 | ✅ | 已写「只引导把密钥放到本地文件」 |
| **.gitignore** | 密钥文件、.env 不提交 | ⚠️ | 未在 skill 内提供 .gitignore，需增加 |

**结论**：需要统一为「**本 skill 目录下 `.env` 为唯一配置入口**」：  
- 新增 `env.example`（或 `.env.example`），列出全部变量（GCP 凭证路径、Bing API Key、站点代号等）。  
- 文档中删除对 `~/.openclaw/workspace/` 及项目内 `credentials/` 的硬编码要求，改为「复制 `env.example` 为 `.env`，在 skill 目录下填写；脚本/Agent 从该 .env 读取」。  
- 在 skill 目录增加 `.gitignore`，包含 `.env` 和 `credentials/`（若仍允许本地放 json/key 文件则只忽略敏感路径）。

---

## 六、GitHub 发布就绪

| 项 | 建议 | 当前状态 |
|----|------|----------|
| **README.md** | 安装方式、依赖、配置（.env）、使用示例、与 topic-tree 关系 | ❌ 无 | 需新增 |
| **env.example** | 占位符示例，无真实密钥 | ❌ 无 | 需新增 |
| **.gitignore** | .env、*.json（凭证）、*.txt（key）等 | ❌ 无 | 需新增 |
| **脚本** | 可选：提供示例脚本或链接到实现指南 | 无 | 可保留「用户自备」并在 README 说明 |

---

## 七、与 skill-creator 流程的兼容性

- **Test cases / evals**：本 skill 依赖外部 API 与用户站点，做自动化断言较难；适合做 1～2 个「定性」测试（如：给一个模拟输出，检查 Agent 是否按模板生成报告）。  
- **Description 优化**：上传 GitHub 后可用 skill-creator 的 description 优化流程跑一版，提升触发准确率。  
- **打包**：若使用 Codex 的 `package_skill`，会打包 SKILL.md + references + scripts 等；当前无 scripts，打包后即「文档 + 配置说明 + env.example」。

---

## 八、审计结论与待办

| 优先级 | 事项 |
|--------|------|
| **P0** | 统一配置为「仅 skill 目录下 .env」：新增 `env.example`，更新 SKILL.md 中所有配置路径与说明。 |
| **P0** | 新增 `README.md`：安装、复制 env.example → .env、填写项、使用示例、安全提示。 |
| **P1** | 在 skill 目录新增 `.gitignore`（.env、credentials/ 等），避免误提交密钥。 |
| **P1** | 在 description 中补一句「只要用户提到 GSC/GA4/Bing/周报/效果追踪等，优先考虑本 skill」（可选）。 |
| **P2** | 若后续提供示例脚本，可放入 `scripts/` 并让脚本从 skill 目录或环境变量读取 `.env` 路径。 |

完成上述 P0/P1 后，即可按「仅文件夹下环境变量配置」的标准打包并上传 GitHub，供他人使用。
