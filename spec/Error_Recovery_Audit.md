# 错误处理回归 Audit Checklist（PRD §25）

> 用途：每次大改动后或上线前跑一遍，确保 PRD §25 错误处理表的每一项在代码里都有对应实现 + 可被人工验证。
>
> 创建：P7-T6（2026-05-06）；后续在每次合入大特性后回归。

---

## 总原则（PRD §25.1）

- [x] **永不阻塞流程**：任何失败都有回退路径，不让孩子卡在某一步
- [x] **失败语言儿童化**：错误提示用伙伴的口吻，不暴露技术错误
- [x] **关键时刻不造假**：Day 7 档案宁可不生成也不用预设替代
- [x] **静默与显式分离**：后台错误静默重试，影响孩子的错误显式提示

---

## §25.2 LLM 调用失败的降级

| 调用点 | PRD 要求 | 实现位置 | 状态 | 验证步骤 |
|---|---|---|---|---|
| Pass 1 归类 | 1 次重试，2 次失败创 set_aside | [pass1.ts](../src/lib/llm/pass1.ts) `pass1FallbackSetAside` + [client.ts](../src/lib/llm/client.ts) maxRetries=1 | ✅ | 关闭网络 → 提交描述 → 等约 12s → 看 memory_bank 出现 set_aside "我有点累，待会再整理这个" |
| Pass 2 对话 | 1 次重试，2 次失败用预设 | [pass2.ts](../src/lib/llm/pass2.ts) `pass2Fallback` + [fallbacks.json](../prompts/shared/fallbacks.json) `pass2_fail_after_text` | ✅ | 关闭网络 → 提交文字 → 等 → 看回应来自 pass2_fail_after_text 池 |
| 概念详情生成 | 1 次重试，2 次失败显示 evidence 隐 reasoning | [conceptDetail.ts](../src/lib/llm/conceptDetail.ts) + [memory/concept/[id]/route.ts](../src/app/api/memory/concept/[id]/route.ts) `source: 'fallback'` 分支 | ✅ | 点开概念卡 → 关闭网络重新加载 → reasoning 段落隐藏，仅 evidence 列表 |
| 纠正反馈 | 立即降级（不重试）到预设台词 | [correction.ts](../src/lib/llm/correction.ts) `maxRetries: 0` + `getCorrectionResponse` | ✅ | 关网点 restore → 立即看到该伙伴的预设 restore 台词 |
| Day 7 档案 | 3 次重试都失败 → 不生成档案，**不允许预设替代** | [day7.ts](../src/lib/llm/day7.ts) `maxRetries: 2` (3 calls) + `runDay7WithSoftFallback` + [generate/route.ts](../src/app/api/day7/generate/route.ts) 503 + 客户端 `Day7FailureError` | ✅ | 关网进 worldview → 等约 60s → 看 "我有点累了，让我休息一下再想这件事" 错误页（不是假档案）|
| 朋友家拜访生成 | 1‑2 次重试，失败 "它好像还没回来......" | [visit.ts](../src/lib/llm/visit.ts) `VISIT_FALLBACK_NARRATIVE` + [processVisit.ts](../src/lib/orchestrate/processVisit.ts) | ✅ | 关网出门拜访 → 等待页 → 报告显示兜底文案 |
| 学校课堂生成 | 同朋友家 | [school.ts](../src/lib/llm/school.ts) + [processSchool.ts](../src/lib/orchestrate/processSchool.ts) | ✅ | 同上但去学校 |
| 广场剧本每幕生成 | 2 次重试，失败 "它在路上遇到点麻烦" | [plaza.ts](../src/lib/llm/plaza.ts) `plazaActFallback` + [processPlaza.ts](../src/lib/orchestrate/processPlaza.ts) | ✅ | 关网选道具 → 看本幕兜底叙事 + small_blue_dragon_speech "...让我再想想。" |
| 广场结局生成 | 2 次重试，使用兜底结局 | [plaza.ts](../src/lib/llm/plaza.ts) `plazaEndingFallback` 按 quality 计数推断 ending_type + always 道具 | ✅ | 关网走完 3 幕 → 结局页：兜底叙事 + always 列表道具仍发放 |
| free_chat | 1 次重试，失败 throw 5xx（按 spec/Free_Chat_Implementation V0.2 设计）| [freeChat.ts](../src/lib/llm/freeChat.ts) | ⚠️ 决策点 | PRD §25.6 倾向"自我状态台词"兜底；当前是 throw 5xx，前端 toast。**P7 用户测试时再决定** |

---

## §25.3 输入相关失败的处理

| 失败场景 | PRD 要求 | 实现位置 | 状态 | 验证 |
|---|---|---|---|---|
| ASR 网络超时 | 切换到文字输入 | [voice/upload/route.ts](../src/app/api/voice/upload/route.ts) + [client.ts::VoiceUploadError](../src/lib/api/client.ts) | ✅ | 关网录音 → 错误"网络好像有点慢" + 切文字模式 |
| ASR 服务报错 | 同上 | 同上 | ✅ | mock 改 ASR_FAILED env 测试 |
| ASR 返回空（噪音 / 太短）| "我没听清，再说一次？" | [VoiceRecorder.tsx](../src/components/voice/VoiceRecorder.tsx) `onTooShort` + [TranscriptionConfirm.tsx](../src/components/voice/TranscriptionConfirm.tsx) `< 10 字温和追问` | ✅ | 录 0.5s → 看追问；ASR empty → 错误返回 |
| 麦克风权限拒绝 | 切文字模式，主页保留语音入口 | [VoiceRecorder.tsx](../src/components/voice/VoiceRecorder.tsx) `onPermissionDenied` + [MicPermissionDialog.tsx](../src/components/voice/MicPermissionDialog.tsx) | ✅ | 浏览器拒绝麦克风 → 看友好引导 |
| 录音超过 60 秒 | 自动结束 + 提示 | [VoiceRecorder.tsx](../src/components/voice/VoiceRecorder.tsx) `maxDurationSec=60` | ✅ | 录满 60s → 看自动结束 |

---

## §25.4 图像生成相关失败

| 场景 | PRD 要求 | 实现位置 | 状态 | 验证 |
|---|---|---|---|---|
| 图像生成 API 超时 | 重试 1 次 | [imagegen/parallel.ts](../src/lib/imagegen/parallel.ts) | ✅ | 设极短超时 → 看重试 |
| API 报错 | 同上 | 同上 | ✅ | |
| 风格审核 major 失败 | 重生成（最多 2 次）| [imagegen/styleAudit.ts](../src/lib/imagegen/styleAudit.ts) + [processDescribe.ts](../src/lib/orchestrate/processDescribe.ts) | ✅ | mock styleAudit 返 major → 看重新生成 |
| 内容审核失败 | 同上 | [contentAudit.ts](../src/lib/imagegen/contentAudit.ts) | ✅ | |
| 全部失败 | 降级为文字卡片 "这次它脑子有点乱，画不出来" | [cards.is_fallback_text_card](../db/migrations/0002_describe_card.sql) + [FallbackTextCard.tsx](../src/components/card/FallbackTextCard.tsx) | ✅ | 关图像 API → 看文字卡片入墙 |

---

## §25.5 网络与基础设施失败

| 场景 | PRD 要求 | 实现 | 状态 | 备注 |
|---|---|---|---|---|
| 网络断开 | 重试 3 次 → 提示"连不上了" | 各 API client fetch（部分有 timeout，无统一重试）| ⚠️ 部分 | 单 API 层面：`generateWorldview` 90s timeout 已实现；其他 API 失败时 throw → 前端 toast；**没有"重试 3 次"统一逻辑**，留 P7 后续优化 |
| 数据库写入失败 | 后台重试 + 错误日志，前端假装成功 | mysql2 pool 默认重连；业务层 catch 后 console.error | ⚠️ 部分 | "前端假装成功"违反诚实原则；当前是显式报错。决策点 |
| Redis 失败 | 降级使用 MySQL 存 session | [rateLimit.ts](../src/lib/auth/rateLimit.ts) Redis 失败自动回 in-memory | ✅ | session 没用 Redis（cookie 自包含），所以不需要降级 |
| OSS 上传失败 | 重试 2 次，再失败保 base64 到 MySQL | 当前用本地文件存储，未接入 OSS；上线时 P6 文档已提示 | ⏸ P6 上线后处理 | OSS 接入是 P6 部署项 |

---

## §25.6 异常的产品话语

PRD 列的 5 条自我状态台词，全部已在 [fallbacks.json::ai_self_state_lines](../prompts/shared/fallbacks.json) 注册：

- [x] "我有点累了，让我休息一下再想这件事。"
- [x] "我脑袋里有点乱，待会再整理。"
- [x] "我现在还想不清楚。再过一会儿来找我吧。"
- [x] "今天网络不太好，明天再来吧。"
- [x] "它好像还没回来......明天再来看看？"

`AI_SELF_STATE_LINES` 已 export from [fallbacks.ts](../src/lib/llm/fallbacks.ts) 但**目前没有调用方**。可能用途：网络断开时 toast / Day 6 进面板看到 AI 自我状态。**P7 followup**：在合适场景接入。

---

## §25.7 监控与告警

| 指标 | PRD 阈值 | 实现 | 状态 |
|---|---|---|---|
| Day 7 档案生成失败次数 | 任何 1 次 → 实时 | `daily-monitor.sh` 统计 day7 success=0，需要人工每天看 | ⚠️ 当前是次日发现；如需实时告警接企业微信 |
| LLM 调用失败率 > 5% | 5 分钟 | 同上，每日聚合 | ⚠️ 同 |
| 图像生成失败率 > 10% | 5 分钟 | 当前 `llm_call_log` 不记 image gen；image gen 失败 → cards.is_fallback_text_card=true 可作信号 | ⚠️ |
| 风格审核 major 失败率 > 15% | 1 小时 | `cards.style_check_severity` 字段记录，可 SQL 聚合 | ✅ 数据有，告警未接 |
| ASR 失败率 > 10% | 1 小时 | `llm_call_log` 也记 ASR；统计同 LLM | ⚠️ 同 |
| 服务器响应时间 P95 > 30s | 实时 | nginx access_log 可解析 | ⚠️ 接 P95 监控需运维侧补 |

V1.0 体验阶段：日志 + 每日邮件汇总（已实现 daily-monitor.sh）；正式上线后接企业微信/飞书机器人。

---

## 验收

完成本 audit 的标志：每行的"状态"列要么 ✅ 要么 ⚠️ 带明确解释；不允许 ❓ 或空白。

每次合入大特性后跑一遍：`grep -n "## §" spec/Error_Recovery_Audit.md` → 逐条核对实现位置仍存在 + 状态仍正确。

---

## P7 followup（不阻塞 P6 上线）

1. **网络断开统一重试** — 在 `/lib/api/client.ts` 内置 fetchWithRetry，3 次内退避
2. **AI_SELF_STATE_LINES 接入主页** — 关键时刻可见的 toast
3. **关键告警实时化** — Day 7 失败 → webhook 到企业微信
4. **free_chat 决策定锤** — 用户测试时观察孩子对 5xx 的反应，再决定是否切到 self-state 兜底
