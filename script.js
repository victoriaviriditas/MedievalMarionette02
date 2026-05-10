/* ============================================================
   THE MARIONETTE — LOGIC
   ============================================================
   Pilgrims after the Ellesmere Chaucer (c. 1405).
   The Knight (fol. 10r) and the Squire (fol. 115v).

   Modes:
     - Knight only  (one hand controls the Knight)
     - Squire only  (one hand controls the Squire)
     - Both         (right hand → Knight, left hand → Squire)

   The most useful place to tinker is the SETTINGS section
   directly below.
   ============================================================ */


/* ==============================================================
   SETTINGS — easy things you can change
   ============================================================== */

// Which fingertip controls which body part?
// Same rigging concept for both pilgrims, for consistency.
const STRING_MAP = {
  head:  { finger: 'index',  stiffness: 0.35 },  // index finger lifts the head
  handR: { finger: 'middle', stiffness: 0.45 },  // middle finger holds the right arm
  handL: { finger: 'ring',   stiffness: 0.45 },  // ring finger holds the left arm
  chest: { finger: 'pinky',  stiffness: 0.30 },  // pinky holds the master spine string
};

// How heavy each puppet feels. Higher = hangs lower & swings slower.
const GRAVITY = 0.55;

// How responsive the strings are. Higher = jumpier; lower = lazier.
const STRING_SMOOTHING = 0.25;

// The starting mode when the page loads.
// Options: 'knight', 'squire', 'both'
const DEFAULT_MODE = 'knight';


/* ==============================================================
   HAND TRACKING — uses Google's MediaPipe to find your hand(s)
   ============================================================== */

const { HandLandmarker, FilesetResolver } = await import(
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs'
);

const video = document.getElementById('video');
const camCanvas = document.getElementById('cam-canvas');
const camCtx = camCanvas.getContext('2d');
const overlay = document.getElementById('overlay');
const beginBtn = document.getElementById('begin');
const errEl = document.getElementById('err');
const hint = document.getElementById('hint');
const modeBtn = document.getElementById('mode-toggle');
const modeLabel = document.getElementById('mode-label');
const panelEl = document.getElementById('panel');

let handLandmarker = null;
let lastVideoTime = -1;

// We can now have up to two hands tracked. Stored by handedness.
let leftHandLandmarks = null;
let rightHandLandmarks = null;

// Current mode — set later, after DOM ready.
let mode = DEFAULT_MODE;

async function initHandTracker() {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
  );
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU'
    },
    runningMode: 'VIDEO',
    numHands: 2,                        // <-- now tracks up to two hands
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
}

async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, facingMode: 'user' },
    audio: false
  });
  video.srcObject = stream;
  await new Promise(r => video.onloadedmetadata = r);
  await video.play();
  camCanvas.width = video.videoWidth;
  camCanvas.height = video.videoHeight;
}

beginBtn.addEventListener('click', async () => {
  beginBtn.disabled = true;
  beginBtn.textContent = 'Conjuring…';
  errEl.textContent = '';
  try {
    await initHandTracker();
    await startCamera();
    overlay.classList.add('hidden');
    hint.classList.add('show');
    requestAnimationFrame(track);
  } catch (e) {
    console.error(e);
    errEl.textContent = 'Alack! Camera access is required. ' + (e.message || '');
    beginBtn.disabled = false;
    beginBtn.textContent = 'Try Again';
  }
});

function track() {
  if (handLandmarker && video.readyState >= 2) {
    const t = performance.now();
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const result = handLandmarker.detectForVideo(video, t);

      // Reset both hands each frame
      leftHandLandmarks = null;
      rightHandLandmarks = null;

      if (result.landmarks && result.landmarks.length > 0) {
        // MediaPipe returns handedness as an array matched to landmarks array.
        // Note: handedness is from the camera's perspective. Because the video
        // is mirrored on screen, "Left" in the data is the user's RIGHT hand
        // on screen, and vice versa. We swap so right-hand-on-screen = right.
        for (let i = 0; i < result.landmarks.length; i++) {
          const handedness = result.handednesses[i]?.[0]?.categoryName; // "Left" or "Right"
          if (handedness === 'Left') {
            // user's right hand on screen
            rightHandLandmarks = result.landmarks[i];
          } else if (handedness === 'Right') {
            // user's left hand on screen
            leftHandLandmarks = result.landmarks[i];
          }
        }
        hint.classList.remove('show');
      } else {
        hint.classList.add('show');
      }
    }
    drawCamOverlay();
  }
  requestAnimationFrame(track);
}

// Draw the hand skeletons on the small webcam preview
function drawCamOverlay() {
  camCtx.clearRect(0, 0, camCanvas.width, camCanvas.height);

  const drawSkeleton = (lm) => {
    if (!lm) return;
    const tips = [8, 12, 16, 20];
    const connections = [
      [0,1],[1,2],[2,3],[3,4],
      [0,5],[5,6],[6,7],[7,8],
      [5,9],[9,10],[10,11],[11,12],
      [9,13],[13,14],[14,15],[15,16],
      [13,17],[17,18],[18,19],[19,20],
      [0,17]
    ];
    camCtx.strokeStyle = 'rgba(244,236,216,0.6)';
    camCtx.lineWidth = 1.5;
    connections.forEach(([a,b]) => {
      const pa = lm[a], pb = lm[b];
      camCtx.beginPath();
      camCtx.moveTo(pa.x * camCanvas.width, pa.y * camCanvas.height);
      camCtx.lineTo(pb.x * camCanvas.width, pb.y * camCanvas.height);
      camCtx.stroke();
    });
    tips.forEach(idx => {
      const p = lm[idx];
      camCtx.fillStyle = '#f4ecd8';
      camCtx.beginPath();
      camCtx.arc(p.x * camCanvas.width, p.y * camCanvas.height, 5, 0, Math.PI * 2);
      camCtx.fill();
      camCtx.strokeStyle = '#1a1410';
      camCtx.lineWidth = 1;
      camCtx.stroke();
    });
  };

  drawSkeleton(leftHandLandmarks);
  drawSkeleton(rightHandLandmarks);
}


/* ==============================================================
   THE STAGE — the big SVG where the puppet(s) are drawn
   ============================================================== */

const svg = document.getElementById('puppet-svg');
const SVG_NS = 'http://www.w3.org/2000/svg';

let W = 0, H = 0;
function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
}
resize();
window.addEventListener('resize', resize);


/* ==============================================================
   FINGERTIP TARGETS — one set per hand
   ============================================================== */

// Each hand has its own fingertip targets so the two puppets
// don't interfere with each other.
function makeFingerTargets() {
  return {
    index:  { x: 0, y: 0, active: false },
    middle: { x: 0, y: 0, active: false },
    ring:   { x: 0, y: 0, active: false },
    pinky:  { x: 0, y: 0, active: false },
  };
}

const fingersRight = makeFingerTargets();  // right hand on screen
const fingersLeft  = makeFingerTargets();  // left hand on screen

function updateFingerTargets(targets, lm) {
  if (!lm) {
    Object.values(targets).forEach(f => f.active = false);
    return;
  }
  const lookup = {
    index: lm[8],
    middle: lm[12],
    ring: lm[16],
    pinky: lm[20],
  };
  for (const k in lookup) {
    const m = lookup[k];
    const tx = (1 - m.x) * W;  // mirror x because video is flipped
    const ty = m.y * H;
    const f = targets[k];
    f.x = f.active ? f.x + (tx - f.x) * STRING_SMOOTHING : tx;
    f.y = f.active ? f.y + (ty - f.y) * STRING_SMOOTHING : ty;
    f.active = true;
  }
}


/* ==============================================================
   PHYSICS — verlet integration
   ============================================================== */

class Point {
  constructor(x, y, pinned = false) {
    this.x = x; this.y = y;
    this.px = x; this.py = y;
    this.pinned = pinned;
    this.controlString = null;       // {finger, stiffness}
    this.fingerSource = null;        // reference to a fingerTargets object
  }
  update(gravity) {
    if (this.pinned) return;
    const vx = (this.x - this.px) * 0.985;
    const vy = (this.y - this.py) * 0.985;
    this.px = this.x; this.py = this.y;
    this.x += vx;
    this.y += vy + gravity;
  }
  applyStringPull() {
    if (!this.controlString || !this.fingerSource) return;
    const f = this.fingerSource[this.controlString.finger];
    if (!f.active) return;
    const dx = f.x - this.x;
    const dy = f.y - this.y;
    this.x += dx * this.controlString.stiffness;
    this.y += dy * this.controlString.stiffness;
  }
}

class Constraint {
  constructor(a, b, len = null, stiffness = 1) {
    this.a = a; this.b = b;
    this.len = len ?? Math.hypot(a.x - b.x, a.y - b.y);
    this.stiffness = stiffness;
  }
  solve() {
    const dx = this.b.x - this.a.x;
    const dy = this.b.y - this.a.y;
    const d = Math.sqrt(dx*dx + dy*dy) || 0.001;
    const diff = (d - this.len) / d * this.stiffness;
    const ox = dx * 0.5 * diff;
    const oy = dy * 0.5 * diff;
    if (!this.a.pinned) { this.a.x += ox; this.a.y += oy; }
    if (!this.b.pinned) { this.b.x -= ox; this.b.y -= oy; }
  }
}


/* ==============================================================
   PUPPET — a single articulated figure with skeleton + strings
   Each puppet is its own instance so we can have one or two
   on stage at once.
   ============================================================== */

class Puppet {
  constructor(centerXFrac, fingerSource, type) {
    this.centerXFrac = centerXFrac;  // where on screen this puppet stands (0..1)
    this.fingerSource = fingerSource; // which hand's fingertips control it
    this.type = type;                 // 'knight' or 'squire'
    this.points = {};
    this.constraints = [];
    this.build();
  }

  cx() { return W * this.centerXFrac; }
  cy() { return H * 0.55; }

  build() {
    const { points, constraints } = this;
    const cx = this.cx(), cy = this.cy();

    points.head      = new Point(cx,        cy - 140);
    points.neck      = new Point(cx,        cy - 90);
    points.chest     = new Point(cx,        cy - 40);
    points.hip       = new Point(cx,        cy + 30);
    points.shoulderL = new Point(cx - 40,   cy - 70);
    points.shoulderR = new Point(cx + 40,   cy - 70);
    points.elbowL    = new Point(cx - 70,   cy - 20);
    points.elbowR    = new Point(cx + 70,   cy - 20);
    points.handL     = new Point(cx - 90,   cy + 30);
    points.handR     = new Point(cx + 90,   cy + 30);
    points.hipL      = new Point(cx - 20,   cy + 30);
    points.hipR      = new Point(cx + 20,   cy + 30);
    points.kneeL     = new Point(cx - 25,   cy + 90);
    points.kneeR     = new Point(cx + 25,   cy + 90);
    points.footL     = new Point(cx - 30,   cy + 150);
    points.footR     = new Point(cx + 30,   cy + 150);

    // attach control strings
    for (const [bodyPart, cfg] of Object.entries(STRING_MAP)) {
      if (points[bodyPart]) {
        points[bodyPart].controlString = cfg;
        points[bodyPart].fingerSource = this.fingerSource;
      }
    }

    // helper for adding bones
    const link = (a, b, stiff = 1) =>
      constraints.push(new Constraint(points[a], points[b], null, stiff));

    // spine
    link('head', 'neck');
    link('neck', 'chest');
    link('chest', 'hip');

    // shoulders
    link('chest', 'shoulderL');
    link('chest', 'shoulderR');
    link('shoulderL', 'shoulderR');
    link('neck', 'shoulderL');
    link('neck', 'shoulderR');

    // arms
    link('shoulderL', 'elbowL', 0.9);
    link('elbowL', 'handL', 0.9);
    link('shoulderR', 'elbowR', 0.9);
    link('elbowR', 'handR', 0.9);

    // hips
    link('hip', 'hipL');
    link('hip', 'hipR');
    link('hipL', 'hipR');

    // legs
    link('hipL', 'kneeL', 0.9);
    link('kneeL', 'footL', 0.9);
    link('hipR', 'kneeR', 0.9);
    link('kneeR', 'footR', 0.9);

    // bracing
    link('shoulderL', 'hipL', 0.6);
    link('shoulderR', 'hipR', 0.6);
  }

  step() {
    const SUBSTEPS = 4;
    for (let s = 0; s < SUBSTEPS; s++) {
      for (const k in this.points) this.points[k].applyStringPull();
      for (const k in this.points) this.points[k].update(GRAVITY / SUBSTEPS);
      for (let i = 0; i < 6; i++) {
        for (const c of this.constraints) c.solve();
      }
      const ground = H - 30;
      for (const k in this.points) {
        if (this.points[k].y > ground) this.points[k].y = ground;
      }
    }
  }
}


/* ==============================================================
   ACTIVE PUPPETS — set up based on mode
   ============================================================== */

let activePuppets = [];

function setupPuppets() {
  activePuppets = [];
  if (mode === 'knight') {
    activePuppets.push(new Puppet(0.5, fingersRight, 'knight'));
  } else if (mode === 'squire') {
    activePuppets.push(new Puppet(0.5, fingersRight, 'squire'));
  } else if (mode === 'both') {
    // Knight on the right (right hand), Squire on the left (left hand)
    activePuppets.push(new Puppet(0.65, fingersRight, 'knight'));
    activePuppets.push(new Puppet(0.35, fingersLeft,  'squire'));
  }
  updateLegend();
}

function updateLegend() {
  const knightOnly  = mode === 'knight';
  const squireOnly  = mode === 'squire';
  const both        = mode === 'both';

  let html = '';
  if (knightOnly || both) {
    html += `
      <h3>${both ? 'The Knight (right hand)' : 'The Knight'}</h3>
      <ul>
        <li><span>index</span><span>head &amp; helm</span></li>
        <li><span>middle</span><span>crop arm</span></li>
        <li><span>ring</span><span>free arm</span></li>
        <li><span>pinky</span><span>spine &amp; legs</span></li>
      </ul>
    `;
  }
  if (squireOnly || both) {
    html += `
      <h3 ${both ? 'class="second"' : ''}>${both ? 'The Squire (left hand)' : 'The Squire'}</h3>
      <ul>
        <li><span>index</span><span>head &amp; curls</span></li>
        <li><span>middle</span><span>right arm</span></li>
        <li><span>ring</span><span>flower arm</span></li>
        <li><span>pinky</span><span>spine &amp; legs</span></li>
      </ul>
    `;
  }
  panelEl.innerHTML = html;
}


/* ==============================================================
   MODE TOGGLE
   ============================================================== */

const MODES = ['knight', 'squire', 'both'];
const MODE_LABELS = {
  knight: 'The Knight',
  squire: 'The Squire',
  both:   'Both Pilgrims'
};

function setMode(newMode) {
  mode = newMode;
  modeLabel.textContent = MODE_LABELS[mode];
  setupPuppets();
}

modeBtn.addEventListener('click', () => {
  const idx = MODES.indexOf(mode);
  setMode(MODES[(idx + 1) % MODES.length]);
});

setMode(DEFAULT_MODE);


/* ==============================================================
   DRAWING — utilities shared by both pilgrims
   ============================================================== */

function ang(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }

// Build a tapered quad between two joints (used for arms and legs)
function limbPath(a, b, w1, w2) {
  const angle = ang(a, b);
  const nx = Math.cos(angle + Math.PI / 2);
  const ny = Math.sin(angle + Math.PI / 2);
  return `M${a.x + nx*w1},${a.y + ny*w1} L${b.x + nx*w2},${b.y + ny*w2} L${b.x - nx*w2},${b.y - ny*w2} L${a.x - nx*w1},${a.y - ny*w1} Z`;
}

// Helper to make an SVG element with attributes
function mk(name, attrs = {}) {
  const e = document.createElementNS(SVG_NS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}


/* ==============================================================
   COMMON SHARED ELEMENTS — strings, fingertip markers, defs
   ============================================================== */

function drawDefs() {
  const defs = mk('defs');
  defs.innerHTML = `
    <pattern id="hatch" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="4" stroke="#1a1410" stroke-width="1.2"/>
    </pattern>
    <pattern id="cross-hatch" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="5" stroke="#1a1410" stroke-width="0.8"/>
      <line x1="0" y1="0" x2="5" y2="0" stroke="#1a1410" stroke-width="0.8"/>
    </pattern>
    <pattern id="dots" patternUnits="userSpaceOnUse" width="3" height="3">
      <circle cx="1.5" cy="1.5" r="0.5" fill="#1a1410"/>
    </pattern>
    <pattern id="mail-rings" patternUnits="userSpaceOnUse" width="5" height="5">
      <circle cx="2.5" cy="2.5" r="1.3" fill="none" stroke="#1a1410" stroke-width="0.6"/>
    </pattern>
    <radialGradient id="ground-shadow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#1a1410" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#1a1410" stop-opacity="0"/>
    </radialGradient>
  `;
  svg.appendChild(defs);
}

function drawString(x1, y1, finger) {
  if (!finger.active) return;
  const x2 = finger.x, y2 = finger.y;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2 + 8;

  const path = mk('path', {
    d: `M${x2},${y2} Q${midX},${midY} ${x1},${y1}`,
    fill: 'none',
    stroke: '#1a1410',
    'stroke-width': '0.8',
    'stroke-dasharray': '2,1',
    opacity: '0.55'
  });
  svg.appendChild(path);
}

function drawPuppetStrings(puppet) {
  const p = puppet.points;
  const f = puppet.fingerSource;
  drawString(p.head.x,  p.head.y,  f.index);
  drawString(p.handR.x, p.handR.y, f.middle);
  drawString(p.handL.x, p.handL.y, f.ring);
  drawString(p.chest.x, p.chest.y, f.pinky);
}

function drawFingertipMarkers(finger, labels) {
  const fingers = [
    { f: finger.index,  label: labels[0] },
    { f: finger.middle, label: labels[1] },
    { f: finger.ring,   label: labels[2] },
    { f: finger.pinky,  label: labels[3] }
  ];
  fingers.forEach(({ f, label }) => {
    if (!f.active) return;
    const g = mk('g');
    g.appendChild(mk('circle', { cx: f.x, cy: f.y, r: 8, fill: 'none',
      stroke: '#1a1410', 'stroke-width': '1' }));
    g.appendChild(mk('circle', { cx: f.x, cy: f.y, r: 2.5, fill: '#1a1410' }));
    const txt = mk('text', { x: f.x + 12, y: f.y - 8,
      'font-family': 'UnifrakturMaguntia, serif', 'font-size': '11',
      fill: '#1a1410', opacity: '0.7' });
    txt.textContent = label;
    g.appendChild(txt);
    svg.appendChild(g);
  });
}

function drawGroundShadow(puppet) {
  const p = puppet.points;
  const groundY  = (p.footL.y + p.footR.y) / 2 + 10;
  const groundCx = (p.footL.x + p.footR.x) / 2;
  svg.appendChild(mk('ellipse', {
    cx: groundCx, cy: groundY, rx: 60, ry: 10, fill: 'url(#ground-shadow)'
  }));
}


/* ==============================================================
   THE KNIGHT — after Ellesmere fol. 10r
   Bascinet helmet, mail aventail, brown cote-armour over mail,
   belt, hose, sabatons, riding crop in the right hand.
   No shield, no sword — true to the manuscript.
   ============================================================== */

function drawKnight(puppet) {
  const p = puppet.points;

  // ---- LEGS (mail-clad, in hose) ----
  [['hipL','kneeL','footL'], ['hipR','kneeR','footR']].forEach(([h,k,f]) => {
    // upper leg
    const upper = mk('path', { d: limbPath(p[h], p[k], 8, 7),
      fill: 'none', stroke: '#1a1410', 'stroke-width': '1.4' });
    svg.appendChild(upper);
    // hatching for hose
    const upperHatch = mk('path', { d: limbPath(p[h], p[k], 7.5, 6.5),
      fill: 'url(#hatch)', opacity: 0.5 });
    svg.appendChild(upperHatch);

    // lower leg
    const lower = mk('path', { d: limbPath(p[k], p[f], 7, 5),
      fill: 'none', stroke: '#1a1410', 'stroke-width': '1.4' });
    svg.appendChild(lower);
    const lowerHatch = mk('path', { d: limbPath(p[k], p[f], 6.5, 4.5),
      fill: 'url(#hatch)', opacity: 0.5 });
    svg.appendChild(lowerHatch);

    // sabaton (pointed armoured shoe)
    const bAng = ang(p[k], p[f]);
    const sx = p[f].x + Math.cos(bAng) * 8;
    const sy = p[f].y + Math.sin(bAng) * 8;
    const sabaton = mk('path', {
      d: `M ${p[f].x - 6},${p[f].y + 2} L ${sx + 6},${sy + 2} L ${sx - 2},${sy + 5} L ${p[f].x - 8},${p[f].y + 5} Z`,
      fill: '#1a1410'
    });
    svg.appendChild(sabaton);

    // knee marker
    svg.appendChild(mk('circle', { cx: p[k].x, cy: p[k].y, r: 3.5,
      fill: '#f4ecd8', stroke: '#1a1410', 'stroke-width': '1' }));
  });

  // ---- COTE-ARMOUR (the brown surcoat — drawn in outline) ----
  const sL = p.shoulderL, sR = p.shoulderR, hL = p.hipL, hR = p.hipR;
  const expand = (a, b, factor) => ({
    x: a.x + (a.x - b.x) * factor,
    y: a.y + (a.y - b.y) * factor
  });
  const tL = expand(sL, sR, 0.15);
  const tR = expand(sR, sL, 0.15);

  // outer cote shape — extends below hips like a tunic
  const coteHemL = { x: hL.x - 8, y: hL.y + 22 };
  const coteHemR = { x: hR.x + 8, y: hR.y + 22 };
  const coteMidL = { x: hL.x - 4, y: hL.y };
  const coteMidR = { x: hR.x + 4, y: hR.y };

  const cote = mk('path', {
    d: `M ${tL.x},${tL.y} L ${tR.x},${tR.y} L ${coteMidR.x},${coteMidR.y} L ${coteHemR.x},${coteHemR.y} L ${coteHemL.x},${coteHemL.y} L ${coteMidL.x},${coteMidL.y} Z`,
    fill: '#f4ecd8', stroke: '#1a1410', 'stroke-width': '2'
  });
  svg.appendChild(cote);

  // vertical drape lines on cote
  const torsoMidX = (tL.x + tR.x) / 2;
  const torsoTop = (tL.y + tR.y) / 2;
  const torsoBot = (coteHemL.y + coteHemR.y) / 2;
  for (const offset of [-12, 0, 12]) {
    svg.appendChild(mk('path', {
      d: `M ${torsoMidX + offset},${torsoTop + 8} L ${torsoMidX + offset},${torsoBot - 4}`,
      stroke: '#1a1410', 'stroke-width': '0.7', fill: 'none', opacity: 0.6
    }));
  }

  // chainmail showing at hem (small bit beneath cote)
  svg.appendChild(mk('path', {
    d: `M ${coteHemL.x + 2},${coteHemL.y} L ${coteHemR.x - 2},${coteHemR.y} L ${coteHemR.x - 4},${coteHemR.y + 4} L ${coteHemL.x + 4},${coteHemL.y + 4} Z`,
    fill: 'url(#mail-rings)', stroke: '#1a1410', 'stroke-width': '1'
  }));

  // chainmail at chest (visible in V-neck)
  const neckV = mk('path', {
    d: `M ${torsoMidX - 8},${torsoTop + 4} L ${torsoMidX},${torsoTop + 16} L ${torsoMidX + 8},${torsoTop + 4} Z`,
    fill: 'url(#mail-rings)', stroke: '#1a1410', 'stroke-width': '1'
  });
  svg.appendChild(neckV);

  // belt
  const beltAng = ang(p.hipL, p.hipR);
  const beltMidX = (p.hipL.x + p.hipR.x) / 2;
  const beltMidY = (p.hipL.y + p.hipR.y) / 2 - 2;
  svg.appendChild(mk('rect', {
    x: beltMidX - 26, y: beltMidY - 3, width: 52, height: 6,
    transform: `rotate(${beltAng * 180/Math.PI} ${beltMidX} ${beltMidY})`,
    fill: '#1a1410'
  }));
  // buckle
  svg.appendChild(mk('rect', {
    x: beltMidX - 4, y: beltMidY - 3, width: 8, height: 6,
    transform: `rotate(${beltAng * 180/Math.PI} ${beltMidX} ${beltMidY})`,
    fill: '#f4ecd8', stroke: '#1a1410', 'stroke-width': '0.8'
  }));

  // ---- ARMS (mail sleeves with cote over them) ----
  // Left arm (free)
  svg.appendChild(mk('path', { d: limbPath(p.shoulderL, p.elbowL, 7, 6),
    fill: '#f4ecd8', stroke: '#1a1410', 'stroke-width': '1.5' }));
  svg.appendChild(mk('path', { d: limbPath(p.shoulderL, p.elbowL, 6.5, 5.5),
    fill: 'url(#hatch)', opacity: 0.5 }));

  svg.appendChild(mk('path', { d: limbPath(p.elbowL, p.handL, 6, 5),
    fill: 'url(#mail-rings)', stroke: '#1a1410', 'stroke-width': '1.5' }));

  // Right arm (crop arm)
  svg.appendChild(mk('path', { d: limbPath(p.shoulderR, p.elbowR, 7, 6),
    fill: '#f4ecd8', stroke: '#1a1410', 'stroke-width': '1.5' }));
  svg.appendChild(mk('path', { d: limbPath(p.shoulderR, p.elbowR, 6.5, 5.5),
    fill: 'url(#hatch)', opacity: 0.5 }));

  svg.appendChild(mk('path', { d: limbPath(p.elbowR, p.handR, 6, 5),
    fill: 'url(#mail-rings)', stroke: '#1a1410', 'stroke-width': '1.5' }));

  // ---- GAUNTLETS (hands) ----
  svg.appendChild(mk('circle', { cx: p.handL.x, cy: p.handL.y, r: 6,
    fill: '#1a1410' }));
  svg.appendChild(mk('circle', { cx: p.handR.x, cy: p.handR.y, r: 6,
    fill: '#1a1410' }));

  // ---- RIDING CROP (held in right hand, true to ms) ----
  const cropAng = ang(p.elbowR, p.handR);
  const cropLen = 55;
  const cropX = p.handR.x + Math.cos(cropAng) * cropLen;
  const cropY = p.handR.y + Math.sin(cropAng) * cropLen;
  svg.appendChild(mk('line', {
    x1: p.handR.x, y1: p.handR.y, x2: cropX, y2: cropY,
    stroke: '#1a1410', 'stroke-width': '1.8', 'stroke-linecap': 'round'
  }));
  // little knot at the tip
  svg.appendChild(mk('circle', { cx: cropX, cy: cropY, r: 2, fill: '#1a1410' }));
  // small leather tassel at handle
  const handleX = p.handR.x - Math.cos(cropAng) * 4;
  const handleY = p.handR.y - Math.sin(cropAng) * 4;
  svg.appendChild(mk('circle', { cx: handleX, cy: handleY, r: 2.5,
    fill: '#f4ecd8', stroke: '#1a1410', 'stroke-width': '1' }));

  // ---- BASCINET HELMET ----
  // close-fitting steel cap, with small apex point
  const headAng = ang(p.neck, p.head) + Math.PI / 2;
  const helm = mk('g');
  helm.setAttribute('transform',
    `translate(${p.head.x},${p.head.y}) rotate(${headAng * 180/Math.PI})`);
  helm.innerHTML = `
    <!-- helmet body: rounded, slightly pointed at top -->
    <path d="M -18,-8 Q -18,-26 -10,-32 Q 0,-36 10,-32 Q 18,-26 18,-8 L 18,12 Q 16,18 10,20 L -10,20 Q -16,18 -18,12 Z"
          fill="#f4ecd8" stroke="#1a1410" stroke-width="1.5"/>
    <!-- mail texture under helmet -->
    <path d="M -18,-8 Q -18,-26 -10,-32 Q 0,-36 10,-32 Q 18,-26 18,-8 L 18,12 Q 16,18 10,20 L -10,20 Q -16,18 -18,12 Z"
          fill="url(#hatch)" opacity="0.4"/>
    <!-- small apex / point at top -->
    <path d="M -2,-34 L 0,-40 L 2,-34" fill="none" stroke="#1a1410" stroke-width="1.5"/>
    <!-- face opening (oval) -->
    <ellipse cx="0" cy="0" rx="9" ry="11" fill="#f4ecd8" stroke="#1a1410" stroke-width="1.2"/>
    <!-- eyes -->
    <circle cx="-3" cy="-2" r="0.8" fill="#1a1410"/>
    <circle cx="3" cy="-2" r="0.8" fill="#1a1410"/>
    <!-- nose -->
    <path d="M 0,-1 L 0,4" stroke="#1a1410" stroke-width="0.6" fill="none"/>
    <!-- beard (the Knight is bearded, weather-worn) -->
    <path d="M -7,5 Q 0,14 7,5 Q 8,11 4,14 Q 0,16 -4,14 Q -8,11 -7,5 Z"
          fill="#1a1410"/>
    <!-- rivets along helmet edge -->
    <circle cx="-15" cy="-2" r="0.9" fill="#1a1410"/>
    <circle cx="15" cy="-2" r="0.9" fill="#1a1410"/>
    <circle cx="-15" cy="10" r="0.9" fill="#1a1410"/>
    <circle cx="15" cy="10" r="0.9" fill="#1a1410"/>
  `;
  svg.appendChild(helm);

  // ---- AVENTAIL (mail neck protector hanging from helm) ----
  svg.appendChild(mk('path', {
    d: `M ${p.head.x - 14},${p.head.y + 18} Q ${p.head.x - 12},${p.neck.y + 4} ${p.head.x - 8},${p.neck.y + 8} L ${p.head.x + 8},${p.neck.y + 8} Q ${p.head.x + 12},${p.neck.y + 4} ${p.head.x + 14},${p.head.y + 18} Z`,
    fill: 'url(#mail-rings)', stroke: '#1a1410', 'stroke-width': '1'
  }));
}


/* ==============================================================
   THE SQUIRE — after Ellesmere fol. 115v
   Curly hair (the famous "lokkes crulle"), short embroidered
   tunic, parti-coloured hose, pointed shoes (poulaines).
   No weapon — a daisy in his hand befits the courtly lover.
   ============================================================== */

function drawSquire(puppet) {
  const p = puppet.points;

  // ---- LEGS (parti-coloured hose, suggested by hatching pattern) ----
  // Left leg: plain (with horizontal bands)
  const legUL = mk('path', { d: limbPath(p.hipL, p.kneeL, 6, 5),
    fill: 'none', stroke: '#1a1410', 'stroke-width': '1.3' });
  svg.appendChild(legUL);
  // horizontal bands
  for (let t = 0.15; t <= 0.95; t += 0.15) {
    const x = p.hipL.x + (p.kneeL.x - p.hipL.x) * t;
    const y = p.hipL.y + (p.kneeL.y - p.hipL.y) * t;
    const a = ang(p.hipL, p.kneeL) + Math.PI/2;
    svg.appendChild(mk('line', {
      x1: x + Math.cos(a)*5, y1: y + Math.sin(a)*5,
      x2: x - Math.cos(a)*5, y2: y - Math.sin(a)*5,
      stroke: '#1a1410', 'stroke-width': '0.5', opacity: 0.6
    }));
  }
  const legLL = mk('path', { d: limbPath(p.kneeL, p.footL, 5, 4),
    fill: 'none', stroke: '#1a1410', 'stroke-width': '1.3' });
  svg.appendChild(legLL);
  for (let t = 0.15; t <= 0.95; t += 0.15) {
    const x = p.kneeL.x + (p.footL.x - p.kneeL.x) * t;
    const y = p.kneeL.y + (p.footL.y - p.kneeL.y) * t;
    const a = ang(p.kneeL, p.footL) + Math.PI/2;
    svg.appendChild(mk('line', {
      x1: x + Math.cos(a)*4, y1: y + Math.sin(a)*4,
      x2: x - Math.cos(a)*4, y2: y - Math.sin(a)*4,
      stroke: '#1a1410', 'stroke-width': '0.5', opacity: 0.6
    }));
  }

  // Right leg: cross-hatched (different colour suggested)
  const legUR = mk('path', { d: limbPath(p.hipR, p.kneeR, 6, 5),
    fill: 'url(#cross-hatch)', stroke: '#1a1410', 'stroke-width': '1.3' });
  svg.appendChild(legUR);
  const legLR = mk('path', { d: limbPath(p.kneeR, p.footR, 5, 4),
    fill: 'url(#cross-hatch)', stroke: '#1a1410', 'stroke-width': '1.3' });
  svg.appendChild(legLR);

  // ---- POULAINES (long pointed shoes) ----
  [['kneeL', 'footL'], ['kneeR', 'footR']].forEach(([k, f]) => {
    const pAng = ang(p[k], p[f]);
    const tx = p[f].x + Math.cos(pAng) * 14;
    const ty = p[f].y + Math.sin(pAng) * 14;
    svg.appendChild(mk('path', {
      d: `M ${p[f].x - 5},${p[f].y - 1} L ${tx},${ty} L ${p[f].x - 7},${p[f].y + 4} Z`,
      fill: '#1a1410'
    }));
  });

  // ---- SHORT TUNIC (knee-length, embroidered) ----
  const sL = p.shoulderL, sR = p.shoulderR, hL = p.hipL, hR = p.hipR;
  const expand = (a, b, factor) => ({
    x: a.x + (a.x - b.x) * factor,
    y: a.y + (a.y - b.y) * factor
  });
  const tL = expand(sL, sR, 0.15);
  const tR = expand(sR, sL, 0.15);
  // tunic stops at hip (short — that's the squire's fashion)
  const tunic = mk('path', {
    d: `M ${tL.x},${tL.y} L ${tR.x},${tR.y} L ${hR.x + 6},${hR.y + 6} L ${hL.x - 6},${hL.y + 6} Z`,
    fill: '#f4ecd8', stroke: '#1a1410', 'stroke-width': '2'
  });
  svg.appendChild(tunic);

  // ---- EMBROIDERED FLOWERS on the tunic ----
  // "embrouded was he, as it were a meede / Al ful of fresshe floures"
  const torsoMidX = (tL.x + tR.x + hL.x + hR.x) / 4;
  const torsoMidY = (tL.y + tR.y + hL.y + hR.y) / 4;
  const torsoAng = ang(
    { x: (tL.x+tR.x)/2, y: (tL.y+tR.y)/2 },
    { x: (hL.x+hR.x)/2, y: (hL.y+hR.y)/2 }
  );
  const flowers = mk('g');
  flowers.setAttribute('transform',
    `translate(${torsoMidX},${torsoMidY}) rotate(${(torsoAng - Math.PI/2) * 180/Math.PI})`);
  // small cross-shaped flowers
  const positions = [[-12, -18], [10, -15], [-8, -2], [12, 5], [-14, 12], [4, 14]];
  positions.forEach(([x, y]) => {
    flowers.innerHTML += `
      <g transform="translate(${x},${y})">
        <path d="M -2,0 L 2,0 M 0,-2 L 0,2" stroke="#1a1410" stroke-width="0.7"/>
        <circle cx="0" cy="0" r="0.7" fill="#1a1410"/>
      </g>
    `;
  });
  svg.appendChild(flowers);

  // tunic hem decoration
  svg.appendChild(mk('path', {
    d: `M ${hL.x - 6},${hL.y + 6} L ${hR.x + 6},${hR.y + 6}`,
    stroke: '#1a1410', 'stroke-width': '1.2', fill: 'none'
  }));

  // belt (slim)
  const beltAng = ang(p.hipL, p.hipR);
  const beltMidX = (p.hipL.x + p.hipR.x) / 2;
  const beltMidY = (p.hipL.y + p.hipR.y) / 2 - 1;
  svg.appendChild(mk('rect', {
    x: beltMidX - 22, y: beltMidY - 2, width: 44, height: 4,
    transform: `rotate(${beltAng * 180/Math.PI} ${beltMidX} ${beltMidY})`,
    fill: '#1a1410'
  }));

  // ---- ARMS (long, decorative sleeves) ----
  [['shoulderL', 'elbowL'], ['shoulderR', 'elbowR']].forEach(([s, e]) => {
    svg.appendChild(mk('path', { d: limbPath(p[s], p[e], 7, 5),
      fill: '#f4ecd8', stroke: '#1a1410', 'stroke-width': '1.4' }));
    // small decorative line down sleeve
    svg.appendChild(mk('line', {
      x1: p[s].x, y1: p[s].y, x2: p[e].x, y2: p[e].y,
      stroke: '#1a1410', 'stroke-width': '0.5', opacity: 0.5,
      'stroke-dasharray': '2,2'
    }));
  });
  // forearms (tighter — the upper sleeve is wider)
  svg.appendChild(mk('path', { d: limbPath(p.elbowL, p.handL, 5, 4),
    fill: '#f4ecd8', stroke: '#1a1410', 'stroke-width': '1.4' }));
  svg.appendChild(mk('path', { d: limbPath(p.elbowR, p.handR, 5, 4),
    fill: '#f4ecd8', stroke: '#1a1410', 'stroke-width': '1.4' }));

  // hands
  svg.appendChild(mk('circle', { cx: p.handL.x, cy: p.handL.y, r: 4.5,
    fill: '#f4ecd8', stroke: '#1a1410', 'stroke-width': '1' }));
  svg.appendChild(mk('circle', { cx: p.handR.x, cy: p.handR.y, r: 4.5,
    fill: '#f4ecd8', stroke: '#1a1410', 'stroke-width': '1' }));

  // ---- DAISY in left hand (the courtly lover's flourish) ----
  const daisyAng = ang(p.elbowL, p.handL);
  const daisyX = p.handL.x + Math.cos(daisyAng) * 14;
  const daisyY = p.handL.y + Math.sin(daisyAng) * 14;
  // stem
  svg.appendChild(mk('line', {
    x1: p.handL.x, y1: p.handL.y, x2: daisyX, y2: daisyY,
    stroke: '#1a1410', 'stroke-width': '0.8'
  }));
  // petals (5-pointed flower)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    svg.appendChild(mk('ellipse', {
      cx: daisyX + Math.cos(a) * 2.5, cy: daisyY + Math.sin(a) * 2.5,
      rx: 2, ry: 1.3,
      transform: `rotate(${a * 180/Math.PI} ${daisyX + Math.cos(a)*2.5} ${daisyY + Math.sin(a)*2.5})`,
      fill: '#f4ecd8', stroke: '#1a1410', 'stroke-width': '0.6'
    }));
  }
  svg.appendChild(mk('circle', { cx: daisyX, cy: daisyY, r: 1.3, fill: '#1a1410' }));

  // ---- HEAD with CURLY HAIR ----
  // "with lokkes crulle as they were leyd in presse"
  const headAng = ang(p.neck, p.head) + Math.PI / 2;
  const head = mk('g');
  head.setAttribute('transform',
    `translate(${p.head.x},${p.head.y}) rotate(${headAng * 180/Math.PI})`);

  // face (oval, undamaged — youthful)
  head.innerHTML += `
    <ellipse cx="0" cy="0" rx="13" ry="16" fill="#f4ecd8" stroke="#1a1410" stroke-width="1.3"/>
  `;
  // mass of curls — ring of small overlapping circles around the head
  const curls = [
    [-12, -14], [-7, -19], [0, -21], [7, -19], [12, -14],
    [-15, -7], [15, -7],
    [-14, 2], [14, 2],
    [-11, 11], [11, 11]
  ];
  curls.forEach(([cx, cy]) => {
    head.innerHTML += `<circle cx="${cx}" cy="${cy}" r="4" fill="#1a1410"/>`;
  });
  // small inner curls highlights (cream dots)
  curls.forEach(([cx, cy]) => {
    head.innerHTML += `<circle cx="${cx + 1}" cy="${cy - 1}" r="1" fill="#f4ecd8"/>`;
  });

  // face features
  head.innerHTML += `
    <circle cx="-3" cy="-1" r="0.9" fill="#1a1410"/>
    <circle cx="3" cy="-1" r="0.9" fill="#1a1410"/>
    <path d="M 0,0 L 0,5" stroke="#1a1410" stroke-width="0.6" fill="none"/>
    <path d="M -3,8 Q 0,10 3,8" stroke="#1a1410" stroke-width="0.7" fill="none"/>
  `;

  svg.appendChild(head);
}


/* ==============================================================
   MAIN RENDER LOOP
   ============================================================== */

function render() {
  // wipe stage
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  drawDefs();

  // draw each active puppet
  activePuppets.forEach(puppet => {
    drawGroundShadow(puppet);
    drawPuppetStrings(puppet);
    if (puppet.type === 'knight') drawKnight(puppet);
    else drawSquire(puppet);
  });

  // fingertip markers (one set per active hand)
  if (mode === 'knight' || mode === 'squire') {
    drawFingertipMarkers(fingersRight, ['i', 'ii', 'iii', 'iv']);
  } else if (mode === 'both') {
    drawFingertipMarkers(fingersRight, ['i', 'ii', 'iii', 'iv']);
    drawFingertipMarkers(fingersLeft,  ['i', 'ii', 'iii', 'iv']);
  }
}

function loop() {
  // update hand inputs
  if (mode === 'knight' || mode === 'squire') {
    updateFingerTargets(fingersRight, rightHandLandmarks || leftHandLandmarks);
  } else {
    updateFingerTargets(fingersRight, rightHandLandmarks);
    updateFingerTargets(fingersLeft,  leftHandLandmarks);
  }

  // step physics for each puppet
  activePuppets.forEach(puppet => puppet.step());

  render();
  requestAnimationFrame(loop);
}
loop();
