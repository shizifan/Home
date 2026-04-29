-- Home MVP — 初始化 schema (MySQL 8 版)
-- 与 PRD V0.5 §16.1 + 实施计划同源；从 Postgres 版重写。
-- 主要变化：JSONB → JSON、TIMESTAMPTZ → DATETIME(3)、删 RLS 段、UUID 用 CHAR(36) 由应用层生成。

set names utf8mb4;
set time_zone = '+00:00';

-- =============================================================
-- users — P2 阶段无登录，单行 seed
-- =============================================================
create table if not exists users (
  id char(36) primary key,
  parent_phone varchar(20),
  child_nickname varchar(50),
  child_age int,
  consent_at datetime(3),
  consent_version varchar(10),
  created_at datetime(3) default current_timestamp(3),
  updated_at datetime(3) default current_timestamp(3) on update current_timestamp(3),
  unique key uk_users_phone (parent_phone),
  constraint chk_users_age check (child_age is null or (child_age between 4 and 16))
) engine=innodb default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- =============================================================
-- companions — 一个用户 1 个伙伴
-- =============================================================
create table if not exists companions (
  id char(36) primary key,
  user_id char(36) not null,
  preset_id varchar(50) not null,
  custom_name varchar(50),
  starting_personality varchar(50) not null,
  current_day int not null default 1,
  last_panel_visit_at datetime(3),
  personality_weight decimal(3,2) not null default 1.00,
  created_at datetime(3) default current_timestamp(3),
  graduated_at datetime(3),
  key idx_companions_user (user_id),
  constraint fk_companions_user foreign key (user_id) references users(id) on delete cascade,
  constraint chk_companions_day check (current_day between 1 and 7),
  constraint chk_companions_weight check (personality_weight between 0 and 1)
) engine=innodb default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- =============================================================
-- memories — 孩子每次原始输入
-- =============================================================
create table if not exists memories (
  id char(36) primary key,
  companion_id char(36) not null,
  day int not null,
  type varchar(20) not null,
  photo_url text,
  vision_tags json,
  user_text text,
  task_id varchar(100) not null,
  task_question text,
  created_at datetime(3) default current_timestamp(3),
  key idx_memories_companion_day (companion_id, day),
  key idx_memories_created (created_at),
  constraint fk_memories_companion foreign key (companion_id) references companions(id) on delete cascade,
  constraint chk_memories_type check (type in ('photo','text','choice','skipped')),
  constraint chk_memories_day check (day between 1 and 7)
) engine=innodb default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- =============================================================
-- memory_bank — AI 整理后的概念库（PRD §5）
-- =============================================================
create table if not exists memory_bank (
  id char(36) primary key,
  companion_id char(36) not null,
  type varchar(20) not null,
  concept_name varchar(100) not null,
  concept_category varchar(50),
  ai_summary text,
  ai_reasoning text,
  evidence json not null,
  confidence float not null default 0.5,
  user_corrected boolean not null default false,
  user_correction_history json not null,
  cached_detail json,
  cache_dirty boolean not null default true,
  display_order int,
  last_updated datetime(3) default current_timestamp(3) on update current_timestamp(3),
  created_at datetime(3) default current_timestamp(3),
  key idx_memory_bank_companion_type (companion_id, type),
  key idx_memory_bank_updated (last_updated desc),
  -- 同一 companion 下，同名 remembered 概念唯一（P2 阶段约束）
  unique key uk_memory_bank_remembered (companion_id, concept_name, type),
  constraint fk_memory_bank_companion foreign key (companion_id) references companions(id) on delete cascade,
  constraint chk_memory_bank_type check (type in ('remembered','uncertain','set_aside','unknown')),
  constraint chk_memory_bank_category check (
    concept_category is null or
    concept_category in ('person','place','food','activity','object','emotion','other')
  ),
  constraint chk_memory_bank_conf check (confidence between 0 and 1)
) engine=innodb default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- =============================================================
-- conversations — 对话轨迹
-- =============================================================
create table if not exists conversations (
  id char(36) primary key,
  companion_id char(36) not null,
  day int not null,
  role varchar(20) not null,
  content text not null,
  source varchar(40),
  related_memory_id char(36),
  related_memory_bank_id char(36),
  created_at datetime(3) default current_timestamp(3),
  key idx_conversations_companion_day (companion_id, day),
  constraint fk_conversations_companion foreign key (companion_id) references companions(id) on delete cascade,
  constraint fk_conversations_memory foreign key (related_memory_id) references memories(id) on delete set null,
  constraint fk_conversations_memory_bank foreign key (related_memory_bank_id) references memory_bank(id) on delete set null,
  constraint chk_conversations_role check (role in ('companion','child','system'))
) engine=innodb default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- =============================================================
-- worldview_cards — Day 7 档案
-- =============================================================
create table if not exists worldview_cards (
  id char(36) primary key,
  companion_id char(36) not null,
  most_important_person text,
  most_fun_thing text,
  most_delicious_thing text,
  most_scary_thing text,
  unknown_thing text,
  almost_forgot_thing text,
  stats json,
  generated_at datetime(3) default current_timestamp(3),
  raw_llm_output json,
  unique key uk_worldview_companion (companion_id),
  constraint fk_worldview_companion foreign key (companion_id) references companions(id) on delete cascade
) engine=innodb default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- =============================================================
-- llm_call_log — 监控（不收用户内容）
-- =============================================================
create table if not exists llm_call_log (
  id bigint primary key auto_increment,
  companion_id char(36),
  call_type varchar(40) not null,
  model varchar(80),
  input_tokens int,
  output_tokens int,
  latency_ms int,
  success boolean not null,
  fail_reason varchar(40),
  prompt_version varchar(20),
  created_at datetime(3) default current_timestamp(3),
  key idx_llm_call_log_type_time (call_type, created_at),
  constraint fk_llm_log_companion foreign key (companion_id) references companions(id) on delete set null
) engine=innodb default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- =============================================================
-- companion_presets — 8 个伙伴 lookup（与 prompts/shared/companions.json 同源）
-- =============================================================
create table if not exists companion_presets (
  preset_id varchar(50) primary key,
  display_name varchar(50) not null,
  appearance text not null,
  starting_personality varchar(50) not null,
  opening_line text not null,
  voice_traits text not null,
  ip_risk boolean not null default false,
  display_order int
) engine=innodb default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- =============================================================
-- 派生统计视图（PRD §16.2）
-- =============================================================
create or replace view companion_stats as
select
  c.id as companion_id,
  (select count(*) from memories m where m.companion_id = c.id and m.type = 'photo') as photos,
  (select count(*) from conversations cv where cv.companion_id = c.id and cv.role = 'companion') as conversations_count,
  (select count(*) from memory_bank mb
     where mb.companion_id = c.id
       and mb.user_correction_history is not null
       and json_length(mb.user_correction_history) > 0) as corrections,
  c.current_day
from companions c;
