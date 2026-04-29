/* Reusable parts — Paper-Mario style isometric room + Xiaoqinglong character.
   Everything is SVG so it scales cleanly inside any artboard. */

// ─── Isometric Room ────────────────────────────────────────────
// Three panels: back wall (right-up parallelogram), left wall (left-up
// parallelogram), floor (rhombus). 30° iso. All coords in a 600×600 viewBox.
function Room({ children, width = 600, height = 600, photos = [], items = [], familyFrames = [] }) {
  // Iso geometry: vanishing point at (300, 230). Floor diamond.
  // Top of room at y≈80, floor center at y≈360. Walls go up-back from floor edges.
  return (
    <svg viewBox="0 0 600 600" width={width} height={height} style={{ display: 'block' }}>
      {/* Soft floor shadow under room (very subtle) */}
      <ellipse cx="300" cy="555" rx="240" ry="14" fill="rgba(95,94,90,0.10)" />

      {/* Back wall — rises from floor's back edge */}
      <polygon
        points="120,200 480,200 480,380 300,440 120,380"
        fill="var(--bg-back-wall)"
        stroke="var(--edge-warm)" strokeWidth="0.5"
      />
      {/* faux split: back wall is actually two facets meeting at center spine */}
      <polygon points="120,200 300,140 480,200 480,380 300,440 120,380" fill="var(--bg-back-wall)" />
      {/* Back wall left facet (slightly darker via overlay) */}
      <polygon points="120,200 300,140 300,440 120,380" fill="var(--bg-back-wall)" />
      {/* Back wall right facet */}
      <polygon points="300,140 480,200 480,380 300,440" fill="#EFD4A0" />

      {/* Left wall (front-left tilted face) — overlap on the left */}
      <polygon
        points="60,260 120,200 120,380 60,440"
        fill="var(--bg-left-wall)"
        stroke="var(--edge-warm)" strokeWidth="0.5"
      />
      {/* Right wall (front-right tilted face) */}
      <polygon
        points="480,200 540,260 540,440 480,380"
        fill="#DFB880"
      />

      {/* Floor — rhombus, deeper warm brown */}
      <polygon
        points="60,440 300,560 540,440 300,440 120,380 480,380"
        fill="var(--bg-floor)"
        stroke="var(--edge-warm)" strokeWidth="0.5"
      />
      {/* Cleaner floor diamond on top of seam */}
      <polygon points="120,380 480,380 540,440 300,560 60,440" fill="var(--bg-floor)" />
      {/* floor highlight stripe along the back-left edge */}
      <polyline points="120,380 60,440" stroke="var(--edge-warm)" strokeWidth="1" fill="none" opacity="0.5" />
      <polyline points="480,380 540,440" stroke="var(--edge-warm)" strokeWidth="1" fill="none" opacity="0.5" />
      <polyline points="120,380 480,380" stroke="var(--edge-warm)" strokeWidth="1" fill="none" opacity="0.4" />

      {/* Floor planking — subtle iso lines */}
      {[0.2, 0.4, 0.6, 0.8].map(t => {
        const x1 = 120 + (300 - 120) * t;
        const y1 = 380 + (560 - 380) * t * 0.667;
        const x2 = 480 - (480 - 300) * t;
        const y2 = 380 + (560 - 380) * t * 0.667;
        return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--edge-warm)" strokeWidth="0.4" opacity="0.25" />;
      })}

      {/* Photos on back wall */}
      {photos.map((p, i) => <PhotoSticker key={i} {...p} />)}
      {/* Family portrait frames */}
      {familyFrames.map((f, i) => <FrameSticker key={i} {...f} />)}
      {/* Floor items */}
      {items.map((it, i) => <FloorItem key={i} {...it} />)}

      {children}
    </svg>
  );
}

// Photo on wall — 40×50 with white border, slight rotation, on back wall
function PhotoSticker({ x, y, rot = -4, label = '', tone = '#E8C896', wall = 'back' }) {
  // Iso skew per wall
  const skew = wall === 'left' ? -18 : wall === 'right' ? 18 : 0;
  return (
    <g transform={`translate(${x},${y}) rotate(${rot}) skewY(${skew})`}>
      <rect x="-22" y="-26" width="44" height="52" fill="#FFF" stroke="#5F5E5A" strokeWidth="0.8" />
      <rect x="-18" y="-22" width="36" height="36" fill={tone} />
      {/* striped placeholder lines */}
      <line x1="-18" y1="-14" x2="18" y2="-14" stroke="rgba(95,94,90,0.25)" strokeWidth="0.6" />
      <line x1="-18" y1="-6" x2="18" y2="-6" stroke="rgba(95,94,90,0.25)" strokeWidth="0.6" />
      <line x1="-18" y1="2" x2="18" y2="2" stroke="rgba(95,94,90,0.25)" strokeWidth="0.6" />
      <line x1="-18" y1="10" x2="18" y2="10" stroke="rgba(95,94,90,0.25)" strokeWidth="0.6" />
      <text x="0" y="22" textAnchor="middle" fontSize="6" fill="#5F5E5A" fontFamily="var(--f-num)">{label}</text>
    </g>
  );
}

function FrameSticker({ x, y, rot = -2, wall = 'back' }) {
  const skew = wall === 'left' ? -18 : wall === 'right' ? 18 : 0;
  return (
    <g transform={`translate(${x},${y}) rotate(${rot}) skewY(${skew})`}>
      <rect x="-18" y="-24" width="36" height="48" fill="#fff" stroke="#5F5E5A" strokeWidth="0.8" />
      <rect x="-14" y="-20" width="28" height="40" fill="#FAC775" />
      {/* simple stick figure */}
      <circle cx="0" cy="-7" r="5" fill="#A8773D" />
      <path d="M-7 0 L7 0 L5 12 L-5 12 Z" fill="#9B6B45" />
    </g>
  );
}

// Floor item — simple icon stack
function FloorItem({ x, y, kind }) {
  const stroke = '#5F5E5A';
  if (kind === 'dumplings') return (
    <g transform={`translate(${x},${y})`}>
      <ellipse cx="0" cy="4" rx="20" ry="6" fill="rgba(0,0,0,0.08)" />
      <path d="M-18 -2 Q0 -14 18 -2 L16 4 Q0 8 -16 4 Z" fill="#F5DEB3" stroke={stroke} strokeWidth="1" />
      {/* dumplings */}
      <ellipse cx="-9" cy="-4" rx="5" ry="4" fill="#FFF" stroke={stroke} strokeWidth="0.8" />
      <ellipse cx="0" cy="-7" rx="5" ry="4" fill="#FFF" stroke={stroke} strokeWidth="0.8" />
      <ellipse cx="9" cy="-4" rx="5" ry="4" fill="#FFF" stroke={stroke} strokeWidth="0.8" />
      <path d="M-12 -5 L-6 -3 M-3 -8 L3 -6 M6 -5 L12 -3" stroke={stroke} strokeWidth="0.6" fill="none" />
    </g>
  );
  if (kind === 'blocks') return (
    <g transform={`translate(${x},${y})`}>
      <ellipse cx="0" cy="6" rx="18" ry="5" fill="rgba(0,0,0,0.08)" />
      <rect x="-12" y="-2" width="12" height="10" fill="#D4537E" stroke={stroke} strokeWidth="1" />
      <rect x="0" y="-2" width="12" height="10" fill="#85B7EB" stroke={stroke} strokeWidth="1" />
      <rect x="-6" y="-12" width="12" height="10" fill="#FAC775" stroke={stroke} strokeWidth="1" />
      <circle cx="-6" cy="3" r="1.5" fill="#fff" />
      <circle cx="6" cy="3" r="1.5" fill="#fff" />
      <circle cx="0" cy="-7" r="1.5" fill="#fff" />
    </g>
  );
  if (kind === 'plant') return (
    <g transform={`translate(${x},${y})`}>
      <ellipse cx="0" cy="14" rx="14" ry="4" fill="rgba(0,0,0,0.08)" />
      <path d="M-9 14 L9 14 L7 4 L-7 4 Z" fill="#A8773D" stroke={stroke} strokeWidth="1" />
      <path d="M0 4 Q-12 -4 -8 -16 Q0 -10 0 4 Z" fill="#1D9E75" stroke={stroke} strokeWidth="1" />
      <path d="M0 4 Q12 -2 10 -14 Q2 -8 0 4 Z" fill="#97C459" stroke={stroke} strokeWidth="1" />
    </g>
  );
  return null;
}

// ─── Xiaoqinglong (paper-flat) ─────────────────────────────────
// Silhouette from the plush photos: round head, tiny dark horn, stubby legs,
// long tail, soft creme-grey body. Single layer of color, 2px white "paper edge".
function Xiaoqinglong({ pose = 'stand', size = 200 }) {
  const w = size, h = size * 1.33;
  // Build per-pose geometry. ViewBox 200x267 (3:4)
  return (
    <svg viewBox="0 0 200 267" width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <filter id="paperShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="2" floodColor="#000" floodOpacity="0.12" />
        </filter>
      </defs>
      {pose === 'stand' && <XQLStand />}
      {pose === 'sit' && <XQLSit />}
      {pose === 'lie' && <XQLLie />}
    </svg>
  );
}

// Paper-edge stroke wrapper: white 2px outer, grey 1px inner detail
const PE = { stroke: '#FFFFFF', strokeWidth: 4, strokeLinejoin: 'round', strokeLinecap: 'round' };
const PEinner = { stroke: '#5F5E5A', strokeWidth: 1.2, fill: 'none', strokeLinejoin: 'round' };

function XQLStand() {
  // Standing 3/4 pose. Feet planted, tail curls behind, head slightly tilted.
  return (
    <g filter="url(#paperShadow)">
      {/* Tail (behind body) */}
      <path d="M138 175 Q170 165 175 130 Q175 110 160 105 Q150 108 152 122 Q156 150 138 168 Z"
        fill="#D3D1C7" {...PE} paintOrder="stroke" />
      {/* Back legs */}
      <path d="M68 200 Q60 220 64 250 Q68 258 80 257 Q88 254 86 240 L84 215 Z"
        fill="#888780" {...PE} paintOrder="stroke" />
      <path d="M120 200 Q116 222 122 250 Q128 258 140 257 Q148 254 144 240 L140 215 Z"
        fill="#888780" {...PE} paintOrder="stroke" />
      {/* Body — soft pear shape, slightly off-center */}
      <path d="M55 170 Q50 130 78 110 Q120 100 145 120 Q155 155 145 195 Q120 215 88 213 Q60 205 55 170 Z"
        fill="#D3D1C7" {...PE} paintOrder="stroke" />
      {/* Belly highlight */}
      <path d="M82 165 Q100 150 125 165 Q128 195 105 200 Q82 198 82 165 Z" fill="#E8E6DD" />
      {/* Front little arm — tucked */}
      <path d="M76 170 Q66 178 70 195 Q78 200 84 192 Q86 180 82 170 Z"
        fill="#D3D1C7" {...PE} paintOrder="stroke" />

      {/* Head — round, big */}
      <path d="M48 80 Q40 30 95 22 Q150 28 152 75 Q150 115 100 120 Q52 118 48 80 Z"
        fill="#D3D1C7" {...PE} paintOrder="stroke" />
      {/* Horn (small, dark grey, like the plush) */}
      <path d="M82 26 Q78 6 88 4 Q96 8 92 28 Z" fill="#6B6A66" {...PE} paintOrder="stroke" />
      <path d="M118 24 Q114 4 124 2 Q132 6 128 28 Z" fill="#6B6A66" {...PE} paintOrder="stroke" />
      {/* Cheek tuft hint */}
      <path d="M55 90 Q60 100 70 100" {...PEinner} />
      {/* Eyes — bean dots, paper-mario style */}
      <ellipse cx="78" cy="72" rx="4.5" ry="5.5" fill="#2C2C2A" />
      <ellipse cx="118" cy="72" rx="4.5" ry="5.5" fill="#2C2C2A" />
      <circle cx="79.5" cy="70" r="1.2" fill="#fff" />
      <circle cx="119.5" cy="70" r="1.2" fill="#fff" />
      {/* Tiny mouth — calm flat curve */}
      <path d="M92 92 Q100 96 108 92" {...PEinner} strokeWidth="1.5" />
      {/* Subtle muzzle line */}
      <path d="M88 85 Q100 88 112 85" {...PEinner} strokeWidth="0.8" opacity="0.5" />
    </g>
  );
}

function XQLSit() {
  return (
    <g filter="url(#paperShadow)">
      {/* tail curled around */}
      <path d="M40 220 Q15 215 18 185 Q28 170 45 180 Q55 200 45 218 Z"
        fill="#D3D1C7" {...PE} paintOrder="stroke" />
      {/* legs out front, sitting */}
      <path d="M70 220 Q60 245 80 252 Q105 252 100 230 L92 215 Z"
        fill="#888780" {...PE} paintOrder="stroke" />
      <path d="M110 220 Q108 245 130 252 Q150 250 145 228 L130 215 Z"
        fill="#888780" {...PE} paintOrder="stroke" />
      {/* body — squashed sitting */}
      <path d="M50 180 Q42 140 80 125 Q130 122 150 150 Q160 195 130 215 Q90 222 60 215 Q48 200 50 180 Z"
        fill="#D3D1C7" {...PE} paintOrder="stroke" />
      <path d="M75 175 Q100 165 130 180 Q130 205 105 210 Q80 208 75 175 Z" fill="#E8E6DD" />
      {/* head */}
      <path d="M52 90 Q44 38 100 32 Q156 38 156 88 Q152 130 100 132 Q56 128 52 90 Z"
        fill="#D3D1C7" {...PE} paintOrder="stroke" />
      <path d="M82 36 Q78 14 90 12 Q98 16 94 38 Z" fill="#6B6A66" {...PE} paintOrder="stroke" />
      <path d="M120 34 Q116 12 128 10 Q136 14 132 38 Z" fill="#6B6A66" {...PE} paintOrder="stroke" />
      <ellipse cx="80" cy="82" rx="4.5" ry="5.5" fill="#2C2C2A" />
      <ellipse cx="120" cy="82" rx="4.5" ry="5.5" fill="#2C2C2A" />
      <circle cx="81.5" cy="80" r="1.2" fill="#fff" />
      <circle cx="121.5" cy="80" r="1.2" fill="#fff" />
      <path d="M93 102 Q100 106 108 102" {...PEinner} strokeWidth="1.5" />
    </g>
  );
}

function XQLLie() {
  return (
    <g filter="url(#paperShadow)" transform="translate(0,30)">
      {/* tail trailing */}
      <path d="M165 175 Q195 170 195 145 Q190 135 178 142 Q172 158 162 170 Z"
        fill="#D3D1C7" {...PE} paintOrder="stroke" />
      {/* body — long horizontal blob */}
      <path d="M30 160 Q20 120 70 110 Q140 105 170 130 Q180 165 155 180 Q90 188 50 182 Q28 175 30 160 Z"
        fill="#D3D1C7" {...PE} paintOrder="stroke" />
      {/* belly */}
      <path d="M55 158 Q100 145 150 158 Q150 178 100 180 Q60 178 55 158 Z" fill="#E8E6DD" />
      {/* tucked legs poking out */}
      <ellipse cx="60" cy="183" rx="14" ry="6" fill="#888780" {...PE} paintOrder="stroke" />
      <ellipse cx="135" cy="183" rx="14" ry="6" fill="#888780" {...PE} paintOrder="stroke" />
      {/* head — resting on side, smaller because nearer profile */}
      <path d="M22 100 Q15 60 60 55 Q105 60 102 95 Q98 130 60 132 Q26 130 22 100 Z"
        fill="#D3D1C7" {...PE} paintOrder="stroke" />
      <path d="M40 60 Q36 42 46 40 Q54 44 50 62 Z" fill="#6B6A66" {...PE} paintOrder="stroke" />
      <path d="M68 56 Q64 38 74 36 Q82 40 78 58 Z" fill="#6B6A66" {...PE} paintOrder="stroke" />
      {/* sleepy eyes — closed arc */}
      <path d="M40 92 Q46 96 52 92" stroke="#2C2C2A" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M76 90 Q82 94 88 90" stroke="#2C2C2A" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M58 108 Q63 110 68 108" {...PEinner} strokeWidth="1.5" />
      {/* zzz */}
      <text x="120" y="55" fontFamily="var(--f-num)" fontSize="14" fill="#888780">z z</text>
    </g>
  );
}

// Expose
window.Room = Room;
window.Xiaoqinglong = Xiaoqinglong;
window.PhotoSticker = PhotoSticker;
window.FloorItem = FloorItem;
