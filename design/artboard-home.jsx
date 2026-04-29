/* Artboard 2 — Home (主页·小家) — 390×844 interactive prototype piece */
function HomeScreen({ onOpenTask, onOpenMemory }) {
  return (
    <div style={{ width: 390, height: 844, background: '#FAEEDA', position: 'relative', overflow: 'hidden', fontFamily: 'var(--f-body)' }}>
      {/* iOS status bar */}
      <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', fontFamily: 'var(--f-num)', fontWeight: 600, fontSize: 14, color: '#2C2C2A' }}>
        <span>9:41</span>
        <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ width: 16, height: 10, border: '1.5px solid #2C2C2A', borderRadius: 2, position: 'relative' }}>
            <span style={{ position: 'absolute', inset: 1, background: '#2C2C2A', width: '70%' }} />
          </span>
        </span>
      </div>

      {/* HUD 56 */}
      <div style={{ padding: '8px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: 'var(--f-title)', fontSize: 22, color: '#2C2C2A', fontWeight: 500 }}>小青龙的家</div>
          <div style={{ fontFamily: 'var(--f-title)', fontSize: 12, color: '#888780', marginTop: 2 }}>安静地看着窗外</div>
        </div>
        <div style={{ background: '#FAC775', color: '#633806', fontFamily: 'var(--f-num)', fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', padding: '6px 12px', borderRadius: 999 }}>
          DAY 4 / 7
        </div>
      </div>

      {/* Room canvas */}
      <div style={{ height: 380, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
        <Room
          width={360} height={380}
          photos={[
            { x: 230, y: 250, rot: -6, label: '厨房', tone: '#F4C0D1', wall: 'back' },
            { x: 360, y: 230, rot: 5, label: '小区', tone: '#85B7EB', wall: 'back' },
          ]}
          familyFrames={[{ x: 460, y: 310, rot: 2, wall: 'back' }]}
          items={[{ x: 240, y: 470, kind: 'dumplings' }]}
        >
          <g transform="translate(280,360) scale(0.85)">
            <Xiaoqinglong pose="stand" size={150} />
          </g>
        </Room>
      </div>

      {/* Speech bubble */}
      <div style={{ margin: '0 20px 14px', position: 'relative' }}>
        <div style={{ background: '#FFFFFF', border: '1.2px solid #5F5E5A', borderRadius: 14, padding: '14px 18px' }}>
          <div style={{ fontFamily: 'var(--f-title)', fontSize: 16, color: '#2C2C2A', lineHeight: 1.5 }}>
            「今天...有什么新鲜事吗？」
          </div>
          <div style={{ fontFamily: 'var(--f-title)', fontSize: 11, color: '#888780', marginTop: 6 }}>— 小青龙</div>
        </div>
        {/* tail */}
        <svg width="20" height="14" style={{ position: 'absolute', top: -10, left: 28 }}>
          <path d="M0 14 L10 0 L20 14 Z" fill="#FFFFFF" stroke="#5F5E5A" strokeWidth="1.2" />
          <path d="M2 14 L18 14" stroke="#FFFFFF" strokeWidth="2" />
        </svg>
      </div>

      {/* Bottom nav 64 */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 84, background: '#FFF8EA', borderTop: '1px solid rgba(95,94,90,0.15)', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', paddingBottom: 18 }}>
        <NavBtn icon="task" label="今日任务" badge onClick={onOpenTask} />
        <NavBtn icon="brain" label="它的脑袋" reddot onClick={onOpenMemory} />
        <NavBtn icon="diary" label="日记" />
        <NavBtn icon="gear"  label="设置" />
      </div>
    </div>
  );
}

function NavBtn({ icon, label, reddot, badge, onClick }) {
  return (
    <button onClick={onClick} style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 0 4px', cursor: 'pointer', position: 'relative' }}>
      <span style={{ position: 'relative', display: 'inline-block', width: 30, height: 30 }}>
        <NavIcon kind={icon} />
        {reddot && <span style={{ position: 'absolute', top: 0, right: -2, width: 9, height: 9, background: '#E24B4A', borderRadius: '50%', border: '1.5px solid #FFF8EA' }} />}
        {badge && <span style={{ position: 'absolute', top: -2, right: -4, width: 16, height: 16, background: '#FAC775', color: '#633806', borderRadius: '50%', fontSize: 10, fontWeight: 700, fontFamily: 'var(--f-num)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</span>}
      </span>
      <span style={{ fontFamily: 'var(--f-title)', fontSize: 11, color: '#5F5E5A' }}>{label}</span>
    </button>
  );
}

function NavIcon({ kind }) {
  if (kind === 'task') return (
    <svg viewBox="0 0 30 30" width="30" height="30">
      <rect x="6" y="5" width="18" height="20" rx="3" fill="#FAC775" stroke="#5F5E5A" strokeWidth="1.5" />
      <path d="M10 12 L13 15 L20 9" stroke="#5F5E5A" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <line x1="10" y1="19" x2="20" y2="19" stroke="#5F5E5A" strokeWidth="1.2" />
    </svg>
  );
  if (kind === 'brain') return (
    <svg viewBox="0 0 30 30" width="30" height="30">
      <path d="M15 5 Q8 5 7 12 Q4 14 5 18 Q5 22 9 22 Q9 26 14 26 Q15 26 15 24 L15 5 Z" fill="#F0997B" stroke="#5F5E5A" strokeWidth="1.5" />
      <path d="M15 5 Q22 5 23 12 Q26 14 25 18 Q25 22 21 22 Q21 26 16 26 Q15 26 15 24 L15 5 Z" fill="#F0997B" stroke="#5F5E5A" strokeWidth="1.5" />
      <path d="M11 12 Q13 14 11 16 M19 12 Q17 14 19 16" stroke="#5F5E5A" strokeWidth="1" fill="none" />
    </svg>
  );
  if (kind === 'diary') return (
    <svg viewBox="0 0 30 30" width="30" height="30">
      <rect x="7" y="5" width="16" height="20" rx="2" fill="#9FE1CB" stroke="#5F5E5A" strokeWidth="1.5" />
      <line x1="11" y1="11" x2="19" y2="11" stroke="#5F5E5A" strokeWidth="1.2" />
      <line x1="11" y1="15" x2="19" y2="15" stroke="#5F5E5A" strokeWidth="1.2" />
      <line x1="11" y1="19" x2="17" y2="19" stroke="#5F5E5A" strokeWidth="1.2" />
    </svg>
  );
  return (
    <svg viewBox="0 0 30 30" width="30" height="30">
      <circle cx="15" cy="15" r="4" fill="none" stroke="#5F5E5A" strokeWidth="1.5" />
      <circle cx="15" cy="15" r="9" fill="none" stroke="#5F5E5A" strokeWidth="1.5" strokeDasharray="2 3" />
    </svg>
  );
}

window.HomeScreen = HomeScreen;
