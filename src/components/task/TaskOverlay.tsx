/**
 * 任务卡浮层（PRD §10.3 + V0.6.1 §4）
 *
 * V0.6.1 改造后的交互：
 *   - describe：跳转 /describe/voice 或 /describe/text（按 inputPreference）
 *   - text：浮层内文字输入（仅 Day 4 纯文字任务）
 *   - choice：Day 5 选择题
 *   - memory_review：跳转 /memory
 *
 * 旧的 photo / photo_text 分支已删除（V0.5 拍照流程废弃）。
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import {
  getDay5Questions,
  skipTask,
  submitText,
  type Day5Question,
} from '@/lib/api/client';
import { useCompanionStore } from '@/stores/companionStore';
import type { TaskDef } from '@/types';

interface Props {
  task: TaskDef;
  companionId: string;
  companionName: string;
  onClose: () => void;
}

type Stage = 'input' | 'submitting' | 'reply';

export function TaskOverlay({ task, companionId, companionName, onClose }: Props) {
  const router = useRouter();
  const { hasSkippedOnce, markSkippedOnce, inputPreference } = useCompanionStore();
  const [stage, setStage] = useState<Stage>('input');
  const [text, setText] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skipWarning, setSkipWarning] = useState<'first' | 'day5' | null>(null);

  const isText = task.kind === 'text';
  const isChoice = task.kind === 'choice';
  const isDescribe = task.kind === 'describe';

  // memory_review 直接跳记忆面板
  if (task.kind === 'memory_review') {
    return (
      <div className="absolute inset-0 z-40">
        <div className="absolute inset-0 bg-black/35" onClick={onClose} aria-hidden />
        <div className="absolute left-0 right-0 bottom-0 bg-bg-base rounded-t-sheet shadow-sheet px-6 pt-3 pb-7">
          <div className="flex justify-center mb-1.5">
            <button onClick={onClose} className="bg-transparent border-0 p-2 cursor-pointer">
              <span className="block w-11 h-[5px] bg-[rgba(95,94,90,0.35)] rounded-full" />
            </button>
          </div>
          <h2 className="font-title text-h2 text-ink-1 mb-2">{task.title}</h2>
          <p className="font-title text-body text-ink-2 mb-5">{task.description}</p>
          <Button size="lg" fullWidth onClick={() => router.push('/memory')}>
            进入它的脑袋 →
          </Button>
        </div>
      </div>
    );
  }

  // 跳过流程（PRD §13.2）— 提前定义，因为 describe 分支也引用
  const onSkipClicked = () => {
    if (stage !== 'input') return;
    if (task.day === 5) {
      setSkipWarning('day5');
      return;
    }
    if (!hasSkippedOnce) {
      setSkipWarning('first');
      return;
    }
    confirmSkip();
  };

  const confirmSkip = async () => {
    setSkipWarning(null);
    markSkippedOnce();
    setStage('submitting');
    try {
      const res = await skipTask({ companion_id: companionId, task_id: task.id });
      setReply(res.companion_response);
      setStage('reply');
    } catch {
      onClose();
    }
  };

  // describe 任务 — 跳转到独立流程（V0.6.1 §4.5）
  if (isDescribe) {
    // 离开 home 前先关掉浮层，否则用户回 home 时浮层还在
    const goVoice = () => {
      onClose();
      router.push(`/describe/voice?task_id=${task.id}`);
    };
    const goText = () => {
      onClose();
      router.push(`/describe/text?task_id=${task.id}`);
    };
    const primary = inputPreference === 'text' ? goText : goVoice;
    const secondary = inputPreference === 'text' ? goVoice : goText;
    const primaryLabel = inputPreference === 'text' ? '用打字' : '🎤 说一说';
    const secondaryLabel = inputPreference === 'text' ? '🎤 改用说话' : '⌨️ 用打字代替';

    return (
      <div className="absolute inset-0 z-40">
        <div className="absolute inset-0 bg-black/35" onClick={onClose} aria-hidden />
        <div className="absolute left-0 right-0 bottom-0 bg-bg-base rounded-t-sheet shadow-sheet px-6 pt-3 pb-7">
          <div className="flex justify-center mb-1.5">
            <button onClick={onClose} className="bg-transparent border-0 p-2 cursor-pointer">
              <span className="block w-11 h-[5px] bg-[rgba(95,94,90,0.35)] rounded-full" />
            </button>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <TaskIcon kind={task.kind} />
            <div>
              <p className="font-num text-mini text-ink-3 tracking-[0.16em]">
                DAY {task.day} · {DAY_THEME[task.day - 1]}
              </p>
              <h2 className="font-title text-h2 text-ink-1 mt-0.5">{task.title}</h2>
            </div>
          </div>
          <div className="bg-white border-[1.2px] border-ink-2 rounded-[12px] px-3.5 py-3 mb-5">
            <p className="font-title text-mini text-ink-3 mb-1">{companionName}问你：</p>
            <p className="font-title text-h3 text-ink-1 leading-[1.5]">「{task.description}」</p>
          </div>
          <Button size="lg" fullWidth onClick={primary}>
            {primaryLabel}
          </Button>
          <div className="flex gap-3 mt-3">
            <Button variant="ghost" fullWidth onClick={secondary}>
              {secondaryLabel}
            </Button>
            <Button variant="ghost" fullWidth onClick={onSkipClicked}>
              跳过
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const canSubmit = isText ? text.trim().length > 0 : true;

  const onSubmit = async () => {
    if (stage !== 'input' || !canSubmit) return;
    setStage('submitting');
    setError(null);
    try {
      const res = await submitText({
        companion_id: companionId,
        task_id: task.id,
        user_text: text.trim(),
      });
      setReply(res.companion_response);
      setStage('reply');
    } catch (e) {
      setError((e as Error)?.message ?? '出了点问题，再试一次');
      setStage('input');
    }
  };

  return (
    <div className="absolute inset-0 z-40">
      <div className="absolute inset-0 bg-black/35" onClick={stage === 'input' ? onClose : undefined} aria-hidden />

      <div className="absolute left-0 right-0 bottom-0 bg-bg-base rounded-t-sheet shadow-sheet px-6 pt-3 pb-7 max-h-[88%] overflow-y-auto">
        <div className="flex justify-center mb-1.5">
          <button
            onClick={onClose}
            className="bg-transparent border-0 p-2 cursor-pointer"
            aria-label="关闭"
            disabled={stage === 'submitting'}
          >
            <span className="block w-11 h-[5px] bg-[rgba(95,94,90,0.35)] rounded-full" />
          </button>
        </div>

        <div className="flex items-center gap-3 mb-3">
          <TaskIcon kind={task.kind} />
          <div>
            <p className="font-num text-mini text-ink-3 tracking-[0.16em]">
              DAY {task.day} · {DAY_THEME[task.day - 1]}
            </p>
            <h2 className="font-title text-h2 text-ink-1 mt-0.5">{task.title}</h2>
          </div>
        </div>

        <div className="bg-white border-[1.2px] border-ink-2 rounded-[12px] px-3.5 py-3 mb-4">
          <p className="font-title text-mini text-ink-3 mb-1">{companionName}问你：</p>
          <p className="font-title text-h3 text-ink-1 leading-[1.5]">「{task.description}」</p>
        </div>

        {stage === 'input' && isText && (
          <>
            <TextZone
              value={text}
              onChange={setText}
              placeholder={task.inputPlaceholder ?? '说点什么吧……'}
              charLimit={task.charLimit ?? 300}
            />

            {error && <p className="font-title text-small text-[#E24B4A] mt-2">{error}</p>}

            <div className="flex gap-3 mt-5">
              <Button variant="ghost" fullWidth onClick={onSkipClicked}>
                跳过
              </Button>
              <Button fullWidth onClick={onSubmit} disabled={!canSubmit}>
                完成 ▷
              </Button>
            </div>
          </>
        )}

        {stage === 'input' && isChoice && (
          <ChoiceFlow
            companionId={companionId}
            companionName={companionName}
            taskId={task.id}
            onError={(msg) => setError(msg)}
            onAllDone={(replies) => {
              // 把两次回应拼成一段，stage → reply
              setReply(replies.join('\n\n'));
              setStage('reply');
            }}
            onSkipClicked={onSkipClicked}
          />
        )}

        {stage === 'submitting' && <ThinkingState companionName={companionName} />}

        {stage === 'reply' && reply && (
          <ReplyState reply={reply} companionName={companionName} onDone={onClose} />
        )}
      </div>

      {skipWarning === 'first' && (
        <SkipWarningFirst
          onAck={confirmSkip}
        />
      )}
      {skipWarning === 'day5' && (
        <SkipWarningDay5
          onCancel={() => setSkipWarning(null)}
          onConfirm={confirmSkip}
        />
      )}
    </div>
  );
}

function SkipWarningFirst({ onAck }: { onAck: () => void }) {
  // 3 秒自动 ack（PRD §13.2 "3 秒后自动消失"）
  useEffect(() => {
    const t = setTimeout(onAck, 3500);
    return () => clearTimeout(t);
  }, [onAck]);

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center px-7">
      <div className="bg-white rounded-card border-[1.2px] border-ink-2 px-5 py-5 max-w-[320px] shadow-paper">
        <p className="font-title text-h3 text-ink-1 mb-2">跳过没问题。</p>
        <p className="font-title text-body text-ink-2 leading-relaxed mb-1">
          不过这一天的事它就听不到了。
        </p>
        <p className="font-title text-body text-ink-2 leading-relaxed mb-4">
          第 7 天的它，可能会少一点对你的了解。
        </p>
        <Button fullWidth onClick={onAck}>
          我知道了
        </Button>
      </div>
    </div>
  );
}

function SkipWarningDay5({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center px-7">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} aria-hidden />
      <div className="relative bg-white rounded-card border-[1.2px] border-ink-2 px-5 py-5 max-w-[320px] shadow-paper">
        <p className="font-title text-h3 text-ink-1 mb-2">Day 5 是一个特别的日子</p>
        <p className="font-title text-body text-ink-2 leading-relaxed mb-1">
          它会问你两个有点意思的问题。
        </p>
        <p className="font-title text-body text-ink-2 leading-relaxed mb-4">
          跳过的话，你可能会错过一些东西。还要继续跳过吗？
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" fullWidth onClick={onCancel}>
            我留下来听听
          </Button>
          <Button fullWidth onClick={onConfirm}>
            继续跳过
          </Button>
        </div>
      </div>
    </div>
  );
}

const DAY_THEME = ['搬家日', '这是我们家', '我们去过的地方', '我喜欢的事', '它问你的问题', '整理与补充', '它眼中的世界'] as const;

// ──────────── TextZone ────────────
function TextZone({
  value,
  onChange,
  placeholder,
  charLimit,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  charLimit: number;
}) {
  return (
    <div className="mt-3">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, charLimit))}
        placeholder={placeholder}
        rows={5}
        className="w-full min-h-[130px] border-[1.5px] border-[rgba(95,94,90,0.25)] rounded-[12px] p-3.5 font-title text-h3 text-ink-1 bg-white resize-none outline-none focus:border-ink-2 leading-[1.6]"
      />
      <div className="flex justify-between mt-1.5 px-1">
        <span className="font-title text-mini text-ink-3">多写一点也没关系</span>
        <span className="font-num text-mini text-ink-3">{value.length} / {charLimit}</span>
      </div>
    </div>
  );
}

// ──────────── 思考中 / 回复 ────────────
// ──────────── ChoiceFlow（Day 5）────────────
function ChoiceFlow({
  companionId,
  companionName,
  taskId,
  onError,
  onAllDone,
  onSkipClicked,
}: {
  companionId: string;
  companionName: string;
  taskId: string;
  onError: (msg: string) => void;
  onAllDone: (replies: string[]) => void;
  onSkipClicked: () => void;
}) {
  const [questions, setQuestions] = useState<Day5Question[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [qIdx, setQIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [replies, setReplies] = useState<string[]>([]);

  useEffect(() => {
    getDay5Questions()
      .then((r) => setQuestions(r.questions))
      .catch((e) => onError((e as Error)?.message ?? '生成问题失败'))
      .finally(() => setLoading(false));
  }, [onError]);

  if (loading) {
    return (
      <div className="py-10 flex flex-col items-center gap-3">
        <span className="block w-12 h-12 rounded-full border-[3px] border-amber-light border-t-transparent animate-spin" />
        <p className="font-title text-body text-ink-2">{companionName}在想要问什么…</p>
      </div>
    );
  }

  if (!questions) {
    return (
      <div className="py-10 text-center">
        <p className="font-title text-body text-ink-2">出了点问题，回去再来</p>
        <Button className="mt-4" onClick={onSkipClicked}>
          跳过
        </Button>
      </div>
    );
  }

  const q = questions[qIdx];

  const pickOption = async (opt: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await submitText({
        companion_id: companionId,
        task_id: taskId,
        user_text: `[Q${qIdx + 1}: ${q.question}] 我选: ${opt}`,
      });
      const newReplies = [...replies, res.companion_response];
      setReplies(newReplies);
      if (qIdx < questions.length - 1) {
        setQIdx(qIdx + 1);
      } else {
        onAllDone(newReplies);
      }
    } catch (e) {
      onError((e as Error)?.message ?? '出了点问题');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="font-num text-mini text-ink-3 mb-2 tracking-[0.16em]">
        第 {qIdx + 1} / {questions.length} 个问题
      </div>
      <p className="font-title text-h3 text-ink-1 leading-[1.5] mb-4">
        {q.question}
      </p>
      <div className="flex flex-col gap-2.5">
        {q.options.map((opt, i) => (
          <button
            key={i}
            disabled={submitting}
            onClick={() => pickOption(opt)}
            className="bg-white border-[1.2px] border-ink-2 rounded-card px-4 py-3 font-title text-body text-ink-1 text-left cursor-pointer hover:bg-amber-light/30 active:scale-[0.99] disabled:opacity-50"
          >
            {opt}
          </button>
        ))}
      </div>
      <div className="mt-5 text-center">
        <button
          onClick={onSkipClicked}
          className="font-title text-small text-ink-3 underline bg-transparent border-0 cursor-pointer"
        >
          跳过这个问题
        </button>
      </div>
    </div>
  );
}

function ThinkingState({ companionName }: { companionName: string }) {
  return (
    <div className="py-10 flex flex-col items-center gap-3">
      <div className="w-12 h-12 relative">
        <span className="absolute inset-0 rounded-full border-[3px] border-amber-light border-t-transparent animate-spin" />
      </div>
      <p className="font-title text-body text-ink-2">{companionName}正在看…</p>
      <p className="font-title text-mini text-ink-3">不会很久</p>
    </div>
  );
}

function ReplyState({
  reply,
  companionName,
  onDone,
}: {
  reply: string;
  companionName: string;
  onDone: () => void;
}) {
  return (
    <div className="py-3">
      <div className="bg-white border-[1.2px] border-ink-2 rounded-[14px] p-4">
        <p className="font-title text-mini text-ink-3 mb-1.5">{companionName}：</p>
        <p className="font-title text-body text-ink-1 leading-[1.6]">「{reply}」</p>
      </div>
      <Button size="lg" fullWidth className="mt-5" onClick={onDone}>
        好的
      </Button>
    </div>
  );
}

function TaskIcon({ kind }: { kind: TaskDef['kind'] }) {
  const baseCls = 'w-11 h-11 rounded-[10px] border-[1.5px] border-ink-2 flex items-center justify-center';
  if (kind === 'describe') {
    return (
      <div className={clsx(baseCls, 'bg-amber-light')}>
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
          <rect x="3" y="7" width="18" height="13" rx="2" fill="#FFF" stroke="#5F5E5A" strokeWidth="1.5" />
          <path d="M8 7 L9.5 4 L14.5 4 L16 7" fill="#FFF" stroke="#5F5E5A" strokeWidth="1.5" />
          <circle cx="12" cy="13" r="3.5" fill="#FAC775" stroke="#5F5E5A" strokeWidth="1.5" />
        </svg>
      </div>
    );
  }
  return (
    <div className={clsx(baseCls, 'bg-[#9FE1CB]')}>
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
        <path
          d="M4 6 Q4 3 7 3 L17 3 Q20 3 20 6 L20 14 Q20 17 17 17 L11 17 L7 21 L7 17 Q4 17 4 14 Z"
          fill="#FFF"
          stroke="#5F5E5A"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}
