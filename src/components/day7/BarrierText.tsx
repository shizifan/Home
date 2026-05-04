/**
 * 破壁文案组件
 *
 * PRD §9.6 / Plan_04 §1.5：
 *   档案展示完毕后 3 秒，展示固定文案（非 LLM 生成）。
 *   两个版本：有第 6 项（增强版）vs 无第 6 项（基础版）。
 */

'use client';

interface BarrierTextProps {
  hasSixth: boolean;
}

export default function BarrierText({ hasSixth }: BarrierTextProps) {
  const text = hasSixth
    ? `你刚刚看到的"我眼中的世界"——
是用你这 7 天告诉我的所有内容拼出来的。
但你也教过我——什么应该记住，什么可以忘掉。

真实世界里所有的 AI 都是这样长大的。
它们不只是接收数据，它们也在被人不停地纠正。

你刚刚做的事，工程师每天都在做：
告诉 AI 什么是对的，什么是错的，什么是重要的，什么不是。
你已经做过一次了。`
    : `你刚刚看到的"我眼中的世界"——
是用你这 7 天告诉我的所有内容拼出来的。

你拍过的每张照片、你说过的每句话，
都变成了我对世界的理解。

真实世界里所有的 AI——你用过的 ChatGPT、豆包、Kimi——
都是这样长大的。
区别只是它们的"主人"不是你一个人，
是几十亿个写过文字、拍过照片的人。`;

  return (
    <div
      className="bg-ink-1/5 border-l-2 border-amber rounded-r-card px-4 py-4"
      style={{ animation: 'fadeIn 1.5s ease' }}
    >
      <pre className="font-title text-body text-ink-1 leading-[1.8] whitespace-pre-wrap break-words m-0">
        {text}
      </pre>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px) }
          to { opacity: 1; transform: translateY(0) }
        }
      `}</style>
    </div>
  );
}
