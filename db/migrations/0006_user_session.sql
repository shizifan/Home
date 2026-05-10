-- Home V1.0 P6 — 多用户软隔离（PRD §27.2 昵称软隔离方案）
-- 对应 spec/Implementation_Plan_V1.0.2.md §P6.2 P6-T1
--
-- 改动：
--   1. users 表加 nickname / device_fingerprint / last_active_at（如果还没）
--   2. 索引 (nickname) 加速找回；联合索引 (nickname, device_fingerprint) 用于"同一浏览器 + 同昵称识别同一用户"
--   3. parent_phone 已有 unique key，但 V1.0 临时方案不要求填，所以放宽：允许多行 NULL（已是默认行为）
--
-- 幂等：用 information_schema 检查后再 ALTER；多次执行安全。

set names utf8mb4;
set time_zone = '+00:00';

drop procedure if exists _migrate_0006;

delimiter //
create procedure _migrate_0006()
begin
  -- users.nickname
  if not exists (
    select 1 from information_schema.columns
    where table_schema = database()
      and table_name = 'users'
      and column_name = 'nickname'
  ) then
    alter table users
      add column nickname varchar(50) null after id;
  end if;

  -- users.device_fingerprint
  if not exists (
    select 1 from information_schema.columns
    where table_schema = database()
      and table_name = 'users'
      and column_name = 'device_fingerprint'
  ) then
    alter table users
      add column device_fingerprint varchar(100) null after nickname;
  end if;

  -- users.last_active_at（与 companions.last_active_at 区分；用户级访问）
  if not exists (
    select 1 from information_schema.columns
    where table_schema = database()
      and table_name = 'users'
      and column_name = 'last_active_at'
  ) then
    alter table users
      add column last_active_at datetime(3) null default null after consent_version;
  end if;

  -- users.status（V1.0 临时方案默认 'active'；V0.7 升级用）
  if not exists (
    select 1 from information_schema.columns
    where table_schema = database()
      and table_name = 'users'
      and column_name = 'status'
  ) then
    alter table users
      add column status varchar(20) not null default 'active' after device_fingerprint;
  end if;

  -- 索引：nickname + device_fingerprint 联合（"同浏览器 + 同昵称识别同一用户"）
  if not exists (
    select 1 from information_schema.statistics
    where table_schema = database()
      and table_name = 'users'
      and index_name = 'idx_users_nickname_fp'
  ) then
    create index idx_users_nickname_fp on users (nickname, device_fingerprint);
  end if;

  -- 索引：仅 nickname（用于找回时 by-nickname 列出）
  if not exists (
    select 1 from information_schema.statistics
    where table_schema = database()
      and table_name = 'users'
      and index_name = 'idx_users_nickname'
  ) then
    create index idx_users_nickname on users (nickname);
  end if;
end//
delimiter ;

call _migrate_0006();
drop procedure _migrate_0006;
