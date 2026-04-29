/**
 * 伙伴立绘统一入口
 * 按 presetId 路由到对应组件。MVP P0 阶段只有小青龙是真稿，其余 7 个走占位。
 */

import { CompanionPlaceholder } from './Placeholder';
import { Xiaoqinglong } from './Xiaoqinglong';
import type { CompanionPresetId, CompanionVisualProps } from './types';

interface Props extends CompanionVisualProps {
  presetId: CompanionPresetId;
}

export function Companion({ presetId, pose = 'stand', size = 200, mood = 'default' }: Props) {
  if (presetId === 'xiaoqinglong') {
    return <Xiaoqinglong pose={pose} size={size} mood={mood} />;
  }
  return <CompanionPlaceholder presetId={presetId} pose={pose} size={size} mood={mood} />;
}

export { Xiaoqinglong, CompanionPlaceholder };
export * from './types';
