/**
 * 临时上线欢迎页 /start（PRD §27.2.1）
 *
 * 流程：
 *   1. 询问昵称（默认）+ "之前来过？用昵称回来"
 *   2. 用户提交 → /api/auth/start → 下发 cookie → 跳 / 启动页
 *   3. "用昵称回来" → /api/auth/lookup → 列表 → 选择 → /api/auth/resume → 跳 /
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { MobileShell } from '@/components/ui/MobileShell';
import { Button } from '@/components/ui/Button';
import {
  authLookup,
  authResume,
  authStart,
  fetchMe,
  type AuthLookupMatch,
} from '@/lib/api/client';
import { getDeviceFingerprint } from '@/lib/auth/clientFingerprint';
import { useCompanionStore } from '@/stores/companionStore';

type Mode = 'enter' | 'resume_pick';

export default function StartPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('enter');
  const [nickname, setNickname] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [matches, setMatches] = useState<AuthLookupMatch[]>([]);

  // 已经登录过 → 直接回根（不让看 start 页）
  useEffect(() => {
    fetchMe()
      .then((r) => {
        if (r.user) router.replace('/');
      })
      .catch(() => {
        /* 忽略，让用户继续填昵称 */
      });
  }, [router]);

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setHint(null);
    const n = nickname.trim();
    if (!n) {
      setError('请填一个昵称');
      return;
    }
    if (n.length > 50) {
      setError('昵称太长，最多 50 字');
      return;
    }
    setSubmitting(true);
    try {
      const fp = await getDeviceFingerprint();
      const r = await authStart({ nickname: n, fingerprint: fp });
      // 同设备换账户场景：清掉上一个用户在 localStorage 残留的 companionId / introCompleted，
      // 否则跳 / 后会按旧 store 走错路径（如直奔 /home 但新用户没 companion → API 401 死循环）
      useCompanionStore.getState().reset();
      if (!r.created && r.homonym_count > 1) {
        setHint(`欢迎回来，${r.nickname}。`);
      } else if (r.created && r.homonym_count > 1) {
        setHint(
          `昵称"${r.nickname}"已被使用，但你可以继续 — 你们的数据不会混在一起。`,
        );
      }
      // 微小延时让 hint 露一下脸再跳
      setTimeout(() => router.replace('/'), 450);
    } catch (err) {
      const code = (err as Error)?.message ?? 'unknown';
      setError(
        code === 'invalid_nickname'
          ? '昵称不合法'
          : '一时进不去，再试一次？',
      );
      setSubmitting(false);
    }
  };

  const onLookup = async () => {
    setError(null);
    setHint(null);
    const n = nickname.trim();
    if (!n) {
      setError('先输入你之前用的昵称');
      return;
    }
    setSubmitting(true);
    try {
      const list = await authLookup(n);
      setSubmitting(false);
      if (list.length === 0) {
        setError(`没找到"${n}"。换个昵称或新建一个？`);
        return;
      }
      setMatches(list);
      setMode('resume_pick');
    } catch {
      setError('找不太到，再试一次？');
      setSubmitting(false);
    }
  };

  const onResume = async (userId: string) => {
    setSubmitting(true);
    try {
      await authResume(userId);
      // 同上：清残留 store 避免新身份用旧路径
      useCompanionStore.getState().reset();
      router.replace('/');
    } catch {
      setError('回来失败，再试？');
      setSubmitting(false);
    }
  };

  return (
    <MobileShell showStatusBar={false}>
      <div className="min-h-dvh flex flex-col px-8 pt-16 pb-12">
        <div className="text-center mb-10">
          <h1 className="font-title text-h1 text-ink-1 mb-2">欢迎来到 Home</h1>
          <p className="font-title text-body text-ink-3">
            给你最喜欢的玩具一个数字小家
          </p>
        </div>

        {mode === 'enter' && (
          <form onSubmit={onSubmit} className="flex-1 flex flex-col gap-4">
            <div>
              <p className="font-title text-h3 text-ink-1 mb-1">请告诉我你的昵称</p>
              <p className="font-title text-small text-ink-3 mb-3">
                这是你在这里的名字
              </p>
              <input
                type="text"
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value.slice(0, 50));
                  setError(null);
                }}
                placeholder="比如：小明、小红的妈妈"
                autoFocus
                disabled={submitting}
                className="w-full px-4 py-3 font-title text-body text-ink-1 bg-white border-[1.5px] border-ink-2 rounded-card outline-none focus:border-amber-DEFAULT disabled:opacity-50"
                aria-label="昵称"
              />
              <p className="font-title text-mini text-ink-3 text-right mt-1">
                {nickname.length} / 50
              </p>
            </div>

            {error && (
              <p className="font-title text-small text-[#E24B4A]" role="alert">
                {error}
              </p>
            )}
            {hint && (
              <p className="font-title text-small text-amber-mid" role="status">
                {hint}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              fullWidth
              disabled={submitting || nickname.trim().length === 0}
            >
              {submitting ? '在进去......' : '开始体验'}
            </Button>

            <button
              type="button"
              onClick={onLookup}
              disabled={submitting || nickname.trim().length === 0}
              className="font-title text-small text-ink-3 underline bg-transparent border-0 cursor-pointer disabled:opacity-50 mt-1"
            >
              你之前来过？用昵称回来
            </button>
          </form>
        )}

        {mode === 'resume_pick' && (
          <div className="flex-1 flex flex-col gap-3">
            <p className="font-title text-h3 text-ink-1">
              找到 {matches.length} 个用过"{nickname}"的小家：
            </p>
            <p className="font-title text-small text-ink-3">挑最近活跃的那个。</p>
            {matches.map((m) => (
              <button
                key={m.user_id}
                onClick={() => onResume(m.user_id)}
                disabled={submitting}
                className="text-left bg-white border-[1.5px] border-ink-2 rounded-card px-4 py-3 active:scale-[0.99] cursor-pointer disabled:opacity-50"
              >
                <p className="font-title text-body text-ink-1 mb-0.5">
                  {m.nickname}
                </p>
                <p className="font-title text-mini text-ink-3">
                  最近活跃：{formatActive(m.last_active_at, m.created_at)}
                </p>
              </button>
            ))}
            {error && (
              <p className="font-title text-small text-[#E24B4A]">{error}</p>
            )}
            <button
              onClick={() => setMode('enter')}
              disabled={submitting}
              className="font-title text-small text-ink-3 underline bg-transparent border-0 cursor-pointer mt-2"
            >
              ← 都不是，新建一个
            </button>
          </div>
        )}

        <p className="font-title text-mini text-ink-3 text-center mt-6">
          继续即代表你同意
          <a
            href="/legal/privacy"
            className="underline mx-1"
            target="_blank"
            rel="noreferrer"
          >
            隐私说明
          </a>
          与
          <a
            href="/legal/tos"
            className="underline mx-1"
            target="_blank"
            rel="noreferrer"
          >
            使用条款
          </a>
        </p>
      </div>
    </MobileShell>
  );
}

function formatActive(lastActive: string | null, createdAt: string): string {
  const t = lastActive ?? createdAt;
  if (!t) return '？';
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '？';
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
