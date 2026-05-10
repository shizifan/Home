/**
 * 使用条款（ToS）— V1.0 临时上线最简版（PRD §27.7）
 */

import Link from 'next/link';
import { MobileShell } from '@/components/ui/MobileShell';

export const metadata = {
  title: 'Home · 使用条款',
};

export default function ToSPage() {
  return (
    <MobileShell>
      <header className="px-5 pt-3 pb-2 border-b border-[rgba(95,94,90,0.12)]">
        <Link href="/" className="font-title text-small text-ink-3 no-underline">
          ← 回首页
        </Link>
      </header>

      <article className="flex-1 overflow-y-auto px-6 py-6 prose-sm">
        <h1 className="font-title text-h2 text-ink-1 mb-4">使用条款</h1>
        <p className="font-title text-mini text-ink-3 mb-4">
          V1.0 体验阶段。最后更新：2026-05-06。
        </p>

        <h2 className="font-title text-h3 text-ink-1 mt-5 mb-2">这是个体验版</h2>
        <p className="font-title text-body text-ink-2 leading-[1.8]">
          Home 当前是受邀体验版。我们随时可能为了优化体验调整功能、文案、视觉。
          某些功能可能短暂不可用，我们会尽快修复。
        </p>

        <h2 className="font-title text-h3 text-ink-1 mt-5 mb-2">建议年龄</h2>
        <p className="font-title text-body text-ink-2 leading-[1.8]">
          建议在家长陪伴下使用，适合 8–12 岁孩子。
          首次使用建议家长在场协助选择伙伴、起名、了解隐私设定。
        </p>

        <h2 className="font-title text-h3 text-ink-1 mt-5 mb-2">不能做什么</h2>
        <ul className="font-title text-body text-ink-2 leading-[1.8] list-disc pl-5">
          <li>不要冒用他人昵称</li>
          <li>不要尝试通过技术手段访问别人的数据（这是违法行为）</li>
          <li>不要在输入里包含真实身份信息（家庭住址 / 电话 / 学校具体班级等）</li>
          <li>不要分享别人在 Home 里说过的话</li>
        </ul>

        <h2 className="font-title text-h3 text-ink-1 mt-5 mb-2">关于 AI 输出</h2>
        <p className="font-title text-body text-ink-2 leading-[1.8]">
          伙伴说的话、记忆面板里的"理解"、生成的纸片插画都是 AI 生成的内容，可能会有偏差或错误。
          这本身就是 Home 想让孩子理解的事——AI 不是无所不能的，它的认知由数据塑造。
        </p>

        <h2 className="font-title text-h3 text-ink-1 mt-5 mb-2">免责</h2>
        <p className="font-title text-body text-ink-2 leading-[1.8]">
          Home 是一个教育性质的体验产品。它不能代替家长教育、不能代替老师、不能代替专业的心理或医疗建议。
          孩子如果在使用过程中表达出强烈的情绪或现实困扰，请及时给予真人陪伴和必要的专业支持。
        </p>

        <p className="font-title text-mini text-ink-3 mt-8 mb-4">
          本条款仅适用于 V1.0 体验阶段。正式上线前会替换为完整法律级版本。
        </p>
      </article>
    </MobileShell>
  );
}
