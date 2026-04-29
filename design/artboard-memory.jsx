/* Artboard 3 — Memory Panel «它的脑袋» — 390×844 scrollable */
function MemoryPanel({ onClose }) {
  const [active, setActive] = React.useState('all');
  return (
    <div style={{ width: 390, height: 844, background: '#FAEEDA', position: 'relative', overflow: 'hidden', fontFamily: 'var(--f-body)' }}>
      {/* status bar */}
      <div style={{ height: 44 }} />

      {/* Header with brain cross-section anchor */}
      <div style={{ padding: '6px 18px 12px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(95,94,90,0.12)' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <svg width="22" height="22" viewBox="0 0 22 22"><path d="M14 4 L7 11 L14 18" stroke="#2C2C2A" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
        </button>
        {/* brain cross-section: small XQL head with thought bubble interior */}
        <svg width="58" height="48" viewBox="0 0 58 48">
          <path d="M8 24 Q4 8 22 6 Q42 6 50 18 Q56 30 50 38 Q40 44 22 42 Q8 38 8 24 Z" fill="#D3D1C7" stroke="#5F5E5A" strokeWidth="1.5" />
          {/* horn nubs */}
          <path d="M18 8 Q16 0 22 0 Q26 4 24 10 Z" fill="#6B6A66" stroke="#5F5E5A" strokeWidth="1" />
          <path d="M30 6 Q28 -2 34 -2 Q38 2 36 8 Z" fill="#6B6A66" stroke="#5F5E5A" strokeWidth="1" />
          {/* cross-section interior — dotted */}
          <path d="M14 24 Q10 14 24 12 Q42 12 46 22 Q50 32 42 36 Q26 38 14 24 Z" fill="#FFF8EA" stroke="#5F5E5A" strokeWidth="1" strokeDasharray="2 2" />
          {/* tiny concept dots inside */}
          <circle cx="22" cy="22" r="2.5" fill="#F0997B" />
          <circle cx="32" cy="20" r="2" fill="#AFA9EC" />
          <circle cx="38" cy="28" r="2" fill="#B5D4F4" />
          <circle cx="26" cy="30" r="2" fill="#F0997B" />
          {/* eye */}
          <ellipse cx="20" cy="20" rx="1.6" ry="2" fill="#2C2C2A" />
        </svg>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--f-title)', fontSize: 18, color: '#2C2C2A', fontWeight: 500 }}>它的脑袋</div>
          <div style={{ fontFamily: 'var(--f-title)', fontSize: 11, color: '#888780', marginTop: 1 }}>小青龙在想这些事</div>
        </div>
      </div>

      {/* Scroll body */}
      <div style={{ height: 'calc(100% - 44px - 70px)', overflowY: 'auto', padding: '14px 16px 80px' }}>
        {/* tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {[
            { k: 'all', label: '全部' },
            { k: 'r', label: '记住·5', color: '#F0997B' },
            { k: 'u', label: '拿不准·2', color: '#AFA9EC' },
            { k: 's', label: '放下·3', color: '#85B7EB' },
            { k: 'n', label: '不知道', color: '#888780' },
          ].map(t => (
            <button key={t.k} onClick={() => setActive(t.k)} style={{
              border: 'none', cursor: 'pointer',
              background: active === t.k ? '#2C2C2A' : '#FFFFFF',
              color: active === t.k ? '#FAEEDA' : '#2C2C2A',
              fontFamily: 'var(--f-title)', fontSize: 12, padding: '6px 10px', borderRadius: 999,
              border: '1px solid rgba(95,94,90,0.18)',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Section 1 — remembered */}
        <SectionHead color="#F0997B" icon="heart" title="我记住的东西" count={5} />
        <ConceptCard color="#F0997B" name="妈妈" iconBg="#F0997B" iconText="人"
          summary="我觉得她是这家最重要的人。"
          evidence={['你拍的厨房的照片', '你说"我最喜欢妈妈包的饺子"', '你说"和妈妈一起搭积木"']} />
        <ConceptCard color="#F0997B" name="搭积木" iconBg="#F0997B" iconText="事"
          summary="你最喜欢做的事，常常和妈妈一起。"
          evidence={['Day 3 你画了一座积木塔', '你两次提到"和妈妈搭"']} />

        {/* Section 2 — uncertain */}
        <SectionHead color="#AFA9EC" icon="q" title="我有点拿不准的事" count={2} />
        <UncertainCard
          title="关于「今天的心情」"
          body='你昨天说"我今天有点烦"，但又拍了一张笑得很开心的照片。我不太知道你今天到底开心还是不开心。'
          cta="告诉它真实的感受"
        />

        {/* Section 3 — set aside */}
        <SectionHead color="#85B7EB" icon="moon" title="我决定先放一放的事" count={3} />
        <SetAsideCard
          title="你前天说的那只大象"
          quote="「我家有一只大象。」"
          reason="我觉得你可能在开玩笑。如果是真的，告诉我，我会重新记起来。"
        />

        {/* Section 4 — unknown */}
        <SectionHead color="#888780" icon="fog" title="我还不知道的事" />
        <UnknownCard items={['公园', '学校', '爸爸', '其他小朋友', '运动', '海边']} />

        <div style={{ textAlign: 'center', fontFamily: 'var(--f-title)', fontSize: 11, color: '#888780', padding: '24px 0' }}>
          ─ 这就是它脑袋里的全部了 ─
        </div>
      </div>

      {/* bottom nav strip preserved minimal */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 70, background: '#FFF8EA', borderTop: '1px solid rgba(95,94,90,0.15)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <button onClick={onClose} style={{ background: '#2C2C2A', color: '#FAEEDA', border: 'none', borderRadius: 999, padding: '10px 28px', fontFamily: 'var(--f-title)', fontSize: 14, cursor: 'pointer' }}>
          回到小家
        </button>
      </div>
    </div>
  );
}

function SectionHead({ color, title, count, icon }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '18px 4px 10px' }}>
      <SectionIcon kind={icon} color={color} />
      <span style={{ fontFamily: 'var(--f-title)', fontSize: 16, color: '#2C2C2A', fontWeight: 500 }}>{title}</span>
      {count != null && <span style={{ fontFamily: 'var(--f-num)', fontSize: 12, color: '#888780' }}>· {count}</span>}
      <span style={{ flex: 1, height: 1, background: 'rgba(95,94,90,0.15)' }} />
    </div>
  );
}
function SectionIcon({ kind, color }) {
  if (kind === 'heart') return <svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 17 Q3 12 3 8 Q3 4 7 4 Q9 4 10 6 Q11 4 13 4 Q17 4 17 8 Q17 12 10 17 Z" fill={color} stroke="#5F5E5A" strokeWidth="1.2" /></svg>;
  if (kind === 'q') return <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill={color} stroke="#5F5E5A" strokeWidth="1.2" /><text x="10" y="14" textAnchor="middle" fontFamily="var(--f-title)" fontSize="12" fontWeight="700" fill="#2C2C2A">?</text></svg>;
  if (kind === 'moon') return <svg width="20" height="20" viewBox="0 0 20 20"><path d="M14 4 Q6 4 6 10 Q6 16 14 16 Q9 14 9 10 Q9 6 14 4 Z" fill={color} stroke="#5F5E5A" strokeWidth="1.2" /></svg>;
  return <svg width="20" height="20" viewBox="0 0 20 20"><ellipse cx="7" cy="11" rx="4" ry="3" fill={color} opacity="0.6" stroke="#5F5E5A" strokeWidth="1" /><ellipse cx="13" cy="9" rx="5" ry="3" fill={color} opacity="0.5" stroke="#5F5E5A" strokeWidth="1" /></svg>;
}

function ConceptCard({ color, name, iconText, iconBg, summary, evidence }) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid rgba(95,94,90,0.18)', borderLeft: `4px solid ${color}`, borderRadius: 8, padding: '14px 16px', marginBottom: 10, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <span style={{ width: 28, height: 28, background: iconBg, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--f-title)', fontSize: 13, color: '#fff', fontWeight: 600 }}>{iconText}</span>
        <span style={{ fontFamily: 'var(--f-title)', fontSize: 17, color: '#2C2C2A', fontWeight: 500 }}>{name}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--f-num)', fontSize: 18, color: '#888780', letterSpacing: '2px' }}>⋮</span>
      </div>
      <div style={{ fontFamily: 'var(--f-title)', fontSize: 14, color: '#2C2C2A', lineHeight: 1.55, marginBottom: 8 }}>{summary}</div>
      <div style={{ fontFamily: 'var(--f-title)', fontSize: 11, color: '#888780', marginBottom: 4 }}>我从这些事知道的：</div>
      <ul style={{ margin: 0, padding: '0 0 0 14px' }}>
        {evidence.map((e,i) => <li key={i} style={{ fontFamily: 'var(--f-title)', fontSize: 12, color: '#5F5E5A', lineHeight: 1.6 }}>{e}</li>)}
      </ul>
    </div>
  );
}
function UncertainCard({ title, body, cta }) {
  return (
    <div style={{ background: 'rgba(175,169,236,0.12)', border: '1px solid rgba(175,169,236,0.5)', borderRadius: 8, padding: '14px 16px', marginBottom: 10 }}>
      <div style={{ fontFamily: 'var(--f-title)', fontSize: 15, color: '#2C2C2A', fontWeight: 500, marginBottom: 6 }}>❓ {title}</div>
      <div style={{ fontFamily: 'var(--f-title)', fontSize: 13, color: '#5F5E5A', lineHeight: 1.6, marginBottom: 10 }}>{body}</div>
      <button style={{ background: '#AFA9EC', color: '#2C2C2A', border: 'none', borderRadius: 999, padding: '8px 16px', fontFamily: 'var(--f-title)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>{cta} →</button>
    </div>
  );
}
function SetAsideCard({ title, quote, reason }) {
  return (
    <div style={{ background: 'rgba(181,212,244,0.18)', border: '1px solid rgba(133,183,235,0.5)', borderRadius: 8, padding: '14px 16px', marginBottom: 10 }}>
      <div style={{ fontFamily: 'var(--f-title)', fontSize: 14, color: '#2C2C2A', fontWeight: 500, marginBottom: 4 }}>🌙 {title}</div>
      <div style={{ fontFamily: 'var(--f-title)', fontSize: 13, color: '#5F5E5A', fontStyle: 'italic', marginBottom: 6 }}>{quote}</div>
      <div style={{ fontFamily: 'var(--f-title)', fontSize: 12, color: '#5F5E5A', lineHeight: 1.6, marginBottom: 10 }}>{reason}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={{ background: '#FAC775', color: '#633806', border: 'none', borderRadius: 999, padding: '7px 14px', fontFamily: 'var(--f-title)', fontSize: 12, cursor: 'pointer' }}>其实是真的，记起来</button>
        <button style={{ background: 'transparent', color: '#888780', border: '1px solid rgba(95,94,90,0.3)', borderRadius: 999, padding: '7px 14px', fontFamily: 'var(--f-title)', fontSize: 12, cursor: 'pointer' }}>就是开玩笑</button>
      </div>
    </div>
  );
}
function UnknownCard({ items }) {
  return (
    <div style={{ background: 'rgba(211,209,199,0.25)', border: '1px dashed rgba(95,94,90,0.3)', borderRadius: 8, padding: '14px 16px', marginBottom: 10 }}>
      <div style={{ fontFamily: 'var(--f-title)', fontSize: 12, color: '#5F5E5A', marginBottom: 10 }}>这些是常见的事，但你还没跟我说过：</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {items.map(i => (
          <span key={i} style={{ fontFamily: 'var(--f-title)', fontSize: 13, color: '#5F5E5A', background: '#FFFFFF', border: '1px solid rgba(95,94,90,0.2)', borderRadius: 999, padding: '6px 12px' }}>· {i}</span>
        ))}
      </div>
      <div style={{ fontFamily: 'var(--f-title)', fontSize: 12, color: '#888780', marginTop: 12 }}>你想告诉我哪一个？还是先不说？</div>
    </div>
  );
}

window.MemoryPanel = MemoryPanel;
