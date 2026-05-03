/**
 * MicPermissionDialog — 麦克风权限引导（V0.6.1 §4.2.3）
 *
 * 两种状态：
 *   - mode='preheat'：第一次触发语音前的"心理预告"，让孩子知道接下来会弹权限
 *   - mode='denied'：权限被拒后的友好回退提示
 *
 * 真实权限请求由父组件在 [明白了] 之后调用 navigator.mediaDevices.getUserMedia 触发。
 */

'use client';

import { Button } from '@/components/ui/Button';

interface Props {
  mode: 'preheat' | 'denied';
  companionName: string;
  /** 「明白了」/「好的」点击 */
  onAcknowledge: () => void;
  /** 「用打字」点击（denied 模式下出现）*/
  onUseTyping?: () => void;
}

export function MicPermissionDialog({
  mode,
  companionName,
  onAcknowledge,
  onUseTyping,
}: Props) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-7 bg-black/40">
      <div className="bg-white rounded-card border-[1.5px] border-ink-2 px-6 py-6 max-w-[340px] w-full shadow-paper">
        {mode === 'preheat' ? (
          <>
            <p className="font-title text-h3 text-ink-1 mb-2">{companionName}想听你说话</p>
            <p className="font-title text-body text-ink-2 leading-relaxed mb-4">
              接下来你的手机会问"是否允许使用麦克风"，
              请选"允许"，这样它才能听到你。
            </p>
            <Button fullWidth size="lg" onClick={onAcknowledge}>
              明白了
            </Button>
          </>
        ) : (
          <>
            <p className="font-title text-h3 text-ink-1 mb-2">没关系，可以打字告诉它。</p>
            <p className="font-title text-body text-ink-2 leading-relaxed mb-4">
              之后想用说话，可以在设置里开启麦克风。
            </p>
            <div className="flex gap-3">
              <Button variant="ghost" fullWidth onClick={onAcknowledge}>
                好的
              </Button>
              {onUseTyping && (
                <Button fullWidth onClick={onUseTyping}>
                  用打字
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
