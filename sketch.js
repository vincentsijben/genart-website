/**
 * GenArt — Version 2.1
 * Goal: no visible “bounding box” on a website header.
 *
 * Key changes:
 * - Canvas is designed to be full-bleed (use CSS + container)
 * - Explosion tuned back to feel natural
 * - Soft out-of-bounds handling so dots don’t “vanish” at edges
 *
 * IMPORTANT for website:
 * - Put the canvas in a wrapper that is NOT clipping it (overflow: visible)
 * - Ideally, use a full-width hero container and let the canvas cover it.
 */

const DOTS = [
  [0.521798,0.084817,0.018682],[0.449402,0.086013,0.017475],[0.593596,0.099227,0.019143],
  [0.377504,0.101396,0.016179],[0.661277,0.125996,0.020034],[0.310892,0.131472,0.015349],
  [0.471997,0.162304,0.023815],[0.722592,0.166410,0.021095],[0.544627,0.166563,0.022689],
  [0.250784,0.173251,0.013855],[0.399015,0.175756,0.025064],[0.614554,0.188482,0.022301],
  [0.331888,0.207469,0.025581],[0.775992,0.219528,0.022301],[0.198217,0.227125,0.013536],
  [0.677665,0.227996,0.021505],[0.492104,0.239375,0.024358],[0.418719,0.250342,0.023815],
  [0.565878,0.251530,0.024890],[0.273399,0.254974,0.026420],[0.730936,0.281361,0.020887],
  [0.819540,0.281763,0.022881],[0.352217,0.286462,0.022105],[0.632413,0.288289,0.026255],
  [0.156541,0.290576,0.012532],[0.228163,0.316243,0.026748],[0.480296,0.316754,0.027710],
  [0.551967,0.328033,0.026585],[0.411932,0.337696,0.028023],[0.298577,0.342350,0.021706],
  [0.684729,0.344948,0.027552],[0.770218,0.347404,0.020465],[0.851470,0.351103,0.023997],
  [0.127258,0.361257,0.010233],[0.611761,0.370010,0.023631],[0.195922,0.384187,0.026255],
  [0.357447,0.385317,0.027867],[0.498944,0.387435,0.007815],[0.264464,0.407248,0.021095],
  [0.717625,0.410529,0.028023],[0.431034,0.413613,0.008355],[0.793999,0.416230,0.019594],
  [0.869694,0.420354,0.025238],[0.562562,0.426178,0.006605],[0.110837,0.431937,0.010233],
  [0.647783,0.432810,0.025064],[0.328748,0.453374,0.030412],[0.180903,0.457224,0.028639],
  [0.399015,0.481675,0.008862],[0.253328,0.485240,0.020251],[0.728658,0.488260,0.029092],
  [0.802048,0.493800,0.018209],[0.874968,0.497382,0.025751],[0.583744,0.500000,0.005908],
  [0.107759,0.508508,0.008355],[0.655480,0.508671,0.023631],[0.331183,0.530000,0.031400],
  [0.182919,0.535527,0.029242],[0.424541,0.554022,0.009797],[0.265289,0.564679,0.018914],
  [0.728970,0.568337,0.030268],[0.801929,0.571771,0.014471],[0.874592,0.574402,0.026911],
  [0.583744,0.578534,0.005908],[0.490872,0.583924,0.012179],[0.118227,0.584892,0.007815],
  [0.655893,0.585621,0.018914],[0.363280,0.598234,0.032087],[0.202539,0.610854,0.030124],
  [0.298030,0.634380,0.017723],[0.420690,0.644230,0.033025],[0.727931,0.648010,0.031400],
  [0.801478,0.650785,0.009341],[0.874384,0.651832,0.027710],[0.582923,0.657941,0.005116],
  [0.142857,0.658190,0.007815],[0.491019,0.661015,0.033679],[0.655369,0.662827,0.014769],
  [0.238344,0.678852,0.031261],[0.350768,0.690638,0.017224],[0.179803,0.725131,0.005908],
  [0.416681,0.726304,0.015907],[0.728822,0.727663,0.032627],[0.874877,0.728482,0.029539],
  [0.801314,0.729494,0.005116],[0.288177,0.736324,0.031814],[0.581281,0.738220,0.002954],
  [0.490604,0.739577,0.015349],[0.655720,0.739965,0.008862],[0.349015,0.780192,0.032358],
  [0.228243,0.781850,0.005116],[0.874642,0.806382,0.030268],[0.728660,0.806869,0.034194],
  [0.418021,0.807602,0.033288],[0.491055,0.816754,0.034066],[0.581281,0.816754,0.002954],
  [0.655172,0.816754,0.006605],[0.283251,0.829843,0.005908],[0.349754,0.863874,0.002954],
];

// Only used for aspect ratio + radius scaling
const ORIGINAL_W = 203;
const ORIGINAL_H = 191;
const BASE = Math.min(ORIGINAL_W, ORIGINAL_H);

// -------------------- SETTINGS --------------------
const NAVY = [28, 38, 58];
const TRANSPARENT_BG = true;

const WORD = "GenArt";
const WORD_COLORS = [
  [  0, 170, 255], // G
  [255,  70, 150], // e
  [ 80, 230, 150], // n
  [255, 170,  30], // A
  [170, 120, 255], // r
  [255,  70,  70], // t
];

// Layout
const PADDING = 0.08; // inside the header area (not the full canvas)
const CANVAS_MARGIN = 260; // <<< extra invisible drawing space around header area

// Physics (natural, not too huge)
const SPRING_IDLE = 0.080;
const SPRING_HOVER = 0.050;
const DAMPING = 0.885;
const MAX_SPEED = 36;

const REPULSE = 22.0;
const SWIRL = 0.95;
const WIGGLE = 0.95;
const MOVE_GUST = 0.85;
const LIFT = 0.008;

// Soft boundary handling: keep dots from “disappearing” hard at edges
const SOFT_BOUNDARY = true;
const SOFT_MARGIN = 180; // how far beyond canvas we tolerate before nudging back
const SOFT_PUSH = 0.010; // how strongly we push back (small)
 // ---------------------------------------------------

let dots = [];
let pointer = { x: 0, y: 0, active: false, vx: 0, vy: 0 };
let layout = null;
let letterBoxes = [];
let hoveredLetterIndex = -1;

class Dot {
  constructor(homeX, homeY, r) {
    this.hx = homeX; this.hy = homeY;
    this.x = homeX;  this.y = homeY;
    this.vx = 0;     this.vy = 0;
    this.r = r;
    this.seed = random(1000);
    this.seed2 = random(1000);
  }

  update(L) {
    const spring = pointer.active ? SPRING_HOVER : SPRING_IDLE;

    // spring home
    const dx = this.hx - this.x;
    const dy = this.hy - this.y;
    this.vx += dx * spring;
    this.vy += dy * spring;

    // explode field
    if (pointer.active) {
      const px = this.x - pointer.x;
      const py = this.y - pointer.y;

      const d2 = px * px + py * py;
      const d = Math.sqrt(d2) || 0.0001;

      const nx = px / d;
      const ny = py / d;

      const R = L.influenceRadius;
      if (d < R) {
        const t = 1 - d / R;
        const fall = t * t * (0.65 + 0.35 * t);

        const rep = REPULSE * fall;
        this.vx += nx * rep;
        this.vy += ny * rep;

        const swirl = SWIRL * (0.22 + 0.18 * noise(this.seed2, frameCount * 0.01));
        this.vx += (-ny) * rep * swirl;
        this.vy += ( nx) * rep * swirl;

        const mv = Math.sqrt(pointer.vx * pointer.vx + pointer.vy * pointer.vy);
        const gust = mv * MOVE_GUST * fall * 0.06;
        this.vx += nx * gust + pointer.vx * 0.010 * fall;
        this.vy += ny * gust + pointer.vy * 0.010 * fall;

        const tt = frameCount * 0.02 + this.seed;
        this.vx += (noise(tt, 0.15) - 0.5) * WIGGLE * fall * 1.2;
        this.vy += (noise(0.15, tt) - 0.5) * WIGGLE * fall * 1.2;

        this.vy -= LIFT * fall * L.logoSize;
      }
    }

    // soft boundary (prevents hard “invisible box” feel inside the canvas)
    if (SOFT_BOUNDARY) {
      const left = -SOFT_MARGIN;
      const right = width + SOFT_MARGIN;
      const top = -SOFT_MARGIN;
      const bottom = height + SOFT_MARGIN;

      if (this.x < left) this.vx += (left - this.x) * SOFT_PUSH;
      if (this.x > right) this.vx -= (this.x - right) * SOFT_PUSH;
      if (this.y < top) this.vy += (top - this.y) * SOFT_PUSH;
      if (this.y > bottom) this.vy -= (this.y - bottom) * SOFT_PUSH;
    }

    // damping + clamp
    this.vx *= DAMPING;
    this.vy *= DAMPING;

    const sp = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (sp > MAX_SPEED) {
      const s = MAX_SPEED / sp;
      this.vx *= s; this.vy *= s;
    }

    this.x += this.vx;
    this.y += this.vy;
  }

  draw() {
    circle(this.x, this.y, this.r * 2);
  }
}

function setup() {
  // Make the canvas larger than the visible header area by adding margins.
  // On a website, set width/height to your hero/header size.
  createCanvas(900 + CANVAS_MARGIN * 2, 320 + CANVAS_MARGIN * 2);
  pixelDensity(Math.min(2, window.devicePixelRatio || 1));
  rebuildAll();
}

function draw() {
  if (TRANSPARENT_BG) clear();
  else background(255);

  hoveredLetterIndex = hitTestLetters(mouseX, mouseY);

  let ink = NAVY;
  if (hoveredLetterIndex >= 0 && hoveredLetterIndex < WORD_COLORS.length) {
    ink = WORD_COLORS[hoveredLetterIndex];
  }
  noStroke();
  fill(...ink);

  pointer.vx *= 0.76;
  pointer.vy *= 0.76;

  for (const d of dots) {
    d.update(layout);
    d.draw();
  }

  drawWordmark();
}

function rebuildAll() {
  layout = computeLayout();
  rebuildDotsFromLayout(layout);
  buildLetterBoxes(layout);
}

function computeLayout() {
  // Visible “header” region is centered inside the larger canvas.
  const headerX = CANVAS_MARGIN;
  const headerY = CANVAS_MARGIN;
  const headerW = width - CANVAS_MARGIN * 2;
  const headerH = height - CANVAS_MARGIN * 2;

  const pad = min(headerW, headerH) * PADDING;

  const availableW = headerW - pad * 2;
  const availableH = headerH - pad * 2;

  const markAreaW = max(availableW * 0.36, min(availableW * 0.48, availableH * 1.2));
  const arMark = ORIGINAL_W / ORIGINAL_H;

  let markW = markAreaW;
  let markH = markW / arMark;
  if (markH > availableH) {
    markH = availableH;
    markW = markH * arMark;
  }

  const markX = headerX + pad;
  const markY = headerY + pad + (availableH - markH) / 2;

  const wordXLeft = markX + markW + pad * 0.9;
  const wordYMid = headerY + pad + availableH * 0.55;
  const targetMaxW = max(60, headerX + headerW - wordXLeft - pad);
  const targetMaxH = availableH;

  let s = targetMaxH * 0.62;
  textSize(s);
  textFont("sans-serif");
  textStyle(BOLD);
  const wAtS = textWidth(WORD);
  if (wAtS > targetMaxW) s *= (targetMaxW / wAtS);
  s = min(s, targetMaxH * 0.70);

  textSize(s);
  const asc = textAscent();
  const desc = textDescent();
  const baselineY = wordYMid + (asc - desc) * 0.25;

  const logoSize = max(markW, markH);
  const influenceRadius = logoSize * 0.70; // natural: not too huge

  return {
    headerX, headerY, headerW, headerH,
    pad,
    markX, markY, markW, markH,
    wordX: wordXLeft,
    wordBaselineY: baselineY,
    wordSize: s,
    logoSize,
    influenceRadius
  };
}

function rebuildDotsFromLayout(L) {
  dots = [];
  const sx = L.markW / ORIGINAL_W;
  const sy = L.markH / ORIGINAL_H;
  const sr = min(sx, sy);

  for (const [xn, yn, rn] of DOTS) {
    const hx = L.markX + xn * L.markW;
    const hy = L.markY + yn * L.markH;
    const r = (rn * BASE) * sr;
    dots.push(new Dot(hx, hy, r));
  }
}

function buildLetterBoxes(L) {
  letterBoxes = [];
  textFont("sans-serif");
  textStyle(BOLD);
  textSize(L.wordSize);

  const asc = textAscent();
  const desc = textDescent();
  const top = L.wordBaselineY - asc;
  const h = asc + desc;

  let x = L.wordX;
  for (let i = 0; i < WORD.length; i++) {
    const ch = WORD[i];
    const w = textWidth(ch);
    const px = L.wordSize * 0.06;
    letterBoxes.push({ i, ch, x: x - px, y: top - px, w: w + px * 2, h: h + px * 2 });
    x += w;
  }
}

function hitTestLetters(mx, my) {
  for (const b of letterBoxes) {
    if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) return b.i;
  }
  return -1;
}

function drawWordmark() {
  if (!layout) return;

  textFont("sans-serif");
  textStyle(BOLD);
  textSize(layout.wordSize);

  noStroke();
  fill(...NAVY);
  text(WORD, layout.wordX, layout.wordBaselineY);

  if (hoveredLetterIndex >= 0) {
    const b = letterBoxes[hoveredLetterIndex];
    fill(...WORD_COLORS[hoveredLetterIndex]);
    text(b.ch, b.x + layout.wordSize * 0.06, layout.wordBaselineY);
  }
}

// Pointer events (no edge checks: keep motion even near borders)
function mouseMoved() {
  const dx = mouseX - pointer.x;
  const dy = mouseY - pointer.y;
  pointer.vx = dx; pointer.vy = dy;
  pointer.x = mouseX; pointer.y = mouseY;
  pointer.active = true;
}
function mouseDragged() { mouseMoved(); }
function mouseEntered() { pointer.active = true; }
function mouseExited()  { pointer.active = false; }

function touchMoved() {
  if (touches.length > 0) {
    const t = touches[0];
    const dx = t.x - pointer.x;
    const dy = t.y - pointer.y;
    pointer.vx = dx; pointer.vy = dy;
    pointer.x = t.x; pointer.y = t.y;
    pointer.active = true;
  }
  return false;
}
function touchEnded() { pointer.active = false; }
