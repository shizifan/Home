-- Home MVP — Seed (MySQL 8 版)
-- 1. 单用户固定行（P2 无登录方案 A）
-- 2. 8 个预设伙伴 lookup

-- 单用户
insert into users (id, parent_phone)
values ('00000000-0000-0000-0000-000000000001', null)
on duplicate key update updated_at = current_timestamp(3);

-- 清空再插（保持幂等）
delete from companion_presets;

insert into companion_presets
  (preset_id, display_name, appearance, starting_personality, opening_line, voice_traits, ip_risk, display_order)
values
  ('xiaoqinglong', '小青龙', '灰色小生物，有犄角，长尾巴',
   'quiet_slow', '我...是谁？这里是哪？不过有你在我就不怕了。',
   '多省略号、短句、用词朴素、一次只说一件事', false, 1),
  ('dabear', '大熊', '米色长毛泰迪熊',
   'warm_soft', '嗯......你好。新家好大啊。',
   '多语气词（嗯、啊、哦）、思考停顿、句子断开', false, 2),
  ('xiaohuolong', '小火龙', '红色小龙，咧嘴大笑',
   'cheerful', '嘿嘿嘿！你就是要给我讲故事的人吗？',
   '感叹号多、笑声、追问、节奏快', false, 3),
  ('tengtengshe', '藤藤蛇', '绿黄相间的小蛇/恐龙',
   'guarded_shy', '......你不会突然把我抱起来吧？',
   '短句、迟疑、问句结尾、不喜欢正面表态', true, 4),
  ('xiaolvlong', '小绿龙', '橄榄绿长腿小恐龙',
   'curious_loud', '这里是哪里？！你是谁？！外面有什么？！',
   '问号多、连珠炮、爱问"为什么"、好奇外延', false, 5),
  ('linnabel', '琳娜贝尔', '粉色小狐狸/猫，戴花朵',
   'shy_soft', '（小声）...你能先和我说话吗？',
   '括号里的小动作描述、声音轻、需要被鼓励才完整说话', true, 6),
  ('xiaolaohu', '小老虎', '棕色斑纹小老虎',
   'energetic', '新家！新家！我能跑吗？！',
   '短句快节奏、动作描述、感叹号、爱重复', false, 7),
  ('xiaoshizi', '小狮子', '米色小狮子，金色鬃毛',
   'pretentious', '嗯，我是知道这里的。咳咳。其实我也是第一次来。',
   '故作正式、用词偶尔过大、然后破功暴露真实状态', false, 8);
