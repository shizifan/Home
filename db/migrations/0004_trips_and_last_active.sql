-- Home V1.0 P2 — 驿站基础（朋友家拜访的数据底）+ "等了你一天" greeting 字段
-- 对应 spec/Implementation_Plan_V1.0.2.md §P2.2 P2-T1
--
-- 三个变更：
--   1. companions.last_active_at — 用于 PRD §16.3 "等了你一天" 5 选 1 台词触发
--   2. memory_bank 加 source_type / source_companion_id — PRD §12.7 二手知识标识
--   3. 新增 trips 表 — PRD §22.1.8
--
-- 幂等性：通过查 information_schema 的 stored procedure 实现，
-- 多次运行此文件是安全的（MySQL 不支持 `ADD COLUMN IF NOT EXISTS`，须用此变通）。

set names utf8mb4;
set time_zone = '+00:00';

-- =============================================================
-- 用一个临时 procedure 把"列存在性 + 约束存在性"的 idempotent 检查集中处理
-- =============================================================
drop procedure if exists _migrate_0004;

delimiter //
create procedure _migrate_0004()
begin
  -- companions.last_active_at
  if not exists (
    select 1 from information_schema.columns
    where table_schema = database()
      and table_name = 'companions'
      and column_name = 'last_active_at'
  ) then
    alter table companions
      add column last_active_at datetime(3) null default null after last_panel_visit_at;
  end if;

  -- memory_bank.source_type
  if not exists (
    select 1 from information_schema.columns
    where table_schema = database()
      and table_name = 'memory_bank'
      and column_name = 'source_type'
  ) then
    alter table memory_bank
      add column source_type varchar(20) not null default 'firsthand' after confidence;
  end if;

  -- memory_bank.source_companion_id
  if not exists (
    select 1 from information_schema.columns
    where table_schema = database()
      and table_name = 'memory_bank'
      and column_name = 'source_companion_id'
  ) then
    alter table memory_bank
      add column source_companion_id char(36) null after source_type;
  end if;

  -- 数据规整：把任何不属于 ('firsthand','secondhand') 的旧值（如 Qoder V1.0
  -- 实验留下的 'direct'）统一映射为 'firsthand'。这一步必须在 add constraint 前做。
  update memory_bank
    set source_type = 'firsthand'
    where source_type is null or source_type not in ('firsthand', 'secondhand');

  -- 把列默认值对齐到 'firsthand'（如果之前是 'direct' 等）
  alter table memory_bank
    alter column source_type set default 'firsthand';

  -- memory_bank chk_memory_bank_source（先 drop 再 add，保证幂等）
  if exists (
    select 1 from information_schema.table_constraints
    where table_schema = database()
      and table_name = 'memory_bank'
      and constraint_name = 'chk_memory_bank_source'
  ) then
    alter table memory_bank drop constraint chk_memory_bank_source;
  end if;
  alter table memory_bank
    add constraint chk_memory_bank_source check (source_type in ('firsthand','secondhand'));
end//
delimiter ;

call _migrate_0004();
drop procedure _migrate_0004;

-- 老数据全部按 firsthand 处理（默认值已是 'firsthand'）

-- =============================================================
-- trips — 旅行表（PRD §22.1.8）
-- 朋友家 / 学校 / 广场 三种 trip_type 共用此表
-- 每天每 companion 最多 1 次（出行限流在 API 层控制）
-- create table if not exists 本身幂等
-- =============================================================
create table if not exists trips (
  id char(36) primary key,
  companion_id char(36) not null,

  trip_type varchar(20) not null,                 -- 'visit' / 'school' / 'plaza'

  -- 朋友家专用
  destination_companion_id char(36),              -- 真实伙伴 id；系统预设伙伴时此字段空

  -- 朋友家、学校用：目的字段
  purpose_type varchar(50),
  -- 'meet_friend' / 'observe_home' / 'introduce_self' / 'ask_question'（朋友家）
  -- 'attend_class' / 'ask_my_question' / 'observe_others' / 'learn_new'（学校）
  -- 'plaza_play'（广场）

  purpose_question text,                          -- 仅 ask_question / ask_my_question 类型

  -- 广场专用（P4 阶段会有 plaza_plays 表与之关联，FK 暂留软引用避免 P2 / P4 迁移顺序耦合）
  plaza_play_id char(36),

  -- 状态与结果
  status varchar(20) not null default 'traveling',  -- 'traveling' / 'returned'
  departed_at datetime(3) default current_timestamp(3),
  returned_at datetime(3) null default null,         -- 叙事上的"回家时间"

  report_narrative text,
  report_data json,                                  -- 完整报告数据（answers / new_word / scenes 等）

  created_at datetime(3) default current_timestamp(3),

  key idx_trips_companion_created (companion_id, created_at),
  key idx_trips_status (status),
  -- 注：每天出门 1 次的限制在 API 层实现（按 created_at 的日期去重 + Redis 限流）
  -- 不放 DB 唯一约束，避免 generated/virtual column 的脆弱组合 + 跨时区问题

  constraint fk_trips_companion foreign key (companion_id) references companions(id) on delete cascade,
  constraint chk_trips_type check (trip_type in ('visit','school','plaza')),
  constraint chk_trips_status check (status in ('traveling','returned'))
) engine=innodb default charset=utf8mb4 collate=utf8mb4_unicode_ci;
