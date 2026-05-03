-- Home V0.6.1 — 双图源对比测试 schema 迁移
-- 同一张 card 可同时持有 DashScope 和 MiniMax 的图，前端横向对比。

alter table cards
  add column image_source varchar(20) null after image_url,
  add column alt_image_url text null after image_source,
  add column alt_image_source varchar(20) null after alt_image_url;
