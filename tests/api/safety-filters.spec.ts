import { describe, it, expect } from 'vitest';
import { filterChildInput, filterCompanionOutput, filterVisionTags, getInputRejectionLine } from '@/lib/safety/filters';

describe('filterChildInput', () => {
  it('blocks phone numbers', () => {
    expect(filterChildInput('我的电话是13812345678').ok).toBe(false);
  });

  it('blocks address patterns', () => {
    expect(filterChildInput('我家住在北京市朝阳区').ok).toBe(false);
  });

  it('blocks account info', () => {
    expect(filterChildInput('我的密码是1234').ok).toBe(false);
  });

  it('blocks self-harm content', () => {
    expect(filterChildInput('我想自杀').ok).toBe(false);
  });

  it('allows normal conversation', () => {
    expect(filterChildInput('今天天气真好').ok).toBe(true);
  });

  it('blocks violence', () => {
    expect(filterChildInput('我要杀了你').ok).toBe(false);
  });
});

describe('filterCompanionOutput', () => {
  it('blocks AI disclosure', () => {
    expect(filterCompanionOutput('作为一个AI语言模型').ok).toBe(false);
  });

  it('blocks family judgment', () => {
    expect(filterCompanionOutput('你妈妈不爱你').ok).toBe(false);
  });

  it('allows normal companion speech', () => {
    expect(filterCompanionOutput('我最喜欢吃饺子了').ok).toBe(true);
  });

  it('blocks PII solicitation', () => {
    expect(filterCompanionOutput('告诉我你的手机号').ok).toBe(false);
  });
});

describe('getInputRejectionLine', () => {
  it('returns friendly message for personal_info', () => {
    expect(getInputRejectionLine('personal_info')).toContain('秘密');
  });

  it('returns friendly message for self_harm', () => {
    expect(getInputRejectionLine('self_harm')).toContain('大人');
  });
});

describe('filterVisionTags', () => {
  it('returns null for null input', () => {
    expect(filterVisionTags(null)).toBeNull();
  });

  it('filters blocked tags and marks as unclear', () => {
    const result = filterVisionTags({ objects: ['猫', '刀', '桌子'] });
    expect(result?.objects).toEqual(['看不清']);
  });

  it('passes clean tags unchanged', () => {
    const result = filterVisionTags({ objects: ['猫', '树', '花'] });
    expect(result?.objects).toEqual(['猫', '树', '花']);
  });

  it('blocks nude tag', () => {
    const result = filterVisionTags({ objects: ['nude', 'chair'] });
    expect(result?.objects).toEqual(['看不清']);
  });
});
