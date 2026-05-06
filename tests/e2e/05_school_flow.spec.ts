import { test, expect } from '@playwright/test';

/**
 * P3 学校流程节点测试
 *
 * 策略与 visit 一致：只验流程节点，不触发真实 LLM。
 * happy-path（出题 → 课堂回放 → "小青龙不会答"分支）需 graduated + visit_count>=2，
 * 标记 skipped 待手动启用。
 */

test.describe('school · 路由 + UI 节点', () => {
  test('准备页：4 个目的可见，选 ask_my_question 的 CTA 是"想想要问什么"', async ({
    page,
  }) => {
    await page.goto('/station/school/prepare');

    await expect(page.getByText('去上一堂课')).toBeVisible();
    await expect(page.getByText('去问一个你想问的问题')).toBeVisible();
    await expect(page.getByText('去看看其他人是什么样的')).toBeVisible();
    await expect(page.getByText('去学一个你不知道的东西')).toBeVisible();

    // 默认选第一个 → 出发按钮
    const cta = page.getByRole('button', { name: /出发|想想要问什么/ });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveText(/出发/);

    // 切到 ask_my_question → CTA 文案变
    await page.getByText('去问一个你想问的问题').click();
    await expect(cta).toHaveText(/想想要问什么/);
  });

  test('出题页：空文本时按钮禁用，填入后启用', async ({ page }) => {
    await page.goto('/station/school/question');

    const submit = page.getByRole('button', { name: /出发/ });
    await expect(submit).toBeDisabled();

    await page
      .getByPlaceholder(/比如：什么是大海/)
      .fill('为什么会下雨？');
    await expect(submit).toBeEnabled();
  });
});

/**
 * happy-path：需要 graduated + visit_count>=2 + 真实/mock LLM
 * 启用：
 *   1. 跑 seed-graduate 让 companion graduated
 *   2. 至少 2 次成功 /api/station/depart trip_type=visit
 *   3. 把 .skip 改成 .only / 删掉
 */
test.describe.skip('school · happy path（需要 visit_count >= 2 + LLM）', () => {
  test('attend_class 路径：出发 → traveling → report → 答案逐条出现', async ({
    page,
  }) => {
    await page.goto('/station/school/prepare');
    await page.getByRole('button', { name: /出发/ }).click();
    await page.waitForURL('**/traveling**');
    // 等到 returned → 自动跳 report
    await page.waitForURL('**/report/school**', { timeout: 30_000 });
    await expect(page.getByText('今天的问题')).toBeVisible();
    // 至少 3 条答案
    await page.waitForTimeout(3_000); // 等逐条出现动画
    await expect(page.locator('text=/.*说：/')).toHaveCount(4, { timeout: 8_000 });
  });

  test('ask_my_question 路径：自己出题 → 回放含 visitor 答案', async ({ page }) => {
    await page.goto('/station/school/prepare');
    await page.getByText('去问一个你想问的问题').click();
    await page.getByRole('button', { name: /想想要问什么/ }).click();
    await page.waitForURL('**/school/question');
    await page
      .getByPlaceholder(/比如：什么是大海/)
      .fill('什么是雪？');
    await page.getByRole('button', { name: /出发/ }).click();
    await page.waitForURL('**/report/school**', { timeout: 30_000 });
    await expect(page.getByText('什么是雪？')).toBeVisible();
  });
});
