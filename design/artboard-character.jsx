/* Artboard 5 — Xiaoqinglong three poses, each 300×400 */
function CharacterSheet() {
  return (
    <div style={{ width: 1080, height: 720, background: '#FAEEDA', padding: 40, fontFamily: 'var(--f-body)', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 12 }}>
        <span style={{ fontFamily: 'var(--f-title)', fontSize: 26, color: '#2C2C2A' }}>小青龙 · 纸片立绘三视图</span>
        <span style={{ fontFamily: 'var(--f-num)', fontSize: 11, color: '#888780', letterSpacing: '0.16em' }}>XIAOQINGLONG · TURNAROUND</span>
      </div>
      <div style={{ fontFamily: 'var(--f-title)', fontSize: 14, color: '#5F5E5A', marginBottom: 20 }}>
        外圈 2px 米白纸边 · 内部 1.2px #5F5E5A · 头身比 1:1.3 · 3/4 视角 · 主色 #D3D1C7 / 辅色 #888780 / 角 #6B6A66
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
        <PoseCell pose="stand" caption="站立 · stand"
          notes="日常默认。Day 1–6 主页站位，毕业卡主视觉。" />
        <PoseCell pose="sit"   caption="坐下 · sit"
          notes="任务卡浮层弹出时切换；倾听姿态。" />
        <PoseCell pose="lie"   caption="躺下 · lie"
          notes="夜晚／关灯模式；闭眼弧线 + zzz。" />
      </div>

      {/* color chip strip */}
      <div style={{ position: 'absolute', bottom: 32, left: 40, right: 40, display: 'flex', gap: 14, alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--f-num)', fontSize: 11, color: '#888780', letterSpacing: '0.14em' }}>PALETTE</span>
        <Chip c="#D3D1C7" name="主色 main" />
        <Chip c="#E8E6DD" name="腹部 belly" />
        <Chip c="#888780" name="辅色 aux" />
        <Chip c="#6B6A66" name="角 horn" />
        <Chip c="#FFFFFF" name="纸边 edge" border />
        <Chip c="#5F5E5A" name="内线 line" />
        <Chip c="#2C2C2A" name="眼 eye" />
      </div>
    </div>
  );
}

function PoseCell({ pose, caption, notes }) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid rgba(95,94,90,0.18)', borderRadius: 6, padding: 16, height: 540, position: 'relative' }}>
      {/* spec corners */}
      <span className="spec" style={{ position: 'absolute', top: 8, right: 8 }}>300 × 400</span>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: 400, position: 'relative' }}>
        {/* 300×400 frame */}
        <div style={{ width: 300, height: 400, background: 'repeating-linear-gradient(45deg, #FAEEDA, #FAEEDA 8px, #F5DEB3 8px, #F5DEB3 9px)', border: '1px solid rgba(95,94,90,0.25)', position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          {/* contact shadow ellipse */}
          <div style={{ position: 'absolute', bottom: 22, width: 160, height: 14, background: 'rgba(0,0,0,0.10)', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', bottom: 30 }}>
            <Xiaoqinglong pose={pose} size={pose === 'lie' ? 200 : 220} />
          </div>
          {/* baseline indicator */}
          <div style={{ position: 'absolute', bottom: 20, left: 0, right: 0, height: 1, background: 'rgba(95,94,90,0.3)' }} />
          <span className="spec" style={{ position: 'absolute', bottom: 4, left: 6 }}>baseline</span>
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <div style={{ fontFamily: 'var(--f-title)', fontSize: 20, color: '#2C2C2A' }}>{caption}</div>
        <div style={{ fontFamily: 'var(--f-title)', fontSize: 13, color: '#888780', marginTop: 4, lineHeight: 1.5 }}>{notes}</div>
      </div>
    </div>
  );
}

function Chip({ c, name, border }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 18, height: 18, background: c, borderRadius: 3, border: border ? '1px solid rgba(95,94,90,0.3)' : 'none' }} />
      <span style={{ fontFamily: 'var(--f-num)', fontSize: 10, color: '#5F5E5A', letterSpacing: '0.06em' }}>{name} · {c}</span>
    </div>
  );
}

window.CharacterSheet = CharacterSheet;
