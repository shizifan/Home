-- Home V1.0 P4 — 行囊 + 广场基础（PRD §14 / §22.1.9 / §22.1.10）
-- 对应 spec/Implementation_Plan_V1.0.2.md §P4.2 P4-T1
--
-- 两个新表：
--   1. inventory_items — 行囊道具（每个道具一条；多次获得同 item_id 累加 use_count，但当前简化为
--      "同 item_id 在同 companion 下只存 1 行"，多次"再获得"幂等忽略；详见 repos.ts 实现注释）
--   2. plaza_plays — 广场剧本玩法记录（每次一行）
--
-- 幂等：用 stored procedure 检查 information_schema 后再 ALTER；多次执行安全。

set names utf8mb4;
set time_zone = '+00:00';

-- =============================================================
-- inventory_items
-- =============================================================
create table if not exists inventory_items (
  id char(36) primary key,
  companion_id char(36) not null,

  item_id varchar(50) not null,                  -- 'treatise_water_control_basic' 等
  item_name varchar(100) not null,
  item_category varchar(20) not null,            -- 'knowledge' / 'object' / 'gift' / 'ability'
  item_subcategory varchar(50),
  item_description text,
  item_detailed_description text,

  acquired_at datetime(3) default current_timestamp(3),
  acquired_from varchar(100),                    -- 'starter_pack' / 'water_disaster_reward' 等

  use_count int not null default 0,
  last_used_at datetime(3) null default null,

  is_upgraded_from char(36) null,                -- 自引用：《治水图》→《治水十策》

  created_at datetime(3) default current_timestamp(3),

  key idx_inventory_companion (companion_id),
  key idx_inventory_companion_category (companion_id, item_category),
  -- 同一 companion 下相同 item_id 唯一（避免重复获得叠加成多行）
  unique key uk_inventory_companion_item (companion_id, item_id),

  constraint fk_inventory_companion foreign key (companion_id) references companions(id) on delete cascade,
  constraint fk_inventory_upgrade foreign key (is_upgraded_from) references inventory_items(id) on delete set null,
  constraint chk_inventory_category check (item_category in ('knowledge','object','gift','ability'))
) engine=innodb default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- =============================================================
-- plaza_plays（每场一行；3 幕 act_choices 用 JSON 记录）
-- =============================================================
create table if not exists plaza_plays (
  id char(36) primary key,
  companion_id char(36) not null,
  trip_id char(36) null,                         -- 关联 trips.id（trip_type='plaza'）

  scenario_id varchar(50) not null,              -- 'water_disaster' 等
  scenario_title varchar(100),

  act_choices json,                              -- [{act:1, item_id, quality:'natural'|'stretched'|'skipped'}, ...]
  ending_type varchar(20),                       -- 'perfect' / 'good' / 'barely'
  ending_narrative text,
  earned_items json,                             -- 本次获得的 item_id 列表

  played_at datetime(3) default current_timestamp(3),
  finished_at datetime(3) null default null,

  key idx_plaza_plays_companion (companion_id),
  key idx_plaza_plays_companion_scenario (companion_id, scenario_id),
  constraint fk_plaza_plays_companion foreign key (companion_id) references companions(id) on delete cascade,
  constraint fk_plaza_plays_trip foreign key (trip_id) references trips(id) on delete set null,
  constraint chk_plaza_ending_type check (
    ending_type is null or ending_type in ('perfect','good','barely')
  )
) engine=innodb default charset=utf8mb4 collate=utf8mb4_unicode_ci;
