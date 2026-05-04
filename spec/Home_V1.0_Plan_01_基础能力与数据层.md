# Home V1.0 实施方案 · 第 1 份 · 基础能力与数据层

**版本** V0.1  
**日期** 2026-05-03  
**状态** 待决议  
**对应 PRD** [Home_MVP_PRD_V1.0.md](Home_MVP_PRD_V1.0.md)  
**前置依赖** V0.6.1 实施方案已完成（P0 + P1 骨架 + describe 卡片流程已实装）

## 版本历史

| 版本 | 日期 | 修订说明 |
|---|---|---|
| V0.1 | 2026-05-03 | 初稿，基于 PRD V1.0 全貌制定 |

## 文档定位

本文档是 V1.0 实施方案的第一份（共四份），聚焦于**技术栈迁移、数据库 schema 重新设计、类型体系同步、基础能力层建设**。这份文档不涉及前端页面和驿站逻辑，那些内容分别在 Plan_02（核心流程改造）和 Plan_03（伙伴驿站）中阐述。

## PRD 必读索引

> 实施本文档前，AI 必须阅读以下 PRD 章节。方案文档只做工程决策，细节原文在 PRD。

| PRD 章节 | 内容 | 用途 |
|---|---|---|
| §21.1–§21.4 | 技术架构全貌（阿里系选型、LLM 切换 Claude、Unix 工具箱原则） | 技术决策依据 |
| §22.1–§22.4 | 数据模型（表结构、字段定义、MySQL→PG 差异） | Schema DDL 原文 |
| §23.1–§23.6 | Prompt 工程规范（5 条原则、模板结构、pass1/pass2/keyword_extract/day7 规格） | LLM callType 默认参数 |
| §23.10–§23.13 | 新增驿站 Prompt（visit/school/plaza_act/plaza_ending） | 新增 callType 的 Prompt 原文 |
| §24.1–§24.4 | AI 输出安全（三层防线、敏感词规则、图像安全） | 安全过滤规则原文 |
| §25.1–§25.6 | 错误处理与降级（ASR/LLM/图像的各层降级策略） | 降级文案和流程原文 |
| §26 | 临时上线方案（免登录、ECS 部署） | 部署环境规格 |

---

## 目录

1. V0.6.1 → V1.0 变更全貌
2. 技术架构变更
3. 数据模型迁移（MySQL → PostgreSQL）
4. 类型体系同步
5. 新增基础能力
6. 环境变量与配置
7. Mock 注入体系
8. 验收标准

---

## 1. V0.6.1 → V1.0 变更全貌

### 1.1 两阶段差异总览

V0.6.1 的产品范围是「7 天主流程 + 描述卡片机制」，V1.0 在此基础上新增「伙伴驿站」三层体验（朋友家、学校、小区广场），并完成从开发级到生产级的技术栈升级。

| 维度 | V0.6.1（当前） | V1.0（目标） |
|---|---|---|
| **产品范围** | 7 天主流程 + describe 卡片 | 7 天流程 + describe 卡片 + 伙伴驿站（3 场景）+ Day 7 世界观档案 + 毕业卡 |
| **LLM 主模型** | DeepSeek-V3 (`deepseek-chat`) | Claude Sonnet 4.5 |
| **LLM 备选** | DeepSeek-R1 (`deepseek-reasoner`) | Qwen3-235B |
| **数据库** | MySQL 8 | PostgreSQL |
| **对象存储** | 本地 `public/uploads/` | 阿里云 OSS |
| **缓存** | 无 | Redis |
| **图像生成** | 通义万相 + MiniMax（双路测试） | 通义万相（主）+ MiniMax（兜底） |
| **风格审核** | Qwen-VL（独立路由） | 通义千问-VL（同生态） |
| **内容安全** | 代码层规则 + LLM Vision 检查 | 阿里云内容安全 API + 代码层规则 |
| **部署** | Vercel / SAE | 阿里云 ECS + SLB |
| **DB 表数** | 8 表 + 1 视图（含 cards） | 11 表 + 1 视图（新增 trips / inventory_items / plaza_plays） |
| **API 路由数** | ~12 个 | ~24 个（新增 12 个驿站相关） |
| **LLM callType** | 8 个 | 13 个（新增 visit / school / plaza_act / plaza_ending / content_audit_api） |
| **前端路由** | ~18 个 | ~35 个（新增驿站地图 / 朋友家目的 ×4 / 学校目的 ×4 / 广场 ×4） |
| **Prompt 模板** | 10 组 | 15 组（新增 4 组驿站 + 重写所有模板适配 Claude） |
| **Few-shot** | ~25–30 条 | ~100 条起步 |

### 1.2 保留不动的部分

- `companion_presets` 表和 8 个伙伴定义（预设不变）
- 7 天主流程骨架（Day 1–7 结构和时序）
- 描述卡片机制（语音 → ASR → 中转 → 卡片生成 → 确认）
- 记忆面板 4 区块逻辑
- 跳过任务机制
- 输入/输出安全过滤层 `src/lib/safety/filters.ts`
- ASR 客户端（Paraformer-realtime，已实装）
- 图像生成客户端基础结构（需适配 PostgreSQL）
- 风格 Prompt 常量 `stylePrompt.ts`（不变）
- 风格审核逻辑 `styleAudit.ts`（需切换模型）
- 已落地的自动化测试基础设施

### 1.3 废弃 / 下线

- **DeepSeek 全链路**：`callLLM` 改为调用 Claude API，环境变量 `DEEPSEEK_*` 全线下线（保留 30 天兼容过渡后删除）
- **MySQL 全链路**：`src/lib/db/client.ts` 中的 `mysql2/promise` 替换为 `pg`，所有 SQL 语句从 MySQL 方言改写为 PostgreSQL
- **本地文件存储**：`public/uploads/` 不再作为主存储，改为 OSS 直传
- **Vercel 部署配置**：`vercel.json` 保留但不作为主部署目标

---

## 2. 技术架构变更

### 2.1 决策依据

PRD V1.0 §26.1 明确推荐全阿里系技术栈，原因：
- ASR（Paraformer）+ 图像生成（通义万相）+ 风格审核（通义千问-VL）+ 内容安全均在阿里云
- 统一计费、统一审核策略、统一 SDK
- 生产环境部署同样在阿里云 ECS

LLM 切换到 Claude Sonnet 4.5 的原因：
- Claude 在中文角色扮演和结构化 JSON 输出方面优于 DeepSeek-V3（PRD §21.2）
- Day 7 世界观档案和驿站剧本对叙事质量要求高
- 需要更强的指令跟随能力来保证风格一致性和角色语气稳定性

### 2.2 迁移清单

| 迁移项 | 当前 | 目标 | 工作量 | 风险 |
|---|---|---|---|---|
| 数据库驱动 | `mysql2` | `pg` (node-postgres) | 中 | SQL 方言差异 |
| 数据库 DDL | MySQL 语法 | PostgreSQL 语法 | 中 | 类型映射、约束语法 |
| LLM SDK | `openai`（指向 DeepSeek） | `@anthropic-ai/sdk` 或继续用 `openai`（兼容模式） | 低 | Claude API 兼容 OpenAI 格式 |
| LLM Prompt | DeepSeek 优化 | Claude 优化 | 高 | 所有 Prompt 需重测 |
| 对象存储 | `fs.writeFile` 本地 | 阿里云 OSS SDK (`ali-oss`) | 中 | 上传流程改动 |
| 缓存 | 无 | `ioredis` | 低 | 新增依赖 |
| 内容安全 | 代码规则 | 阿里云内容安全 SDK | 中 | API 对接与审核流程 |
| 部署 | Vercel/SAE | 阿里云 ECS + Docker | 高 | 运维复杂度增加 |

### 2.3 新增 npm 依赖

```json
{
  "dependencies": {
    "pg": "^8.13.0",
    "@anthropic-ai/sdk": "^0.39.0",
    "ali-oss": "^6.22.0",
    "ioredis": "^5.5.0",
    "@alicloud/pop-core": "^1.7.14"
  },
  "devDependencies": {
    "@types/pg": "^8.11.0"
  }
}
```

移除：
```json
{
  "dependencies": {
    "mysql2": "移除"
  }
}
```

### 2.4 架构简图（V1.0）

```
┌─────────────────────────────────────────────────┐
│                    Frontend                       │
│  Next.js 15 App Router (React 18 + Tailwind 4)   │
│  35 路由 / zustand 状态 / MediaRecorder 语音       │
└────────────────────┬────────────────────────────┘
                     │ HTTP + WebSocket (ASR)
┌────────────────────▼────────────────────────────┐
│                 Next.js API Routes               │
│  24 个 API 路由 / processDescribe 编排 / 安全过滤   │
└──┬──────┬──────┬──────┬──────┬──────┬───────────┘
   │      │      │      │      │      │
   ▼      ▼      ▼      ▼      ▼      ▼
┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐┌──────────┐
│Claude││通义 ││通义 ││阿里 ││Redis││PostgreSQL│
│Sonnet││万相 ││千问 ││内容 ││会话 ││(RDS)    │
│4.5  ││v2  ││-VL ││安全 ││缓存 ││          │
└─────┘└──┬──┘└─────┘└─────┘└─────┘└──────────┘
          │
    ┌─────▼─────┐
    │ 阿里云 OSS │
    │ (图片存储) │
    └───────────┘
```

---

## 3. 数据模型迁移（MySQL → PostgreSQL）

### 3.1 迁移策略

采用**全新迁移文件**方案：

- 保留 `db/migrations/0001_init.sql`、`0002_describe_card.sql`、`0003_dual_image_source.sql` 作为 MySQL 历史版本，标注 `@archived`
- 新建 `db/migrations/0004_v1_init_pg.sql` 为 PostgreSQL 全新建表脚本
- 新建 `db/migrations/0005_v1_seed.sql` 为种子数据
- `db/seed.sql` 仍保留 MySQL 版本，新建 `db/seed_pg.sql`

原因：V1.0 schema 变更量大（MySQL → PG 方言 + 新增 3 张表 + 多字段增删），全新迁移比增量迁移更清晰。

### 3.2 完整 PostgreSQL Schema

```sql
-- ============================================================
-- db/migrations/0004_v1_init_pg.sql
-- Home V1.0 PostgreSQL 完整建表脚本
-- 引擎: PostgreSQL 15+
-- 字符集: UTF8
-- ============================================================

-- 3.2.1 扩展
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 3.2.2 用户表
-- ============================================================
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_phone        VARCHAR(20),
    child_nickname      VARCHAR(50),
    child_age           INT,
    consent_at          TIMESTAMPTZ,
    consent_version     VARCHAR(20),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_users_age CHECK (child_age IS NULL OR (child_age >= 4 AND child_age <= 16))
);

-- ============================================================
-- 3.2.3 伙伴预设表（只读，种子数据灌入）
-- ============================================================
CREATE TABLE companion_presets (
    preset_id           VARCHAR(50) PRIMARY KEY,
    display_name        VARCHAR(50) NOT NULL,
    appearance          TEXT,
    starting_personality TEXT,
    opening_line        TEXT,
    voice_traits        TEXT,
    ip_risk             BOOLEAN NOT NULL DEFAULT false,
    display_order       INT
);

-- ============================================================
-- 3.2.4 伙伴实例表
-- V1.0 变更:
--   + visit_count INT       -- 朋友家出门次数（解锁学校用）
--   + school_count INT      -- 上学次数（解锁广场用）
--   + plaza_count INT       -- 广场游玩次数
--   - last_panel_visit_at   -- 移除（V1.0 不需要）
--   - personality_weight    -- 移除（V1.0 不需要）
-- ============================================================
CREATE TABLE companions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    preset_id           VARCHAR(50) NOT NULL,
    custom_name         VARCHAR(50),
    starting_personality TEXT,
    current_day         INT NOT NULL DEFAULT 1,
    visit_count         INT NOT NULL DEFAULT 0,
    school_count        INT NOT NULL DEFAULT 0,
    plaza_count         INT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    graduated_at        TIMESTAMPTZ,

    CONSTRAINT chk_companions_day CHECK (current_day >= 1 AND current_day <= 7)
);

CREATE INDEX idx_companions_user ON companions(user_id);

-- ============================================================
-- 3.2.5 记忆表（每日输入记录）
-- V1.0 变更:
--   - photo_url            -- 保留给 V0.6.1 历史数据，新数据为 NULL
--   - vision_tags          -- 保留给历史数据
--   + description_text     -- V1.0 新增：描述任务的最终提交文字
--   + user_choice          -- V1.0 新增：选择题的答案
--   input_method / voice_audio_url / asr_transcription / edited_text
--                          -- 从 V0.6.1 保留
-- ============================================================
CREATE TABLE memories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    companion_id    UUID NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
    day             INT NOT NULL,
    type            VARCHAR(20) NOT NULL,
    photo_url       TEXT,
    vision_tags     JSONB,
    user_text       TEXT,
    description_text TEXT,
    user_choice     JSONB,
    input_method    VARCHAR(20) NOT NULL DEFAULT 'photo',
    voice_audio_url TEXT,
    asr_transcription TEXT,
    edited_text     TEXT,
    task_id         VARCHAR(50),
    task_question   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_memories_type CHECK (type IN ('photo','text','choice','skipped','voice','describe')),
    CONSTRAINT chk_memories_day CHECK (day >= 1 AND day <= 7),
    CONSTRAINT chk_memories_input_method CHECK (input_method IN ('photo','voice','text','choice','skipped','describe'))
);

CREATE INDEX idx_memories_companion_day ON memories(companion_id, day);
CREATE INDEX idx_memories_created ON memories(created_at);

-- ============================================================
-- 3.2.6 记忆库表（AI 整理的概念网络）
-- V1.0 变更:
--   + source_type          -- V1.0 新增: 'direct' | 'secondhand'（驿站二手信息）
--   + source_companion_id  -- V1.0 新增: 二手信息的来源伙伴
--   - cached_detail        -- 移除
--   - cache_dirty          -- 移除
--   - display_order        -- 移除
-- ============================================================
CREATE TABLE memory_bank (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    companion_id            UUID NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
    type                    VARCHAR(20) NOT NULL,
    concept_name            VARCHAR(100),
    concept_category        VARCHAR(20),
    ai_summary              TEXT,
    ai_reasoning            TEXT,
    evidence                JSONB,
    confidence              REAL NOT NULL DEFAULT 0.5,
    source_type             VARCHAR(20) NOT NULL DEFAULT 'direct',
    source_companion_id     UUID,
    user_corrected          BOOLEAN NOT NULL DEFAULT false,
    user_correction_history JSONB,
    last_updated            TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_memory_bank_type CHECK (type IN ('remembered','uncertain','set_aside','unknown')),
    CONSTRAINT chk_memory_bank_category CHECK (
        concept_category IN ('person','place','food','activity','object','emotion','other')
    ),
    CONSTRAINT chk_memory_bank_conf CHECK (confidence >= 0 AND confidence <= 1),
    CONSTRAINT chk_memory_bank_source CHECK (source_type IN ('direct','secondhand')),
    CONSTRAINT uk_memory_bank_remembered UNIQUE (companion_id, concept_name, type)
);

CREATE INDEX idx_memory_bank_companion ON memory_bank(companion_id);

-- ============================================================
-- 3.2.7 对话表
-- ============================================================
CREATE TABLE conversations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    companion_id            UUID NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
    day                     INT,
    role                    VARCHAR(20) NOT NULL,
    content                 TEXT NOT NULL,
    source                  VARCHAR(50),
    related_memory_id       UUID REFERENCES memories(id) ON DELETE SET NULL,
    related_memory_bank_id  UUID REFERENCES memory_bank(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_conversations_role CHECK (role IN ('companion','child','system'))
);

CREATE INDEX idx_conversations_companion_day ON conversations(companion_id, day);

-- ============================================================
-- 3.2.8 描述卡片表（从 V0.6.1 迁移，字段名适配 PostgreSQL）
-- ============================================================
CREATE TABLE cards (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_id               UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    companion_id            UUID NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
    image_url               TEXT,
    image_source            VARCHAR(20),
    alt_image_url           TEXT,
    alt_image_source        VARCHAR(20),
    image_prompt            TEXT,
    raw_keyword_extract     JSONB,
    style_check_passed      BOOLEAN,
    style_check_severity    VARCHAR(20),
    style_check_issues      JSONB,
    content_audit_passed    BOOLEAN,
    content_audit_labels    JSONB,
    generation_attempt      INT NOT NULL DEFAULT 1,
    is_active               BOOLEAN NOT NULL DEFAULT false,
    is_fallback_text_card   BOOLEAN NOT NULL DEFAULT false,
    child_action            VARCHAR(20),
    confirmed_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_cards_attempt CHECK (generation_attempt >= 1 AND generation_attempt <= 4),
    CONSTRAINT chk_cards_severity CHECK (style_check_severity IN ('ok','minor','major')),
    CONSTRAINT chk_cards_action CHECK (child_action IN ('confirmed','rejected','no_action_timeout'))
);

CREATE INDEX idx_cards_memory ON cards(memory_id);
CREATE INDEX idx_cards_active ON cards(companion_id, is_active);
CREATE INDEX idx_cards_companion ON cards(companion_id);

-- ============================================================
-- 3.2.9 世界观档案表
-- ============================================================
CREATE TABLE worldview_cards (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    companion_id            UUID NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
    most_important_person   TEXT,
    most_fun_thing          TEXT,
    most_delicious_thing    TEXT,
    most_scary_thing        TEXT,
    unknown_thing           TEXT,
    almost_forgot_thing     TEXT,
    stats                   JSONB,
    generated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    raw_llm_output          JSONB
);

-- ============================================================
-- 3.2.10 驿站出行记录表（V1.0 新增）
-- 所有驿站外出共用一张表，靠 trip_type 区分
-- ============================================================
CREATE TABLE trips (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    companion_id            UUID NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
    trip_type               VARCHAR(20) NOT NULL,
    destination_companion_id UUID,
    purpose_type            VARCHAR(50),
    purpose_question        TEXT,
    plaza_play_id           UUID,
    status                  VARCHAR(20) NOT NULL DEFAULT 'traveling',
    departed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    returned_at             TIMESTAMPTZ,
    report_narrative        TEXT,
    report_data             JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_trips_type CHECK (trip_type IN ('visit','school','plaza')),
    CONSTRAINT chk_trips_status CHECK (status IN ('traveling','returned'))
);

CREATE INDEX idx_trips_companion ON trips(companion_id);
CREATE INDEX idx_trips_status ON trips(companion_id, status);

-- ============================================================
-- 3.2.11 行囊/物品表（V1.0 新增）
-- 广场角色扮演的道具系统，与 memory_bank 完全解耦
-- ============================================================
CREATE TABLE inventory_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    companion_id            UUID NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
    item_id                 VARCHAR(50) NOT NULL,
    item_name               VARCHAR(100) NOT NULL,
    item_category           VARCHAR(20) NOT NULL,
    item_subcategory        VARCHAR(50),
    item_description        TEXT,
    item_detailed_description TEXT,
    acquired_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    acquired_from           VARCHAR(100),
    use_count               INT NOT NULL DEFAULT 0,
    last_used_at            TIMESTAMPTZ,
    is_upgraded_from        UUID REFERENCES inventory_items(id) ON DELETE SET NULL,

    CONSTRAINT chk_inventory_category CHECK (item_category IN ('knowledge','object','gift','ability'))
);

CREATE INDEX idx_inventory_companion ON inventory_items(companion_id);

-- ============================================================
-- 3.2.12 广场游戏记录表（V1.0 新增）
-- ============================================================
CREATE TABLE plaza_plays (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    companion_id            UUID NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
    trip_id                 UUID REFERENCES trips(id) ON DELETE SET NULL,
    scenario_id             VARCHAR(50) NOT NULL,
    scenario_title          VARCHAR(100),
    act_choices             JSONB,
    ending_type             VARCHAR(20),
    ending_narrative        TEXT,
    earned_items            JSONB,
    played_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at             TIMESTAMPTZ,

    CONSTRAINT chk_plaza_ending CHECK (ending_type IN ('perfect','good','barely'))
);

CREATE INDEX idx_plaza_plays_companion ON plaza_plays(companion_id);

-- ============================================================
-- 3.2.13 LLM 调用日志表
-- ============================================================
CREATE TABLE llm_call_log (
    id              BIGSERIAL PRIMARY KEY,
    companion_id    UUID REFERENCES companions(id) ON DELETE SET NULL,
    call_type       VARCHAR(50) NOT NULL,
    model           VARCHAR(100),
    input_tokens    INT,
    output_tokens   INT,
    latency_ms      INT,
    success         BOOLEAN NOT NULL DEFAULT true,
    fail_reason     VARCHAR(200),
    prompt_version  VARCHAR(50),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_llm_call_log_type_time ON llm_call_log(call_type, created_at);

-- ============================================================
-- 3.2.14 伙伴统计视图
-- ============================================================
CREATE VIEW companion_stats AS
SELECT
    c.id AS companion_id,
    COUNT(DISTINCT m.id) FILTER (WHERE m.type = 'photo') AS photos,
    COUNT(DISTINCT conv.id) AS conversations_count,
    COUNT(DISTINCT mb.id) FILTER (WHERE mb.user_corrected = true) AS corrections,
    c.current_day
FROM companions c
LEFT JOIN memories m ON m.companion_id = c.id
LEFT JOIN conversations conv ON conv.companion_id = c.id
LEFT JOIN memory_bank mb ON mb.companion_id = c.id
GROUP BY c.id;
```

### 3.3 种子数据

```sql
-- ============================================================
-- db/migrations/0005_v1_seed.sql
-- ============================================================

-- 测试用户
INSERT INTO users (id, parent_phone, child_nickname) VALUES
    ('00000000-0000-0000-0000-000000000001', NULL, '测试小朋友');

-- 8 个预设伙伴（与 V0.6.1 完全一致）
INSERT INTO companion_presets (preset_id, display_name, starting_personality, opening_line, voice_traits, ip_risk, display_order) VALUES
    ('xiaoqinglong', '小青龙', '好奇、温和、有一点慢热', '你好，我是小青龙。你是我的新主人吗？', '温和、语速中慢、常用"嗯"开头', false, 1),
    ('dabear',       '大熊',   '憨厚、沉稳、有点不善言辞', '嗯...你好。我是大熊。', '低沉、语速慢、常停顿', false, 2),
    ('xiaohuolong',  '小火龙', '热情、急躁、心直口快', '嘿！你终于来了！我是小火龙，我们认识一下吧！', '语速快、音调高、常用叹号', false, 3),
    ('tengtengshe',  '藤藤蛇', '安静、内向、但观察力强', '...你好。我是藤藤蛇。', '轻柔、语速慢、省略号多', false, 4),
    ('xiaolvlong',   '小绿龙', '活泼、爱笑、话多', '哇！你来啦！我是小绿龙，我最喜欢玩啦！', '语速快、笑声多、叠字', false, 5),
    ('linnabel',     '琳娜贝尔', '胆小、温柔、敏感', '（小声）...你好，我是琳娜。（偷偷看你）', '小声、犹豫、常问"可以吗"', false, 6),
    ('xiaolaohu',    '小老虎', '直率、勇敢、想到就做', '嗷！小老虎来啦！我们可以一起玩吗？', '音量大、直接、常用短句', false, 7),
    ('xiaoshizi',    '小狮子', '自信、有点傲娇、但内心柔软', '嗯哼，你就是本王的伙伴？...好吧，我是小狮子。', '自信、语调上扬、偶尔傲娇', false, 8);

-- 4 个系统 NPC 伙伴（驿站用，标记为系统预设，不属于任何用户）
INSERT INTO companion_presets (preset_id, display_name, starting_personality, ip_risk, display_order) VALUES
    ('sys_xiaoyu',    '小鱼',   '只记得海边的一切，对陆地世界完全陌生', true, 9),
    ('sys_tudou',     '土豆',   '只记得田野和农耕的事，对城市生活一无所知', true, 10),
    ('sys_xingxing',  '星星',   '只记得夜晚和天空，对白天的事不太了解', true, 11),
    ('sys_amu',       '阿木',   '只记得森林和树木，从未见过人类建筑', true, 12);
```

### 3.4 MySQL → PostgreSQL 关键差异处理

| 差异点 | MySQL | PostgreSQL | 代码层适配 |
|---|---|---|---|
| UUID 主键 | `CHAR(36)` | `UUID` | 修改所有 repo 中的 UUID 字面量（去掉引号包裹的字符串） |
| 自增主键 | `AUTO_INCREMENT` | `BIGSERIAL` | `llm_call_log.id` 类型变 `number` 而非 `string` |
| JSON 类型 | `JSON` | `JSONB` | 读写接口相同，但查询时 `->` 运算符语法有差异 |
| 布尔值 | `TINYINT(1)` | `BOOLEAN` | TypeScript 类型从 `0|1` 改为 `boolean` |
| 日期时间 | `DATETIME(3)` | `TIMESTAMPTZ` | 带时区，需统一处理 |
| UPSERT 语法 | `ON DUPLICATE KEY UPDATE` | `ON CONFLICT ... DO UPDATE` | `upsertMemoryBankEntry` 中的 SQL 需重写 |
| 密码认证 | `MYSQL_USER/MYSQL_PASSWORD` | `PGUSER/PGPASSWORD` | `.env.example` 更新 |
| 连接池 | `mysql2.createPool` | `pg.Pool` | `src/lib/db/client.ts` 全部重写 |

### 3.5 `dev/reset` 端点同步

```ts
// src/app/api/dev/reset/route.ts 更新
// TRUNCATE 顺序调整为 V1.0 所有表
const tables = [
  'llm_call_log',
  'plaza_plays',
  'inventory_items',
  'trips',
  'cards',
  'conversations',
  'worldview_cards',
  'memory_bank',
  'memories',
  'companions',
  'users',
];
// CASCADE 自动处理外键
for (const table of tables) {
  await execute(`TRUNCATE TABLE ${table} CASCADE`);
}
// 重新执行种子脚本
// 同时清空 OSS 中 uploads_voice/ 目录
```

---

## 4. 类型体系同步

### 4.1 全量 TypeScript 类型定义

以下为 V1.0 完整的 `src/types/index.ts` 变更。**加粗**字段为 V1.0 新增或修改。

```ts
// src/types/index.ts
import type { CompanionPresetId } from '@/components/characters/types';

// ============================================================
// 基础枚举
// ============================================================
export type DayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type MemoryInputType = 'photo' | 'text' | 'choice' | 'skipped' | 'voice' | 'describe';
export type InputMethod = 'photo' | 'voice' | 'text' | 'choice' | 'skipped' | 'describe';
export type TaskKind = 'describe' | 'text' | 'choice' | 'memory_review';

// ============================================================
// 用户
// ============================================================
export interface User {
  id: string;
  parent_phone?: string;
  child_nickname?: string;
  child_age?: number;
  consent_at?: string;
}

// ============================================================
// 伙伴
// ============================================================
export interface Companion {
  id: string;
  user_id: string;
  preset_id: CompanionPresetId;
  custom_name?: string;
  starting_personality: string;
  current_day: DayNumber;
  visit_count: number;        // V1.0 新增
  school_count: number;       // V1.0 新增
  plaza_count: number;        // V1.0 新增
  created_at: string;
  graduated_at?: string;
}

// ============================================================
// 记忆
// ============================================================
export interface Memory {
  id: string;
  companion_id: string;
  day: number;
  type: string;
  photo_url?: string;
  vision_tags?: VisionTags;
  user_text?: string;
  description_text?: string;  // V1.0 新增
  user_choice?: unknown;       // V1.0 新增
  input_method?: InputMethod;
  voice_audio_url?: string;
  asr_transcription?: string;
  edited_text?: string;
  task_id?: string;
  task_question?: string;
  created_at: string;
}

// ============================================================
// 描述卡片
// ============================================================
export type CardSeverity = 'ok' | 'minor' | 'major';
export type CardChildAction = 'confirmed' | 'rejected' | 'no_action_timeout';
export type ImageSource = 'dashscope' | 'minimax';

export interface Card {
  id: string;
  memory_id: string;
  companion_id: string;
  image_url: string | null;
  image_source?: ImageSource;
  alt_image_url?: string;
  alt_image_source?: ImageSource;
  image_prompt: string;
  raw_keyword_extract?: KeywordExtractOutput;
  style_check_passed: boolean;
  style_check_severity: CardSeverity | null;
  style_check_issues: string[];
  content_audit_passed?: boolean;     // V1.0 新增
  content_audit_labels?: string[];    // V1.0 新增
  generation_attempt: 1 | 2 | 3 | 4;
  is_active: boolean;
  is_fallback_text_card: boolean;
  child_action: CardChildAction | null;
  confirmed_at: string | null;
  created_at: string;
}

// ============================================================
// 关键词提取
// ============================================================
export interface KeywordExtractOutput {
  scene_type: 'indoor_room' | 'outdoor_place' | 'people_with_env' | 'object_focus';
  main_subjects: string[];
  visual_attributes: string[];
  atmosphere: string;
  prompt_content: string;
  excluded_details: string[];
}

// ============================================================
// 风格审核
// ============================================================
export interface StyleAuditOutput {
  style_match: boolean;
  issues: string[];
  severity: CardSeverity;
}

// ============================================================
// Vision 感知标签（保留给历史数据）
// ============================================================
export interface VisionTags {
  objects?: string[];
  scene?: string;
  atmosphere?: string;
  time_of_day?: string;
}

// ============================================================
// 记忆库
// ============================================================
export type MemoryBankType = 'remembered' | 'uncertain' | 'set_aside' | 'unknown';
export type ConceptCategory = 'person' | 'place' | 'food' | 'activity' | 'object' | 'emotion' | 'other';
export type CorrectionAction = 'restore' | 'dismiss' | 'clarify' | 'rename' | 'merge' | 'inform' | 'withhold';
export type MemorySourceType = 'direct' | 'secondhand';   // V1.0 新增

export interface CorrectionEvent {
  action: CorrectionAction;
  at: string;
  payload?: Record<string, unknown>;
}

export interface MemoryBankEntry {
  id: string;
  companion_id: string;
  type: MemoryBankType;
  concept_name: string | null;
  concept_category: ConceptCategory | null;
  ai_summary: string | null;
  ai_reasoning: string | null;
  evidence: EvidenceItem[];
  confidence: number;
  source_type: MemorySourceType;          // V1.0 新增
  source_companion_id?: string;           // V1.0 新增
  user_corrected: boolean;
  user_correction_history: CorrectionEvent[];
  last_updated: string;
  created_at: string;
}

export interface EvidenceItem {
  quote: string;
  day: number;
  source: string;
  at: string;
}

// ============================================================
// 对话
// ============================================================
export interface ConversationLine {
  id: string;
  companion_id: string;
  day: number;
  role: 'companion' | 'child' | 'system';
  content: string;
  source?: string;
  created_at: string;
}

// ============================================================
// 世界观档案
// ============================================================
export interface WorldviewCard {
  id: string;
  companion_id: string;
  most_important_person: string;
  most_fun_thing: string;
  most_delicious_thing: string;
  most_scary_thing: string;
  unknown_thing: string;
  almost_forgot_thing?: string;
  stats?: WorldviewStats;
  generated_at: string;
}

export interface WorldviewStats {
  cards_count: number;
  conversations_count: number;
  corrections_count: number;
  days_count: number;
}

// ============================================================
// 任务定义
// ============================================================
export interface TaskDef {
  id: string;
  day: DayNumber;
  kind: TaskKind;
  title: string;
  description: string;
  inputPlaceholder?: string;
  charLimit?: number;
}

// ============================================================
// V1.0 新增：驿站相关类型
// ============================================================

// 出行记录
export type TripType = 'visit' | 'school' | 'plaza';
export type TripStatus = 'traveling' | 'returned';
export type VisitPurpose = 'meet_friend' | 'observe_home' | 'introduce_self' | 'ask_question';
export type SchoolPurpose = 'attend_class' | 'ask_my_question' | 'observe_others' | 'learn_new';

export interface Trip {
  id: string;
  companion_id: string;
  trip_type: TripType;
  destination_companion_id?: string;
  purpose_type?: VisitPurpose | SchoolPurpose;
  purpose_question?: string;
  plaza_play_id?: string;
  status: TripStatus;
  departed_at: string;
  returned_at?: string;
  report_narrative?: string;
  report_data?: Record<string, unknown>;
}

// 行囊物品
export type ItemCategory = 'knowledge' | 'object' | 'gift' | 'ability';

export interface InventoryItem {
  id: string;
  companion_id: string;
  item_id: string;
  item_name: string;
  item_category: ItemCategory;
  item_subcategory?: string;
  item_description: string;
  item_detailed_description: string;
  acquired_at: string;
  acquired_from?: string;
  use_count: number;
  last_used_at?: string;
  is_upgraded_from?: string;
}

// 广场游戏
export type PlazaEndingType = 'perfect' | 'good' | 'barely';

export interface PlazaPlay {
  id: string;
  companion_id: string;
  trip_id?: string;
  scenario_id: string;
  scenario_title?: string;
  act_choices: ActChoice[];
  ending_type?: PlazaEndingType;
  ending_narrative?: string;
  earned_items?: EarnedItem[];
  played_at: string;
  finished_at?: string;
}

export interface ActChoice {
  act: number;
  selected_item_id: string | null;   // null = "不用道具，凭直觉"
  item_name?: string;
  narrative: string;
  item_use_quality?: 'clever' | 'reasonable' | 'barely_relevant';
}

export interface EarnedItem {
  item_id: string;
  item_name: string;
  category: ItemCategory;
}

// 驿站地图
export interface StationMap {
  friend_house_unlocked: boolean;
  school_unlocked: boolean;
  plaza_unlocked: boolean;
  daily_departures_remaining: number;
}
```

### 4.2 移除的类型字段

以下字段从 V0.6.1 类型中移除（对应 PostgreSQL schema 变更）：

| 移除字段 | 来源接口 | 原因 |
|---|---|---|
| `personality_weight` | `Companion` | V1.0 不再需要人格权重计算 |
| `last_panel_visit_at` | `Companion` | V1.0 不再跟踪面板访问时间 |
| `cached_detail` | `MemoryBankEntry` | V1.0 去掉预计算缓存 |
| `cache_dirty` | `MemoryBankEntry` | 同上 |
| `display_order` | `MemoryBankEntry` | 排序依靠 confidence × 时间衰减 |
| `regenerate_count` | `Memory` | 重做次数跟踪移到 `cards.generation_attempt` |

---

## 5. 新增基础能力

### 5.1 能力矩阵

V1.0 在 V0.6.1 基础上需要新增/变更以下基础能力模块：

| 模块 | 文件路径 | V0.6.1 状态 | V1.0 变更 |
|---|---|---|---|
| LLM 客户端 | `src/lib/llm/client.ts` | DeepSeek（openai SDK） | **切换**为 Claude（@anthropic-ai/sdk），新增 callType: `visit` / `school` / `plaza_act` / `plaza_ending` |
| ASR 客户端 | `src/lib/asr/client.ts` | Das​hScope Paraformer | **不变**（已实装） |
| ASR 转换 | `src/lib/asr/wavConvert.ts` | 浏览器端转换 | **不变** |
| 图像生成 | `src/lib/imagegen/client.ts` | 通义万相 | **不变**（去双路测试，保留主路） |
| MiniMax 客户端 | `src/lib/imagegen/minimaxClient.ts` | MiniMax 并行 | **降级为兜底**（主路失败时调用） |
| 双路并行 | `src/lib/imagegen/parallel.ts` | 并行生成 | **简化**为串行（主路 → 失败 → MiniMax） |
| 风格 Prompt | `src/lib/imagegen/stylePrompt.ts` | 已实装 | **不变** |
| 风格审核 | `src/lib/imagegen/styleAudit.ts` | Qwen-VL | **切换模型**为 `qwen-vl-max`，新增 `content_audit` 能力 |
| 内容安全 | `src/lib/imagegen/contentAudit.ts` | LLM Vision 检查 | **升级**为阿里云内容安全 API + LLM 双重审核 |
| 关键词提取 | `src/lib/llm/keywordExtract.ts` | 已实装 | **不变**（仅 LLM 模型切换） |
| DB 客户端 | `src/lib/db/client.ts` | `mysql2` | **重写**为 `pg` |
| DB repos | `src/lib/db/repos.ts` | MySQL SQL | **重写** SQL 为 PostgreSQL 方言 |
| DB cardsRepo | `src/lib/db/cardsRepo.ts` | MySQL | **重写** SQL |
| 对象存储 | `src/lib/storage/client.ts` | 无（新建） | **新增**：阿里云 OSS 上传/下载封装 |

### 5.2 LLM 客户端变更（`src/lib/llm/client.ts`）

#### 5.2.1 模型切换

```ts
// V1.0 LLM 客户端关键变更
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// callType 枚举扩展
export type LLMCallType =
  // V0.6.1 已有
  | 'pass1' | 'pass2' | 'concept_detail' | 'correction' | 'day7'
  | 'keyword_extract' | 'free_chat'
  // V1.0 新增
  | 'visit'          // 朋友家拜访报告
  | 'school'         // 学校课堂报告
  | 'plaza_act'      // 广场单幕剧本
  | 'plaza_ending';  // 广场结局

// 各 callType 参数表（温度 / max_tokens / 超时）
const CALL_DEFAULTS: Record<LLMCallType, { model: string; temperature: number; maxTokens: number; timeoutMs: number }> = {
  pass1:            { model: 'claude-sonnet-4-5-20250929', temperature: 0.3, maxTokens: 300,  timeoutMs: 6000 },
  pass2:            { model: 'claude-sonnet-4-5-20250929', temperature: 0.7, maxTokens: 200,  timeoutMs: 8000 },
  concept_detail:   { model: 'claude-sonnet-4-5-20250929', temperature: 0.5, maxTokens: 400,  timeoutMs: 10000 },
  correction:       { model: 'claude-sonnet-4-5-20250929', temperature: 0.4, maxTokens: 150,  timeoutMs: 6000 },
  day7:             { model: 'claude-sonnet-4-5-20250929', temperature: 0.7, maxTokens: 2000, timeoutMs: 30000 },
  keyword_extract:  { model: 'claude-sonnet-4-5-20250929', temperature: 0.2, maxTokens: 400,  timeoutMs: 6000 },
  free_chat:        { model: 'claude-sonnet-4-5-20250929', temperature: 0.6, maxTokens: 120,  timeoutMs: 8000 },
  visit:            { model: 'claude-sonnet-4-5-20250929', temperature: 0.7, maxTokens: 500,  timeoutMs: 15000 },
  school:           { model: 'claude-sonnet-4-5-20250929', temperature: 0.7, maxTokens: 800,  timeoutMs: 15000 },
  plaza_act:        { model: 'claude-sonnet-4-5-20250929', temperature: 0.8, maxTokens: 600,  timeoutMs: 12000 },
  plaza_ending:     { model: 'claude-sonnet-4-5-20250929', temperature: 0.7, maxTokens: 800,  timeoutMs: 15000 },
};
```

#### 5.2.2 兼容过渡期

同时保留 DeepSeek 兼容路径 30 天，通过环境变量切换：

```env
# V1.0 主模型（默认）
ANTHROPIC_API_KEY=sk-ant-...
LLM_PROVIDER=anthropic

# 过渡期回退
# LLM_PROVIDER=deepseek
# DEEPSEEK_API_KEY=sk-...
```

`src/lib/llm/client.ts` 中根据 `LLM_PROVIDER` 选择 SDK。过渡期结束后删除 DeepSeek 分支。

### 5.3 对象存储客户端（`src/lib/storage/client.ts`）— 新建

```ts
// src/lib/storage/client.ts
import 'server-only';
import OSS from 'ali-oss';

const ossClient = new OSS({
  region: process.env.OSS_REGION!,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET!,
  bucket: process.env.OSS_BUCKET!,
});

export interface UploadResult {
  url: string;
  key: string;
}

/** 上传文件到 OSS，返回公开访问 URL */
export async function uploadToOSS(
  localPath: string,
  remoteKey: string,
): Promise<UploadResult> {
  const result = await ossClient.put(remoteKey, localPath);
  return {
    url: result.url,
    key: remoteKey,
  };
}

/** 从 OSS 删除文件 */
export async function deleteFromOSS(remoteKey: string): Promise<void> {
  await ossClient.delete(remoteKey);
}

/** 生成语音/图片的 OSS key */
export function ossKey(
  dir: 'uploads_voice' | 'cards' | 'graduation',
  companionId: string,
  fileName: string,
): string {
  return `${dir}/${companionId}/${fileName}`;
}
```

### 5.4 内容安全升级（`src/lib/imagegen/contentAudit.ts` 改造）

```ts
// V1.0 双层内容审核
// 第一层：阿里云内容安全 API（主要防线）
// 第二层：LLM Vision 检查（补充防线，负责风格相关内容判断）

export async function auditImageContent(imageUrl: string): Promise<ContentAuditResult> {
  // 第一层：阿里云内容安全
  const aliyunResult = await callAliyunContentSafety(imageUrl);
  if (!aliyunResult.passed) {
    return { passed: false, labels: aliyunResult.labels };
  }

  // 第二层：LLM Vision 补充检查（人脸、文字、品牌）
  const visionResult = await callVisionContentCheck(imageUrl);
  if (!visionResult.passed) {
    return { passed: false, labels: [...aliyunResult.labels, ...visionResult.labels] };
  }

  return { passed: true, labels: [] };
}
```

### 5.5 图像生成串行化（原 `parallel.ts` 改为串行）

```ts
// V1.0: 主路通义万相 → 失败 → MiniMax 兜底
// 去掉双路并行，减少成本

export async function generateImage(input: ImageGenInput, companionId?: string): Promise<ImageGenResult | null> {
  // 主路
  const primary = await generateImageDashScope(input, companionId);
  if (primary) return primary;

  // 兜底
  console.warn('[imagegen] DashScope failed, falling back to MiniMax');
  return generateImageMiniMax(input, companionId);
}
```

### 5.6 DB 客户端重写（`src/lib/db/client.ts`）

```ts
// src/lib/db/client.ts — 从 mysql2 改为 pg
import 'server-only';
import { Pool, QueryResultRow } from 'pg';

const pool = new Pool({
  host: process.env.PGHOST ?? '127.0.0.1',
  port: parseInt(process.env.PGPORT ?? '5432', 10),
  user: process.env.PGUSER ?? 'root',
  password: process.env.PGPASSWORD ?? '',
  database: process.env.PGDATABASE ?? 'home',
  max: 10,
  idleTimeoutMillis: 30000,
});

export function getPool(): Pool {
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query<T>(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function execute(
  sql: string,
  params?: unknown[],
): Promise<{ affectedRows: number }> {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return { affectedRows: result.rowCount ?? 0 };
  } finally {
    client.release();
  }
}

export async function withTransaction<T>(
  fn: (client: import('pg').PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function uuid(): string {
  // PostgreSQL 可用 pgcrypto 的 gen_random_uuid()，
  // 但代码层也保留 UUID 生成以便前端使用
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // fallback v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const SINGLE_USER_ID =
  process.env.SINGLE_USER_ID ?? '00000000-0000-0000-0000-000000000001';
```

---

## 6. 环境变量与配置

### 6.1 完整 `.env.example`

```env
# ============================================================
# Home V1.0 环境变量
# ============================================================

# --- 数据库 PostgreSQL ---
PGHOST=127.0.0.1
PGPORT=5432
PGUSER=root
PGPASSWORD=
PGDATABASE=home

# --- 单用户模式（V1.0 免登录期） ---
SINGLE_USER_ID=00000000-0000-0000-0000-000000000001

# --- LLM 主模型（Anthropic Claude） ---
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# --- LLM 备选（DeepSeek，过渡期保留） ---
# LLM_PROVIDER=deepseek
# DEEPSEEK_API_KEY=sk-...
# DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
# DEEPSEEK_MODEL=deepseek-chat

# --- 阿里云 DashScope（共享 Key，用于 ASR / 图像生成 / 风格审核） ---
DASHSCOPE_API_KEY=sk-...

# --- ASR 语音识别 ---
DASHSCOPE_ASR_MODEL=paraformer-realtime-v2
DASHSCOPE_ASR_BASE_URL=wss://dashscope.aliyuncs.com/api-ws/v1/inference/

# --- 图像生成 ---
DASHSCOPE_IMAGEGEN_MODEL=wanx2.1-t2i-turbo
DASHSCOPE_IMAGEGEN_BASE_URL=https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis

# --- 风格审核（通义千问-VL） ---
DASHSCOPE_VISION_MODEL=qwen-vl-max

# --- MiniMax 兜底图像生成 ---
MINIMAX_API_KEY=
MINIMAX_IMAGEGEN_MODEL=image-01
MINIMAX_IMAGEGEN_BASE_URL=https://api.minimaxi.com/v1/image_generation

# --- 阿里云 OSS 对象存储 ---
OSS_REGION=oss-cn-hangzhou
OSS_ACCESS_KEY_ID=
OSS_ACCESS_KEY_SECRET=
OSS_BUCKET=home-v1-images

# --- 阿里云内容安全 ---
ALIYUN_CONTENT_SAFETY_ACCESS_KEY_ID=
ALIYUN_CONTENT_SAFETY_ACCESS_KEY_SECRET=

# --- Redis 缓存 ---
REDIS_URL=redis://127.0.0.1:6379/0

# --- 测试模式 ---
TEST_LLM_MODE=        # 设为 'mock' 跳过真实 LLM/ASR/图像调用

# --- 功能开关 ---
ENABLE_DEV_JPG_PICKER=false   # V1.0 默认关闭
LLM_LOG_TO_DB=true
```

### 6.2 环境变量变更对照

| 变量 | V0.6.1 | V1.0 | 说明 |
|---|---|---|---|
| `MYSQL_*` | ✓ | **下线** | 替换为 `PG*` |
| `PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE` | ✗ | **新增** | PostgreSQL 连接 |
| `DEEPSEEK_*` | ✓ | **过渡期保留** | 30 天后下线 |
| `ANTHROPIC_API_KEY` | ✗ | **新增** | Claude API |
| `LLM_PROVIDER` | ✗ | **新增** | `anthropic` / `deepseek` |
| `OSS_*` | ✗ | **新增** | 阿里云 OSS |
| `ALIYUN_CONTENT_SAFETY_*` | ✗ | **新增** | 内容安全 |
| `REDIS_URL` | ✗ | **新增** | Redis |
| `DASHSCOPE_VISION_MODEL` | `qwen-vl-plus` | `qwen-vl-max` | 升级模型 |

---

## 7. Mock 注入体系

### 7.1 Mock 注入位置汇总

V1.0 需要在以下模块注入 mock（受 `TEST_LLM_MODE=mock` 控制）：

| 模块 | 文件 | Mock 返回 |
|---|---|---|
| LLM (Claude) | `src/lib/llm/client.ts` | 各 callType 预设 JSON |
| ASR | `src/lib/asr/client.ts` | 已有（不变） |
| 图像生成 | `src/lib/imagegen/client.ts` | 已有（不变） |
| 风格审核 | `src/lib/imagegen/styleAudit.ts` | 已有（不变） |
| 内容安全 | `src/lib/imagegen/contentAudit.ts` | `{ passed: true, labels: [] }` |
| OSS 上传 | `src/lib/storage/client.ts` | 返回本地 `/mock-images/` 路径 |

### 7.2 新增 callType 的 Mock 数据

```ts
// src/lib/llm/client.ts 中的 MOCK_RAWS 扩展
const MOCK_RAWS: Record<string, string> = {
  // ... 已有 mock ...
  
  visit: JSON.stringify({
    scene_narrative: '小青龙敲了敲大熊家的门。大熊慢吞吞地开了门，屋里全是森林和户外的画。',
    observation: '大熊眼里最多的是树、鱼和泥地——它从没提过城市里的东西。',
    new_word: {
      concept: '钓鱼',
      source_type: 'secondhand',
      source_companion: '大熊',
      confidence: 0.3,
    },
  }),

  school: JSON.stringify({
    question: '什么样的人通常当医生？',
    answers: [
      { companion: '小青龙', answer: '温柔、会照顾人的人。', basis: '你跟我说过奶奶很温柔' },
      { companion: '大熊', answer: '穿白大褂、不怕血的人。', basis: '' },
    ],
    highlight: '每只伙伴的答案都来自它自己的经历',
    teaching_moment: 'AI 回答不同的问题，是因为它们见过的东西不一样。',
  }),

  plaza_act: JSON.stringify({
    scene_narrative: '洪水冲垮了堤坝，百姓在哭喊。丞相在朝堂上召集大臣商议对策。',
    companion_speech: '（展开《治水图》）依图所示，应在上游开渠分流，下游加固堤坝。',
    reactions: '大将军点头赞同，户部尚书却面露难色——开渠需要大量银两。',
    item_use_quality: 'clever',
  }),

  plaza_ending: JSON.stringify({
    ending_type: 'good',
    narrative: '洪水终于退去。虽然耗尽了国库，但百姓保住了家园。小青龙因为善用《治水图》被皇帝嘉奖。',
    earned_items: [{ item_id: 'jade_seal', item_name: '皇帝赐的玉印', category: 'gift' }],
  }),
};
```

---

## 8. 验收标准

### 8.1 阶段验收清单

本阶段的验收不依赖任何前端页面，全部在 Node.js 环境完成：

- [ ] PostgreSQL schema `0004_v1_init_pg.sql` 在本地 PostgreSQL 15 执行成功，所有表创建无误
- [ ] 种子数据 `0005_v1_seed.sql` 执行后 8 个预设伙伴 + 4 个 NPC 伙伴入库
- [ ] `npm run type-check` 通过，零错误
- [ ] `src/lib/db/client.ts` 重写完成，`query / queryOne / execute / withTransaction` 四个函数在 PostgreSQL 上工作正常
- [ ] `src/lib/db/repos.ts` 所有函数改写为 PostgreSQL SQL，关键用例通过（createCompanion / insertMemory / getMemoryBank / insertCompanionLine / upsertWorldview）
- [ ] `src/lib/db/cardsRepo.ts` 改写完成，createCard / getActiveCardForMemory / setCardChildAction 正常
- [ ] LLM 客户端切换为 Claude：`callLLM({ callType: 'pass1', ... })` mock 模式返回正确数据结构
- [ ] 新增 4 个 callType（`visit` / `school` / `plaza_act` / `plaza_ending`）mock 模式各返回正确数据结构
- [ ] `src/lib/storage/client.ts` 的 `uploadToOSS` mock 模式返回本地路径
- [ ] 内容安全模块 `auditImageContent` mock 模式返回 `{ passed: true }`
- [ ] 图像生成串行化：主路成功时不调 MiniMax，主路失败时才兜底
- [ ] `dev/reset` 端点清空所有 11 张表并重新灌入种子数据
- [ ] `npm run lint` 通过

### 8.2 不在此阶段验证

- 任何前端页面（Plan_02 覆盖）
- 驿站 API（Plan_03 覆盖）
- 自动化测试 spec（Plan_04 覆盖）
- Day 7 档案生成（Plan_04 覆盖）
- Prompt 全量重写适配 Claude（Plan_04 覆盖）

---

*文档结束*
