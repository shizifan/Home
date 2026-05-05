import { test, expect } from '@playwright/test';

/**
 * P1-T8 烟雾测试 — 验证应用能启动、初次访问能跳进引导。
 * 不做视觉回归，只检查关键节点可达。
 */

test.describe('smoke · 启动到引导', () => {
  test('未登录访问 / 应显示启动页并能进入 /intro', async ({ page, context }) => {
    // 干净 localStorage（companionStore 默认就是空 store，但保险起见）
    await context.clearCookies();

    await page.goto('/');

    // 启动页有大标题"Home"
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

    // 没有 companion 时 CTA 文案是"开始"
    const cta = page.getByRole('link', { name: /开始/ });
    await expect(cta).toBeVisible();

    // 点击 → 进入 /intro
    await cta.click();
    await page.waitForURL('**/intro');
    expect(page.url()).toContain('/intro');
  });

  test('引导 4 张卡片可一路推进，最后进入 /onboarding/choose', async ({ page }) => {
    await page.goto('/intro');

    // 卡片 1：首句关键词
    await expect(page.getByText('一个等着你最喜欢的玩具搬进来的小家')).toBeVisible();
    await page.getByRole('button', { name: '往下看 →' }).click();

    // 卡片 2
    await expect(page.getByText('它对这里完全陌生')).toBeVisible();
    await page.getByRole('button', { name: '往下看 →' }).click();

    // 卡片 3：PRD §17.2 暗示语音的「说说」
    await expect(page.getByText('说说你们的故事')).toBeVisible();
    await page.getByRole('button', { name: '往下看 →' }).click();

    // 卡片 4：CTA 文案变为「带它回家」
    await expect(page.getByText('钻进它的脑袋')).toBeVisible();
    await page.getByRole('button', { name: '带它回家 →' }).click();

    // 进入选伙伴页
    await page.waitForURL('**/onboarding/choose');
    expect(page.url()).toContain('/onboarding/choose');
  });

  test('右上角"跳过引导"应直接进入 /onboarding/choose', async ({ page }) => {
    await page.goto('/intro');
    await page.getByRole('button', { name: '跳过引导' }).click();
    await page.waitForURL('**/onboarding/choose');
    expect(page.url()).toContain('/onboarding/choose');
  });
});
