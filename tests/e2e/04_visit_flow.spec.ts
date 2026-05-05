import { test, expect } from '@playwright/test';

/**
 * P2 朋友家拜访流程节点测试
 *
 * 策略：只验流程节点完整性（按用户偏好），不触发真实 LLM 出行。
 * 完整 happy-path（出发 → 等待 → 报告 → 二手知识写入记忆面板）需要：
 *   - DB 内有已毕业的 companion（worldview 已生成）
 *   - 真实 LLM key 或 mock 适配
 * 这部分用 `test.describe.skip` 标注；用户跑 seed-graduate 脚本后可手动启用。
 */

test.describe('visit · 路由 + UI 节点', () => {
  test('未毕业时 /station 显示回小家提示', async ({ page }) => {
    // 干净状态：进入 /home 触发引导
    await page.goto('/');
    // 直接访问 /station —— 没有 companion / 未毕业 时显示引导回家
    await page.goto('/station');
    // 加载完成后必出现下面之一：
    //   "还没有伙伴入住" / "它还没住满 7 天" / "回小家"
    const possible = [
      page.getByText('还没有伙伴入住'),
      page.getByText('还没住满 7 天'),
      page.getByText('回小家'),
    ];
    let visible = false;
    for (const loc of possible) {
      if (await loc.isVisible({ timeout: 5_000 }).catch(() => false)) {
        visible = true;
        break;
      }
    }
    expect(visible).toBeTruthy();
  });

  test('准备页：4 个目的选项可见，选 ask_question 后出现"问什么"输入框', async ({ page }) => {
    await page.goto('/station/visit/prepare');

    // 4 个目的标题都应可见
    await expect(page.getByText('去认识一个新朋友')).toBeVisible();
    await expect(page.getByText('去看看朋友家是什么样的')).toBeVisible();
    await expect(page.getByText('去和朋友说说你自己')).toBeVisible();
    await expect(page.getByText('去问朋友一件你好奇的事')).toBeVisible();

    // 默认选第一个：出发按钮可点（可点性测试不依赖 API 结果）
    const departBtn = page.getByRole('button', { name: /出发/ });
    await expect(departBtn).toBeEnabled();

    // 切到 ask_question 但不填问题 → 出发按钮应该禁用
    await page.getByText('去问朋友一件你好奇的事').click();
    await expect(page.getByPlaceholder(/比如：什么是大海/)).toBeVisible();
    await expect(departBtn).toBeDisabled();

    // 填问题后又可点
    await page.getByPlaceholder(/比如：什么是大海/).fill('什么是雪？');
    await expect(departBtn).toBeEnabled();
  });

  test('traveling 页缺 trip_id 时显示出错', async ({ page }) => {
    await page.goto('/station/traveling');
    await expect(page.getByText('出了点问题')).toBeVisible({ timeout: 10_000 });
  });
});

/**
 * 完整 happy-path（需要已毕业 companion + 真实/mock LLM）
 *
 * 启用方式：先 npm 跑 `TEST_LLM_MODE=mock npm run dev` + `npx tsx scripts/seed-graduate.ts`
 * 让 DB 中有一只 graduated companion，然后把 `.skip` 改成 `.only` 或删掉运行。
 */
test.describe.skip('visit · happy path（需要 graduated 状态）', () => {
  test('完成 ask_question 流程并把二手知识带回记忆面板', async ({ page }) => {
    await page.goto('/station');
    await expect(page.getByText('朋友家')).toBeVisible();
    await page.getByText('朋友家').click();

    await page.waitForURL('**/visit/prepare');
    await page.getByText('去问朋友一件你好奇的事').click();
    await page.getByPlaceholder(/比如：什么是大海/).fill('什么是雪？');
    await page.getByRole('button', { name: /出发/ }).click();

    // traveling 页 → 等待 returned → 自动跳 report
    await page.waitForURL('**/report/visit**', { timeout: 30_000 });

    await expect(page.getByText('目的')).toBeVisible();
    // 朋友家可能给出 new_word；若按钮存在就点
    const importBtn = page.getByRole('button', { name: /在记忆面板里看/ });
    if (await importBtn.isVisible().catch(() => false)) {
      await importBtn.click();
      await page.waitForURL('**/memory');
      // 记忆面板里能看到二手知识标识（"听 X 说的"）
      const badge = page.getByText(/听 .+ 说的/);
      await expect(badge).toBeVisible({ timeout: 5_000 });
    }
  });
});
