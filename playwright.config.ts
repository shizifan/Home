import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright 配置 — Home E2E
 *
 * 运行：
 *   npm run test:e2e:install      # 首次：装 chromium 浏览器
 *   npm run test:e2e              # 跑全部 spec
 *   npm run test:e2e -- -g smoke  # 只跑名字含 smoke 的
 *
 * 测试策略约定：不做视觉回归，仅验证流程节点完整性。
 *
 * Spec 命名规范（按 PRD 阶段）：
 *   tests/e2e/00_smoke.spec.ts          — 启动页能加载并跳到引导
 *   tests/e2e/01_main_loop.spec.ts      — Day 1→7 happy path（P1）
 *   tests/e2e/02_skip_paths.spec.ts     — 跳过 Day 5 / Day 6（P1）
 *   tests/e2e/03_revision.spec.ts       — 卡片"不太对"3 次降级（P1）
 *   tests/e2e/04_visit_flow.spec.ts     — 朋友家拜访（P2）
 *   tests/e2e/05_school_flow.spec.ts    — 学校（P3）
 *   tests/e2e/06_plaza_prepare.spec.ts  — 广场准备（P4）
 *   tests/e2e/07_plaza_full.spec.ts     — 广场剧本通关（P5）
 */

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3001);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: 'tests/e2e',
  // 同步执行：避免多个 spec 抢同一个单用户的数据
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 390, height: 844 }, // iPhone 14 vertical
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
  ],

  // 自启 dev server。LLM 走真实接口（DeepSeek），但图像生成 / ASR / 风格审核都走 mock。
  // CI 上若没有 DEEPSEEK_API_KEY，建议手动起 server 并 export PLAYWRIGHT_BASE_URL。
  webServer: process.env.PLAYWRIGHT_NO_WEBSERVER
    ? undefined
    : {
        // 用 turbopack 替代 webpack：Node ≥25 上 next dev (webpack 持久缓存)
        // 会触发 V8 abort "Lazy deopt after a fast API call"，导致 dev overlay
        // 罩住整页拦截点击。turbopack 不走 webpack serializer，避开该崩溃。
        command: `TEST_LLM_MODE=mock next dev --turbopack -p ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: 'ignore',
        stderr: 'pipe',
      },
});
