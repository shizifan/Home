/* Artboard 1 — Graduation Card 1080×1920 */
function GraduationCard() {
  return (
    <div style={{ width: 1080, height: 1920, background: '#FAEEDA', position: 'relative', fontFamily: 'var(--f-body)', overflow: 'hidden' }}>
      {/* Subtle paper grain via repeating dots */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.4, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(95,94,90,0.08) 1px, transparent 1px)',
        backgroundSize: '14px 14px' }} />

      {/* HEADER 0–100 */}
      <div style={{ position: 'absolute', top: 60, left: 60, right: 60, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span style={{ fontFamily: 'var(--f-title)', fontSize: 38, color: '#2C2C2A', fontWeight: 500, letterSpacing: '0.04em' }}>Home</span>
          <span style={{ fontFamily: 'var(--f-num)', fontSize: 16, color: '#888780', letterSpacing: '0.18em' }}>· 数字小家</span>
        </div>
        <div style={{ background: '#FAC775', color: '#633806', fontFamily: 'var(--f-num)', fontSize: 18, fontWeight: 600, letterSpacing: '0.18em', padding: '10px 20px', borderRadius: 999 }}>
          DAY 7 · 毕业
        </div>
      </div>

      {/* MAIN VISUAL — isometric room  100–680 */}
      <div style={{ position: 'absolute', top: 140, left: 60, right: 60, height: 600, display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: 900, height: 600 }}>
          <Room
            width={900}
            height={600}
            photos={[
              { x: 230, y: 240, rot: -7, label: '厨房', tone: '#F4C0D1', wall: 'back' },
              { x: 360, y: 220, rot: 4, label: '小区门口', tone: '#85B7EB', wall: 'back' },
              { x: 100, y: 290, rot: -5, label: '生日', tone: '#FAC775', wall: 'left' },
            ]}
            familyFrames={[
              { x: 460, y: 300, rot: 2, wall: 'back' },
            ]}
            items={[
              { x: 240, y: 470, kind: 'dumplings' },
              { x: 380, y: 500, kind: 'blocks' },
            ]}
          >
            {/* xiaoqinglong placed in front-center of the floor */}
            <g transform="translate(280, 360) scale(0.9)">
              <Xiaoqinglong pose="stand" size={160} />
            </g>
            {/* speech bubble — small */}
            <g transform="translate(440, 320)">
              <path d="M0 0 Q0 -22 22 -22 L138 -22 Q160 -22 160 0 L160 36 Q160 58 138 58 L48 58 L34 72 L36 58 L22 58 Q0 58 0 36 Z"
                fill="#FFFFFF" stroke="#5F5E5A" strokeWidth="1.2" />
              <text x="80" y="20" textAnchor="middle" fontFamily="var(--f-title)" fontSize="14" fill="#2C2C2A">这是我们家。</text>
              <text x="80" y="40" textAnchor="middle" fontFamily="var(--f-title)" fontSize="14" fill="#2C2C2A">我喜欢这里。</text>
            </g>
          </Room>
        </div>
      </div>

      {/* TITLE 740–880 */}
      <div style={{ position: 'absolute', top: 760, left: 60, right: 60, textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--f-num)', fontSize: 18, letterSpacing: '0.32em', color: '#888780', marginBottom: 12 }}>
          这是我的
        </div>
        <h1 style={{ margin: 0, fontFamily: 'var(--f-title)', fontSize: 76, fontWeight: 500, color: '#2C2C2A', letterSpacing: '0.04em' }}>
          小青龙
        </h1>
        <div style={{ marginTop: 10, fontFamily: 'var(--f-title)', fontSize: 22, color: '#5F5E5A' }}>
          它在 Home 住了 7 天
        </div>
      </div>

      {/* DOSSIER 6 items — 940–1620 */}
      <div style={{ position: 'absolute', top: 960, left: 100, right: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <span style={{ fontFamily: 'var(--f-title)', fontSize: 26, color: '#2C2C2A' }}>它眼中的世界</span>
          <span style={{ flex: 1, height: 1, background: 'rgba(95,94,90,0.25)' }} />
          <span style={{ fontFamily: 'var(--f-num)', fontSize: 12, color: '#888780', letterSpacing: '0.16em' }}>WORLDVIEW · 6 ITEMS</span>
        </div>

        <DossierRow label="最重要的人" value="妈妈呀，是妈妈。" />
        <DossierRow label="最好玩的事" value="和妈妈一起搭积木的时候。" />
        <DossierRow label="最好吃的"  value="妈妈包的饺子，没有第二名。" />
        <DossierRow label="最害怕的"  value="晚上一个人在房间，会怕怕的。" />
        <DossierRow label="不知道的"  value="我不知道公园是什么……你从来没带我去过。" accent="amber" />
        <DossierRow label="差点忘了的" value="是奶奶。一开始我以为她不重要——但你告诉我她其实很重要。" accent="gold" />
      </div>

      {/* STATS 1660–1760 */}
      <div style={{ position: 'absolute', top: 1660, left: 100, right: 100 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: '1px solid rgba(95,94,90,0.25)', borderBottom: '1px solid rgba(95,94,90,0.25)', padding: '18px 0' }}>
          <Stat n="12" label="张照片" />
          <Stat n="18" label="句对话" />
          <Stat n="3"  label="次纠正" highlight />
          <Stat n="7"  label="天陪伴" />
        </div>
      </div>

      {/* FOOTER  1820 */}
      <div style={{ position: 'absolute', bottom: 60, left: 60, right: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: 'var(--f-title)', fontSize: 18, color: '#5F5E5A' }}>
          home.app · 给你最喜欢的玩具一个数字小家
        </div>
        <div style={{ width: 64, height: 64, borderRadius: 8, border: '2px dashed rgba(95,94,90,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--f-num)', fontSize: 9, color: '#888780', letterSpacing: '0.1em', textAlign: 'center', lineHeight: 1.2 }}>
          QR<br/>V2
        </div>
      </div>
    </div>
  );
}

function DossierRow({ label, value, accent }) {
  const isAmber = accent === 'amber';
  const isGold = accent === 'gold';
  const baseStyle = {
    display: 'grid',
    gridTemplateColumns: '180px 1fr',
    columnGap: 24,
    alignItems: 'baseline',
    padding: '20px 24px',
    borderRadius: 6,
    marginBottom: 8,
    position: 'relative',
  };
  const boxStyle = isGold
    ? { ...baseStyle, background: 'rgba(239,159,39,0.18)', boxShadow: 'inset 0 0 0 1.5px #EF9F27' }
    : isAmber
      ? { ...baseStyle, background: 'rgba(186,117,23,0.06)' }
      : baseStyle;
  return (
    <div style={boxStyle}>
      {isGold && (
        <span style={{ position: 'absolute', left: -2, top: 22, fontSize: 22 }}>★</span>
      )}
      <div style={{
        fontFamily: 'var(--f-title)', fontSize: 22,
        color: isGold ? '#854F0B' : isAmber ? '#BA7517' : '#888780',
        fontWeight: 500,
      }}>{label}</div>
      <div style={{
        fontFamily: 'var(--f-title)', fontSize: 28, lineHeight: 1.5,
        color: isGold ? '#633806' : isAmber ? '#BA7517' : '#2C2C2A',
        fontWeight: isGold || isAmber ? 500 : 400,
      }}>{value}</div>
    </div>
  );
}

function Stat({ n, label, highlight }) {
  return (
    <div style={{ textAlign: 'center', borderRight: '1px solid rgba(95,94,90,0.18)', position: 'relative' }}>
      <div style={{ fontFamily: 'var(--f-num)', fontSize: 48, fontWeight: 600, color: highlight ? '#BA7517' : '#2C2C2A', lineHeight: 1 }}>{n}</div>
      <div style={{ fontFamily: 'var(--f-title)', fontSize: 16, color: '#5F5E5A', marginTop: 8 }}>{label}</div>
    </div>
  );
}

window.GraduationCard = GraduationCard;
