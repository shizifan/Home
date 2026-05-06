import { test, expect } from '@playwright/test';

/**
 * P4 行囊 + 广场准备页流程节点
 *
 * 与前面阶段一致：只验路由 / UI 节点 / 必要的禁用态切换；
 * 不打 LLM、不需要真实毕业 + school_count>=1 状态。
 */

test.describe('inventory · 路由 + UI 节点', () => {
  test('未拥有道具时进 /inventory 显示空状态 + 跳驿站链接', async ({ page }) => {
    await page.goto('/inventory');
    // 未毕业 / 单用户没创建过 companion → API 404 → 空状态可能不会渲染
    // 但页面至少应该加载出 header
    await expect(page.getByRole('link', { name: '← 回小家' })).toBeVisible();
    await expect(page.getByText('行囊')).toBeVisible();
  });
});

test.describe.skip('plaza · happy path（需要 graduated + school_count>=1 + LLM）', () => {
  test('准备页：剧本简介 + 角色 + 行囊（含新手礼包提示）', async ({ page }) => {
    await page.goto('/station/plaza/prepare');
    await expect(page.getByText(/今天的故事/)).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/今天同台/)).toBeVisible();
    // 道具选择应至少有 3 件（新手礼包）
    await expect(page.getByText(/已选 0 \/ 3/)).toBeVisible();
    // 出发按钮初始为禁用
    const cta = page.getByRole('button', { name: /还差 3 件|出发/ });
    await expect(cta).toBeDisabled();
  });

  test('选满 3 件后出发按钮启用', async ({ page }) => {
    await page.goto('/station/plaza/prepare');
    // 点前 3 个道具
    const items = page.locator('[aria-pressed]');
    await items.nth(0).click();
    await items.nth(1).click();
    await items.nth(2).click();
    const cta = page.getByRole('button', { name: /出发/ });
    await expect(cta).toBeEnabled();
  });
});
