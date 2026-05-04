-- ============================================================
-- Home V1.0 Seed Data
-- ============================================================

-- Test user (single-user mode)
INSERT INTO users (id, parent_phone, child_nickname) VALUES
    ('00000000-0000-0000-0000-000000000001', NULL, '测试小朋友')
ON CONFLICT (id) DO NOTHING;

-- 8 preset companions
INSERT INTO companion_presets (preset_id, display_name, starting_personality, opening_line, voice_traits, ip_risk, display_order) VALUES
    ('xiaoqinglong', '小青龙', '好奇、温和、有一点慢热',
     '你好，我是小青龙。你是我的新主人吗？',
     '温和、语速中慢、常用"嗯"开头', false, 1),
    ('dabear', '大熊', '憨厚、沉稳、有点不善言辞',
     '嗯...你好。我是大熊。',
     '低沉、语速慢、常停顿', false, 2),
    ('xiaohuolong', '小火龙', '热情、急躁、心直口快',
     '嘿！你终于来了！我是小火龙，我们认识一下吧！',
     '语速快、音调高、常用叹号', false, 3),
    ('tengtengshe', '藤藤蛇', '安静、内向、但观察力强',
     '...你好。我是藤藤蛇。',
     '轻柔、语速慢、省略号多', false, 4),
    ('xiaolvlong', '小绿龙', '活泼、爱笑、话多',
     '哇！你来啦！我是小绿龙，我最喜欢玩啦！',
     '语速快、笑声多、叠字', false, 5),
    ('linnabel', '琳娜贝尔', '胆小、温柔、敏感',
     '（小声）...你好，我是琳娜。（偷偷看你）',
     '小声、犹豫、常问"可以吗"', false, 6),
    ('xiaolaohu', '小老虎', '直率、勇敢、想到就做',
     '嗷！小老虎来啦！我们可以一起玩吗？',
     '音量大、直接、常用短句', false, 7),
    ('xiaoshizi', '小狮子', '自信、有点傲娇、但内心柔软',
     '嗯哼，你就是本王的伙伴？...好吧，我是小狮子。',
     '自信、语调上扬、偶尔傲娇', false, 8)
ON CONFLICT (preset_id) DO NOTHING;

-- 4 NPC companions for station matching
INSERT INTO companion_presets (preset_id, display_name, starting_personality, ip_risk, display_order) VALUES
    ('sys_xiaoyu', '小鱼', '只记得海边的一切，对陆地世界完全陌生', true, 9),
    ('sys_tudou', '土豆', '只记得田野和农耕的事，对城市生活一无所知', true, 10),
    ('sys_xingxing', '星星', '只记得夜晚和天空，对白天的事不太了解', true, 11),
    ('sys_amu', '阿木', '只记得森林和树木，从未见过人类建筑', true, 12)
ON CONFLICT (preset_id) DO NOTHING;
