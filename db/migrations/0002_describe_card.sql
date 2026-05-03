-- Home V0.6.1 — 描述卡片机制 schema 迁移
-- 对应 spec/Home_V0.6.1_Implementation_Plan_V0.1.md §4

set names utf8mb4;
set time_zone = '+00:00';

-- =============================================================
-- memories — 新增字段
-- =============================================================
alter table memories
  add column input_method varchar(20) not null default 'photo',
  add column voice_audio_url text,
  add column asr_transcription text,
  add column edited_text text,
  add column regenerate_count int not null default 0;

-- 老数据 input_method 默认 photo；后续 photo 类型记录保持原样
update memories
  set input_method = case
    when type = 'voice' then 'voice'
    when type = 'text' then 'text'
    when type = 'choice' then 'choice'
    when type = 'skipped' then 'skipped'
    else 'photo'
  end
  where input_method = 'photo';

-- 扩容 type 枚举：加入 'voice' 'describe'
alter table memories drop check chk_memories_type;
alter table memories add constraint chk_memories_type
  check (type in ('photo','text','choice','skipped','voice','describe'));

-- input_method 也加 check
alter table memories add constraint chk_memories_input_method
  check (input_method in ('photo','voice','text','choice','skipped','describe'));

-- =============================================================
-- cards — AI 生成的纸片插画卡片（V0.6.1 §4）
-- =============================================================
create table if not exists cards (
  id char(36) primary key,
  memory_id char(36) not null,
  companion_id char(36) not null,

  image_url text,
  image_prompt text,
  raw_keyword_extract json,

  style_check_passed tinyint(1),
  style_check_severity varchar(20),     -- 'ok' | 'minor' | 'major'
  style_check_issues json,

  generation_attempt int not null default 1,
  is_active tinyint(1) not null default 0,
  is_fallback_text_card tinyint(1) not null default 0,

  child_action varchar(20),             -- 'confirmed' | 'rejected' | 'no_action_timeout'
  confirmed_at datetime(3),

  created_at datetime(3) default current_timestamp(3),
  key idx_cards_memory (memory_id),
  key idx_cards_active (memory_id, is_active),
  key idx_cards_companion (companion_id),
  constraint fk_cards_memory foreign key (memory_id) references memories(id) on delete cascade,
  constraint fk_cards_companion foreign key (companion_id) references companions(id) on delete cascade,
  constraint chk_cards_attempt check (generation_attempt between 1 and 4),
  constraint chk_cards_severity check (
    style_check_severity is null or
    style_check_severity in ('ok','minor','major')
  ),
  constraint chk_cards_action check (
    child_action is null or
    child_action in ('confirmed','rejected','no_action_timeout')
  )
) engine=innodb default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- =============================================================
-- llm_call_log — 扩 callType 范围
-- =============================================================
-- 不强制限制 call_type 的取值，原表已是 varchar；不需要 alter
-- 新 callType: keyword_extract / style_audit / asr
