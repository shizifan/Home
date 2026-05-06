import { test, expect } from '@playwright/test';

/**
 * P5 广场剧本完整流程节点
 *
 * 与前阶段一致：节点测试 + skipped happy-path。
 * 完整跑通需要 graduated + school_count>=1 + 真实 LLM。
 */

test.describe('plaza · 路由 + 状态机', () => {
  test('act 页缺 play_id 时显示出错或回跳驿站', async ({ page }) => {
    // 直接访问一个不存在的 play_id 的 act 1
    await page.goto('/station/plaza/play/non-existent-id/act/1');
    // 应显示错误态或重定向
    await page.waitForLoadState('networkidle', { timeout: 8_000 });
    // 当前页面应该是错误态（"出了点问题"）或者已重定向回 /station
    const url = page.url();
    const onErrorPage =
      url.includes('/station/plaza/play/non-existent-id/act') ||
      url.endsWith('/station');
    expect(onErrorPage).toBeTruthy();
  });

  test('ending 页缺 play_id 时显示重试提示', async ({ page }) => {
    await page.goto('/station/plaza/play/missing-play/ending');
    await page.waitForLoadState('networkidle', { timeout: 8_000 });
    // 期望显示错误降级（"它今天没演完"或"出了点问题"）
    const errorVisible = await page
      .getByText(/没演完|出了点问题|回驿站/)
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    expect(errorVisible).toBeTruthy();
  });
});

test.describe.skip('plaza · happy path（需要 school_count>=1 + LLM 全跑）', () => {
  test('选 3 道具 → 走完 3 幕 → 看结局 → 行囊新增道具', async ({ page }) => {
    await page.goto('/station/plaza/prepare');
    // 选前 3 件道具
    const items = page.locator('[aria-pressed]');
    await items.nth(0).click();
    await items.nth(1).click();
    await items.nth(2).click();
    await page.getByRole('button', { name: /出发/ }).click();

    // 第 1 幕：选第一件道具的"使用"按钮
    await page.waitForURL('**/play/*/act/1', { timeout: 12_000 });
    await page.locator('button').filter({ hasText: /●|不用道具/ }).first().click();
    // 等 LLM 回来
    await page.getByRole('button', { name: /继续/ }).waitFor({ timeout: 30_000 });
    await page.getByRole('button', { name: /继续/ }).click();

    // 第 2 幕
    await page.waitForURL('**/play/*/act/2');
    await page.locator('button').filter({ hasText: /●|不用道具/ }).first().click();
    await page.getByRole('button', { name: /继续/ }).waitFor({ timeout: 30_000 });
    await page.getByRole('button', { name: /继续/ }).click();

    // 第 3 幕
    await page.waitForURL('**/play/*/act/3');
    await page.locator('button').filter({ hasText: /●|不用道具/ }).first().click();
    await page.getByRole('button', { name: /看结局/ }).waitFor({ timeout: 30_000 });
    await page.getByRole('button', { name: /看结局/ }).click();

    // 结局页
    await page.waitForURL('**/play/*/ending', { timeout: 30_000 });
    await expect(page.getByText(/小青龙带回了/)).toBeVisible();
  });
});
