/* Artboard 4 — Task card overlay — 390×844, two states (photo / text) */
function TaskOverlay({ variant = 'photo', onClose }) {
  return (
    <div style={{ width: 390, height: 844, position: 'relative', overflow: 'hidden', fontFamily: 'var(--f-body)' }}>
      {/* Dim Home behind */}
      <div style={{ position: 'absolute', inset: 0, background: '#FAEEDA' }}>
        {/* tiny ghost of the home — just the room silhouette */}
        <div style={{ position: 'absolute', top: 100, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: 0.55 }}>
          <Room width={300} height={320}
            photos={[{ x: 230, y: 250, rot: -6, label: '', tone: '#F4C0D1', wall: 'back' }]}
            items={[]}
          >
            <g transform="translate(280,360) scale(0.8)"><Xiaoqinglong pose={variant === 'photo' ? 'stand' : 'sit'} size={140} /></g>
          </Room>
        </div>
      </div>
      {/* dimmer */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(44,44,42,0.35)' }} />

      {/* sheet */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: '#FAEEDA', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: '12px 22px 26px', boxShadow: '0 -8px 32px rgba(0,0,0,0.18)', maxHeight: 620 }}>
        {/* handle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', padding: 8, cursor: 'pointer' }}>
            <span style={{ display: 'block', width: 44, height: 5, background: 'rgba(95,94,90,0.35)', borderRadius: 999 }} />
          </button>
        </div>

        {/* task icon + day */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          {variant === 'photo' ? (
            <div style={{ width: 44, height: 44, background: '#FAC775', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #5F5E5A' }}>
              <svg width="24" height="24" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2" fill="#FFF" stroke="#5F5E5A" strokeWidth="1.5" /><path d="M8 7 L9.5 4 L14.5 4 L16 7" fill="#FFF" stroke="#5F5E5A" strokeWidth="1.5" /><circle cx="12" cy="13" r="3.5" fill="#FAC775" stroke="#5F5E5A" strokeWidth="1.5" /></svg>
            </div>
          ) : (
            <div style={{ width: 44, height: 44, background: '#9FE1CB', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #5F5E5A' }}>
              <svg width="24" height="24" viewBox="0 0 24 24"><path d="M4 6 Q4 3 7 3 L17 3 Q20 3 20 6 L20 14 Q20 17 17 17 L11 17 L7 21 L7 17 Q4 17 4 14 Z" fill="#FFF" stroke="#5F5E5A" strokeWidth="1.5" /></svg>
            </div>
          )}
          <div>
            <div style={{ fontFamily: 'var(--f-num)', fontSize: 11, color: '#888780', letterSpacing: '0.16em' }}>
              DAY {variant === 'photo' ? '1' : '4'} · {variant === 'photo' ? '搬家日' : '我喜欢的事'}
            </div>
            <div style={{ fontFamily: 'var(--f-title)', fontSize: 22, color: '#2C2C2A', fontWeight: 500, marginTop: 2 }}>
              {variant === 'photo' ? '你最常呆的地方' : '我喜欢的事'}
            </div>
          </div>
        </div>

        {/* prompt from companion */}
        <div style={{ background: '#FFFFFF', border: '1.2px solid #5F5E5A', borderRadius: 12, padding: '12px 14px', marginBottom: 16, position: 'relative' }}>
          <div style={{ fontFamily: 'var(--f-title)', fontSize: 11, color: '#888780', marginBottom: 4 }}>小青龙问你：</div>
          <div style={{ fontFamily: 'var(--f-title)', fontSize: 15, color: '#2C2C2A', lineHeight: 1.55 }}>
            {variant === 'photo'
              ? '「拍一张你和我最常呆的地方吧——这样我就知道哪里最有安全感了。」'
              : '「写一段话告诉我吧。多写点也没关系。你最喜欢的是什么？为什么？」'}
          </div>
        </div>

        {/* Interaction zone */}
        {variant === 'photo' ? <PhotoZone /> : <TextZone />}

        {/* Action row */}
        <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'transparent', color: '#888780', border: '1.5px solid rgba(95,94,90,0.3)', borderRadius: 999, padding: '14px 0', fontFamily: 'var(--f-title)', fontSize: 15, cursor: 'pointer' }}>
            跳过
          </button>
          <button onClick={onClose} style={{ flex: 2, background: '#2C2C2A', color: '#FAEEDA', border: 'none', borderRadius: 999, padding: '14px 0', fontFamily: 'var(--f-title)', fontSize: 15, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            完成 <span style={{ fontSize: 14 }}>▷</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function PhotoZone() {
  return (
    <div>
      <div style={{ background: 'repeating-linear-gradient(45deg, #FFF8EA, #FFF8EA 10px, #F5DEB3 10px, #F5DEB3 11px)', border: '1.5px dashed rgba(95,94,90,0.35)', borderRadius: 14, height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <div style={{ width: 56, height: 56, background: '#FAC775', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #FFFFFF', boxShadow: '0 2px 0 #5F5E5A' }}>
          <svg width="28" height="28" viewBox="0 0 24 24"><circle cx="12" cy="13" r="5" fill="none" stroke="#5F5E5A" strokeWidth="2" /><circle cx="12" cy="13" r="2" fill="#5F5E5A" /></svg>
        </div>
        <div style={{ fontFamily: 'var(--f-title)', fontSize: 14, color: '#5F5E5A' }}>点这里拍一张</div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'center' }}>
        <button style={{ background: '#FFFFFF', border: '1px solid rgba(95,94,90,0.25)', borderRadius: 999, padding: '8px 14px', fontFamily: 'var(--f-title)', fontSize: 12, color: '#5F5E5A', cursor: 'pointer' }}>📁 从相册选</button>
      </div>
    </div>
  );
}
function TextZone() {
  return (
    <div>
      <textarea
        defaultValue="我最喜欢的是......"
        style={{ width: '100%', minHeight: 130, border: '1.5px solid rgba(95,94,90,0.25)', borderRadius: 12, padding: 14, fontFamily: 'var(--f-title)', fontSize: 15, color: '#888780', background: '#FFFFFF', resize: 'none', lineHeight: 1.6, outline: 'none' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, padding: '0 4px' }}>
        <span style={{ fontFamily: 'var(--f-title)', fontSize: 11, color: '#888780' }}>多写一点也没关系</span>
        <span style={{ fontFamily: 'var(--f-num)', fontSize: 11, color: '#888780' }}>0 / 300</span>
      </div>
    </div>
  );
}

window.TaskOverlay = TaskOverlay;
