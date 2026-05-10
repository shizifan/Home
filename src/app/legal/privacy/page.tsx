/**
 * 隐私政策 — V1.0 临时上线最简版（PRD §27.7）
 * 正式上线前需替换为完整法律级版本。
 */

import Link from 'next/link';
import { MobileShell } from '@/components/ui/MobileShell';

export const metadata = {
  title: 'Home · 隐私说明',
};

export default function PrivacyPage() {
  return (
    <MobileShell>
      <header className="px-5 pt-3 pb-2 border-b border-[rgba(95,94,90,0.12)]">
        <Link href="/" className="font-title text-small text-ink-3 no-underline">
          ← 回首页
        </Link>
      </header>

      <article className="flex-1 overflow-y-auto px-6 py-6 prose-sm">
        <h1 className="font-title text-h2 text-ink-1 mb-4">隐私说明</h1>
        <p className="font-title text-mini text-ink-3 mb-4">
          本说明适用于 Home V1.0 体验阶段。最后更新：2026-05-06。
        </p>

        <h2 className="font-title text-h3 text-ink-1 mt-5 mb-2">我们会保存的</h2>
        <ul className="font-title text-body text-ink-2 leading-[1.8] list-disc pl-5">
          <li>你的昵称（仅用于在 Home 里识别你）</li>
          <li>你说过的话和写过的文字</li>
          <li>你录的语音文件（保留 30 天后自动删除）</li>
          <li>AI 为你生成的描述卡片图片</li>
          <li>你和伙伴的对话历史</li>
          <li>你在记忆面板里做过的整理动作</li>
          <li>你玩过的剧本和获得的道具</li>
        </ul>

        <h2 className="font-title text-h3 text-ink-1 mt-5 mb-2">我们不会做的</h2>
        <ul className="font-title text-body text-ink-2 leading-[1.8] list-disc pl-5">
          <li>不收集你的真实姓名、家庭住址、电话号码</li>
          <li>不向第三方出售你的数据</li>
          <li>不用你的数据训练大模型</li>
          <li>不在你不知情时给你推送广告</li>
        </ul>

        <h2 className="font-title text-h3 text-ink-1 mt-5 mb-2">我们要交给谁</h2>
        <p className="font-title text-body text-ink-2 leading-[1.8]">
          为了让 AI 伙伴能听懂你、画卡片、记住你说过的事，你的输入会发送给我们使用的
          AI 服务（DeepSeek / DashScope / MiniMax 等，均位于中国境内）。
          每一次只发送当次对话需要的内容，不会发送你的所有历史。
        </p>

        <h2 className="font-title text-h3 text-ink-1 mt-5 mb-2">家长可见</h2>
        <p className="font-title text-body text-ink-2 leading-[1.8]">
          你写的内容、伙伴的回应、记忆面板都可以在"家长中心"里全部查看。
          访问家长中心需要回答一个简单的算术题（防止小朋友误操作）。
        </p>

        <h2 className="font-title text-h3 text-ink-1 mt-5 mb-2">想删除数据</h2>
        <p className="font-title text-body text-ink-2 leading-[1.8]">
          家长中心 →"清空并重新开始"会立即删除你这边的所有内容。
          如果想彻底从我们的服务器抹掉，请联系管理员（联系方式见下文）。
        </p>

        <h2 className="font-title text-h3 text-ink-1 mt-5 mb-2">联系我们</h2>
        <p className="font-title text-body text-ink-2 leading-[1.8]">
          有问题或想反馈，请联系：home-feedback@example.com（V1.0 体验邮箱）
        </p>

        <p className="font-title text-mini text-ink-3 mt-8 mb-4">
          本说明仅适用于 V1.0 体验阶段。正式上线前会替换为完整法律级隐私政策。
        </p>
      </article>
    </MobileShell>
  );
}
