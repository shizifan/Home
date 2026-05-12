import { test, expect, type Page } from '@playwright/test';
import { SAMPLE_TEXTS, resetDb, getState, skipTodayTask } from './_helpers/main-loop';

/**
 * 主干 happy-path：启动页 → /intro → 选小青龙 → Day 1→7 → /day7/worldview。
 *
 * 模式（见 spec/E2E_Main_Loop_Plan_V0.1.md）:
 *   - 文本 LLM 走真实 DeepSeek（需 .env.local 里有 DEEPSEEK_API_KEY）
 *   - 图像 / 风格审核 / 内容审核 走 mock（TEST_LLM_MODE=mock，playwright.config webServer 已默认带上）
 *   - ASR 不触发（全程用文字输入）
 *
 * 全 spec 是一条贯穿用例，整体超时 15 分钟。
 */

test.describe('main_loop · Day 1→7 主干 happy-path（真实 LLM）', () => {
  test.setTimeout(15 * 60 * 1000);

  test('从启动页一路点到 /day7/worldview，最终 graduated=1', async ({ page }) => {
    // Next 15 dev 模式右下角常驻 Dev Tools 浮标（<nextjs-portal>），
    // z-index 高，会拦截底部 NavBar 的点击。注入 CSS 让它不参与点击命中。
    // 不改 next.config / 应用代码——这是 test-only 的兜底。
    await page.addInitScript(() => {
      const css = 'nextjs-portal, nextjs-portal * { pointer-events: none !important; }';
      const inject = () => {
        const s = document.createElement('style');
        s.textContent = css;
        document.head.appendChild(s);
      };
      if (document.head) inject();
      else document.addEventListener('DOMContentLoaded', inject);
    });

    // P6 middleware 要求 home_uid cookie；无 cookie 时所有非 PUBLIC 路径会被
    // redirect 到 /start。所以 spec 第一步必须先走注册流程拿到 cookie。
    const request = page.context().request;

    await test.step('0a. API 注册昵称 → 拿 home_uid cookie（page.context 共享）', async () => {
      // 不走 /start UI：前端有 fingerprint 异步 + setTimeout 跳转，时机难等；
      // 主干 spec 验的是 Day 1→7，注册流程不在范围内。
      const r = await request.post('/api/auth/start', {
        data: { nickname: 'e2e-main-loop' },
      });
      if (!r.ok()) throw new Error(`auth/start failed: ${r.status()} ${await r.text()}`);
    });

    await test.step('0b. reset 当前用户旧 companion', async () => {
      await resetDb(request);
    });

    await test.step('1. / 点开始 → /intro', async () => {
      await page.goto('/');
      // 启动页大标题严格匹配 'Home'（exact），避免和 /start 的"欢迎来到 Home"撞
      await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible({
        timeout: 10_000,
      });
      await page.getByRole('link', { name: /开始/ }).click();
      await page.waitForURL('**/intro');
    });

    await test.step('2. /intro → /onboarding/choose（跳过引导）', async () => {
      await page.getByRole('button', { name: '跳过引导' }).click();
      await page.waitForURL('**/onboarding/choose');
    });

    await test.step('3. 选小青龙 → /onboarding/name', async () => {
      // preset 卡片是 <button>，内部 span "小青龙"
      await page.getByRole('button', { name: /小青龙/ }).first().click();
      await page.getByRole('button', { name: /选 小青龙 一起开始/ }).click();
      // 确认弹层
      await page.getByRole('button', { name: '就是它' }).click();
      await page.waitForURL('**/onboarding/name**');
    });

    await test.step('4. 命名页 → /home（沿用 preset 默认名）', async () => {
      // 默认按钮文案 "就叫小青龙"（name 留空时）
      await page.getByRole('button', { name: /就叫小青龙|这就是它的名字/ }).click();
      await page.waitForURL('**/home');
      // 顶部 HUD 出现
      await expect(page.locator('text=DAY').first()).toBeVisible({ timeout: 10_000 });
    });

    // ─── Day 1-3 describe ───
    for (const day of [1, 2, 3] as const) {
      await runDescribeDay(page, day);
      await advanceToDay(page, day + 1);
    }

    // ─── Day 4 text ───
    await runTextDay(page);
    await advanceToDay(page, 5);

    // ─── Day 5 choice（两题，Q2 由 Q1 答案动态生成）───
    await runChoiceDay(page);
    await advanceToDay(page, 6);

    // ─── Day 6 memory_review（API skip 兜底，见方案 §6）───
    await test.step('Day 6 memory_review (API skip 兜底)', async () => {
      await skipTodayTask(request);
      await page.reload();
      // 完成后 DayDoneBar 应该出现
      await expect(page.locator('text=今天的事做完啦').first()).toBeVisible({ timeout: 10_000 });
    });
    await advanceToDay(page, 7);

    // ─── Day 7 → /day7/worldview ───
    await test.step('Day 7 → 通过任务浮层进 /day7/worldview → 看到「生成毕业卡 →」', async () => {
      // Day 7 任务未完成时,home 顶部「看 X 眼中的世界」按钮不出现（canViewWorldview 需要
      // todayDone=true）。走 TaskOverlay 的 isDay7 分支才是 happy-path。
      await openTaskOverlay(page);
      const cta = page.getByRole('button', { name: /看看它眼中的世界|眼中的世界/ });
      await cta.waitFor({ state: 'visible', timeout: 10_000 });
      await cta.click({ force: true });
      await page.waitForURL('**/day7/worldview');

      // 等 LLM 拉回 worldview。loading 文案先出现，随后档案卡标题"它眼中的世界"
      await expect(page.getByText('它眼中的世界')).toBeVisible({ timeout: 90_000 });

      // 全部 reveal 走完后才出现"生成毕业卡 →" — 给最坏 2 min（含动画）
      await expect(page.getByRole('button', { name: /生成毕业卡/ })).toBeVisible({
        timeout: 120_000,
      });
    });

    // ─── DB 验收 ───
    await test.step('验收 current_day=7 / graduated=true', async () => {
      const s = await getState(request);
      expect(s.companion?.current_day).toBe(7);
      expect(s.companion?.graduated).toBe(true);
    });

    // ─── 回 home 出现"出门探索" ───
    await test.step('回 /home 看到 出门探索 入口', async () => {
      await page.goto('/home');
      await expect(page.getByText(/出门探索/)).toBeVisible({ timeout: 10_000 });
    });
  });
});

// ───────── helpers（局部，依赖 page）─────────

async function openTaskOverlay(page: Page): Promise<void> {
  const btn = page.getByRole('button', { name: /今日任务/ });
  await expect(btn).toBeVisible({ timeout: 10_000 });
  // Day 2 起 BottomNav re-render 频繁 → playwright stability check 反复失败,
  // 这里用 force click 绕过；overlay 是否真的开了，由调用方等待下游元素验证。
  await btn.click({ force: true });
}

async function runDescribeDay(page: Page, day: 1 | 2 | 3): Promise<void> {
  await test.step(`Day ${day} describe (UI 全链路)`, async () => {
    await openTaskOverlay(page);

    // overlay 主按钮 "用打字"
    await page.getByRole('button', { name: '用打字' }).click();
    await page.waitForURL('**/describe/text**');

    // 输入文字 → 生成卡片
    await page.getByPlaceholder(/说点什么吧/).fill(SAMPLE_TEXTS[day - 1]);
    await page.getByRole('button', { name: /生成卡片/ }).click();

    // generating → confirm-card（LLM 文本 + mock 图像）
    await page.waitForURL('**/describe/confirm-card**', { timeout: 90_000 });

    // 双图模式下要先点一张才能确认（mock 下 DashScope + MiniMax 都返回）
    const pickDashscope = page.getByTestId('card-pick-dashscope');
    if (await pickDashscope.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await pickDashscope.click();
    }

    await page.getByRole('button', { name: '就是这样' }).click();
    // 入墙动画后回 /home
    await page.waitForURL('**/home', { timeout: 30_000 });
    await expect(page.locator('text=今天的事做完啦').first()).toBeVisible({ timeout: 15_000 });
  });
}

async function runTextDay(page: Page): Promise<void> {
  await test.step('Day 4 text (overlay 内提交)', async () => {
    await openTaskOverlay(page);
    const ta = page.locator('textarea').first();
    await ta.waitFor({ state: 'visible', timeout: 10_000 });
    await ta.fill(SAMPLE_TEXTS[3]);
    await page.getByRole('button', { name: /完成/ }).click();
    // submit → ReplyState 出现 "好的" 按钮（home 的 state 此时还没刷新,
    // 必须点 "好的" 触发 onClose → home refresh → DayDoneBar 显示）
    const ack = page.getByRole('button', { name: '好的' });
    await ack.waitFor({ state: 'visible', timeout: 60_000 });
    await ack.click({ force: true });
    await expect(page.locator('text=今天的事做完啦').first()).toBeVisible({ timeout: 10_000 });
  });
}

async function runChoiceDay(page: Page): Promise<void> {
  await test.step('Day 5 choice (两题)', async () => {
    await openTaskOverlay(page);

    // Q1: LLM 出题，给 60s
    await expect(page.getByText('第 1 / 2 个问题')).toBeVisible({ timeout: 60_000 });
    await pickFirstChoiceOption(page);

    // Q2: 基于 Q1 答案再 LLM 一次
    await expect(page.getByText('第 2 / 2 个问题')).toBeVisible({ timeout: 90_000 });
    await pickFirstChoiceOption(page);

    // ReplyState 出现 → 点 "好的" 触发 onClose → home refresh
    const ack = page.getByRole('button', { name: '好的' });
    await ack.waitFor({ state: 'visible', timeout: 60_000 });
    await ack.click({ force: true });
    await expect(page.locator('text=今天的事做完啦').first()).toBeVisible({ timeout: 10_000 });
  });
}

async function pickFirstChoiceOption(page: Page): Promise<void> {
  // ChoiceFlow 的选项是 `button.bg-white.border-[1.2px].border-ink-2.rounded-card`
  // 用 hasText + 非空 + 排除"跳过这个问题"
  const opts = page
    .locator('button.bg-white.rounded-card')
    .filter({ hasText: /\S/ })
    .filter({ hasNotText: '跳过这个问题' });
  await opts.first().click();
}

async function advanceToDay(page: Page, targetDay: number): Promise<void> {
  await test.step(`推进 → Day ${targetDay}`, async () => {
    const btn = page.getByRole('button', { name: new RegExp(`去 Day ${targetDay}`) });
    await btn.waitFor({ state: 'visible', timeout: 15_000 });
    await btn.click();
    // advance 内部会调 runOpeningLine (LLM)，需要 ~10s 才返回 → DayDoneBar 上的按钮
    // 此时显示"正在迎接…" 等 button 完全消失。给 30s 容差。
    await expect(btn).toBeHidden({ timeout: 30_000 });
    await expect(page.getByText(new RegExp(`DAY ${targetDay} / 7`))).toBeVisible({
      timeout: 15_000,
    });
  });
}
