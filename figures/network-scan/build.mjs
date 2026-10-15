import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const KIT = "C:/Users/somraj/.agents/skills/anatomy";
const k = await import(pathToFileURL(`${KIT}/kit/iso-kit.mjs`).href);
const { kitScript } = await import(pathToFileURL(`${KIT}/scripts/inline-kit.mjs`).href);

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 860;
const HEIGHT = 460;

const PLATE = { x: -168, y: -78, w: 336, d: 168, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;
const KINDS = ["Router", "Computer", "Display", "Speaker", "Light", "Printer"];
const STEP = 48;
const X0 = -120;
const stationX = (index) => X0 + index * STEP;

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    [stationX(0), 36, 42],
    [stationX(5), 36, 42],
    [-150, -40, 28],
  ],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 40, elevation: 30 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 24), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.2, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 24), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.4), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 6), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 11);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.1, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.48 }));
  const strip = { x: -150, y: PLATE.y + 12, w: 300, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 6, 5, strip.y + 0.8, 0.6, [1.8, 3.2], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6])], { size: 0.42 }));
  const label = { x: -150, y: 48, w: 36, d: 14, r: 1.2 };
  out.push(S(k.slabOf(label, 0, 0.7, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.4), 0.7, P), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([label.x + 18, label.y + 7], 0.75, P), "SCAN", { size: 3.1, tone: "mid", anchor: "middle" }));
  return out.join("");
}

function rails() {
  const out = [];
  for (const y of [-46, -28]) {
    const plan = { x: X0 - 18, y, w: STEP * 5 + 36, d: 5, r: 1 };
    out.push(S(k.slabOf(plan, 0, 3.2, P, 3, 0.35), { tone: "mid" }));
    out.push(D([plan.x + 4, plan.x + plan.w - 4].map((x) => at([x, y + 2.5, 3.2])), { size: 0.4 }));
  }
  for (const x of [X0 - 16, X0 + STEP * 5 + 16]) {
    out.push(S(k.slabOf({ x: x - 3, y: -48, w: 6, d: 28, r: 1 }, 3.2, 6, P, 2, 0.3), { tone: "hi" }));
  }
  return out.join("");
}

function lamp(x, kind) {
  return `<g class="scan-lamp" data-kind="${kind}">${S(k.cylinder(x, 46, 2.4, 5.2, 3.2, P, 16), { tone: "lo", className: "scan-lamp-body" })}</g>`;
}

function router(x) {
  const body = { x: x - 11, y: 14, w: 22, d: 16, r: 1.4 };
  const out = [S(k.slabOf(body, 5.2, 8, P, 3, 0.4), { tone: "hi" })];
  out.push(L(k.planOutline(k.insetPlan(body, 1.6), 13.2, P), { tone: "faint" }));
  for (const side of [-6, 6]) out.push(S(k.cylinder(x + side, 30, 0.7, 13.2, 8, P, 10), { tone: "mid" }));
  out.push(D([at([x - 6, 30, 21.2]), at([x + 6, 30, 21.2])], { size: 0.4 }));
  out.push(D([-6, -2, 2, 6].map((dx) => at([x + dx, 16.5, 13.2])), { size: 0.38 }));
  return out.join("");
}

function computer(x) {
  const out = [S(k.slabOf({ x: x - 10, y: 12, w: 20, d: 14, r: 1 }, 5.2, 6, P, 3, 0.3), { tone: "mid" })];
  out.push(S(k.slabOf({ x: x - 8, y: 22, w: 16, d: 2.2, r: 0.4 }, 11.2, 12, P, 2, 0.3), { tone: "hi" }));
  out.push(L(k.lineOnTop([x - 5, 23.2], [x + 5, 23.2], 23.3, P), { tone: "lo", free: true }));
  return out.join("");
}

function display(x) {
  const out = [S(k.cylinder(x, 16, 4, 5.2, 2, P, 16), { tone: "mid" })];
  out.push(S(k.slabOf({ x: x - 12, y: 20, w: 24, d: 2, r: 0.4 }, 7.2, 14, P, 2, 0.3), { tone: "hi" }));
  return out.join("");
}

function speaker(x) {
  const out = [S(k.cylinder(x, 22, 7, 5.2, 12, P, 24, 0.4), { tone: "hi" })];
  out.push(L(k.ring(x, 22, 4.2, 17.2, P, 20), { tone: "lo" }));
  out.push(D([at([x, 22, 17.2])], { size: 0.45 }));
  return out.join("");
}

function light(x) {
  const out = [S(k.cylinder(x, 20, 4.2, 5.2, 3, P, 16), { tone: "mid" })];
  out.push(S(k.cylinder(x, 20, 2.2, 8.2, 4, P, 12), { tone: "lo" }));
  out.push(S(k.cylinder(x, 20, 5.5, 12.2, 8, P, 20, 0.6), { tone: "hi", className: "scan-glass" }));
  return out.join("");
}

function printer(x) {
  const body = { x: x - 12, y: 12, w: 24, d: 18, r: 1.2 };
  const out = [S(k.slabOf(body, 5.2, 10, P, 3, 0.35), { tone: "hi" })];
  out.push(L(k.lineOnTop([x - 8, 22], [x + 8, 22], 15.3, P), { tone: "lo" }));
  out.push(D([at([x - 8, 22, 15.3]), at([x + 8, 22, 15.3])], { size: 0.4 }));
  out.push(S(k.slabOf({ x: x - 8, y: 24, w: 16, d: 8, r: 0.4 }, 15.2, 0.6, P, 2), { tone: "lo", flat: true }));
  return out.join("");
}

const DRAW = { Router: router, Computer: computer, Display: display, Speaker: speaker, Light: light, Printer: printer };

function stations() {
  return KINDS.map((kind, index) => {
    const x = stationX(index);
    const plinth = { x: x - 14, y: 8, w: 28, d: 40, r: 2 };
    return [
      S(k.slabOf(plinth, 0, 5.2, P, 3, 0.4), { tone: "lo" }),
      L(k.planOutline(k.insetPlan(plinth, 1.6), 5.2, P), { tone: "faint" }),
      DRAW[kind](x),
      lamp(x, kind),
    ].join("");
  }).join("");
}

function head() {
  const x = stationX(0);
  const body = { x: x - 12, y: -50, w: 24, d: 26, r: 2 };
  const out = [];
  out.push(S(k.slabOf(body, 3.2, 8, P, 3, 0.45), { tone: "hi" }));
  out.push(S(k.cylinder(x - 6, -40, 2.2, 3.2, 8, P, 14), { tone: "lo" }));
  out.push(S(k.cylinder(x + 6, -40, 2.2, 3.2, 8, P, 14), { tone: "lo" }));
  const coil = k.coil(-36, -8, [x, 11], 2.2, 5, "y", P, 10);
  out.push(L(coil.back, { tone: "lo" }));
  out.push(S(k.cylinder(x, -8, 1.3, 11, 10, P, 10), { tone: "mid" }));
  out.push(L(coil.front, { tone: "mid" }));
  out.push(S(k.cylinder(x, 4, 1.6, 18, 6, P, 12), { tone: "hi" }));
  out.push(D([at([x, 4, 24])], { size: 0.55, tone: "hi" }));
  out.push(k.wireSvg([x + 10, -46, 11.2], [x + 16, -58, 6], { tone: "lo", size: 0.7 }));
  return `<g data-part="head">${out.join("")}</g>`;
}

const step = k.axisVector(P, [STEP, 0, 0]).map((value) => Math.round(value * 100) / 100);

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: "A bench scanner. Its head walks six jacks. A lamp lights when that kind of device answers on the network.",
  body: [plate(), rails(), stations(), head()],
});

const live = `
const head = document.querySelector('[data-part="head"]');
const lamps = [...document.querySelectorAll(".scan-lamp")];
const readout = document.querySelector("[data-readout]");
const kinds = ${JSON.stringify(KINDS)};
const step = ${JSON.stringify(step)};
const still = matchMedia("(prefers-reduced-motion: reduce)");
let index = 0;
let found = new Set();
const place = (at) => head.setAttribute("transform", "translate(" + (step[0] * at) + " " + (step[1] * at) + ")");
const paint = () => {
  lamps.forEach((lamp) => lamp.toggleAttribute("data-lit", found.has(lamp.dataset.kind)));
  const count = kinds.filter((kind) => found.has(kind)).length;
  const text = found.size ? count + " of " + kinds.length + " kinds answered" : "Sweeping the six jacks";
  if (readout && readout.textContent !== text) readout.textContent = text;
};
place(0);
paint();
let frame = 0;
let last = 0;
const tick = (now) => {
  const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
  last = now;
  if (!still.matches && found.size === 0) {
    index = (index + dt * 0.65) % kinds.length;
    place(index);
  }
  frame = requestAnimationFrame(tick);
};
frame = requestAnimationFrame(tick);
document.addEventListener("scan-found", (event) => {
  found = new Set(event.detail || []);
  paint();
  const next = kinds.findIndex((kind) => found.has(kind));
  if (next >= 0) place(next);
});
`;

const body = k.plateHtml({
  fig: "Fig 2",
  title: "Network scan",
  hint: "The head walks the jacks",
  readout: "Sweeping the six jacks",
  keys: [
    { mark: "lit", label: "A lamp lights when that kind of device answers" },
    { mark: "raised", label: "Scanner head, probe, and the six device jacks" },
  ],
  caption: "The sweep is one pass along the bench. Each jack is a different kind of device: router, computer, display, speaker, light, and printer. A lamp stays on only for a kind the scan actually found.",
  body: `<div class="iso-stage">${svg}</div>`,
});

const page = k.pageHtml({
  title: theme === "light" ? "Network scan, light" : "Network scan",
  theme,
  body,
  script: kitScript() + live,
  width: 920,
});

const name = theme === "light" ? "network-scan-light.html" : "network-scan.html";
writeFileSync(join(HERE, name), page);
writeFileSync(join(HERE, "model.json"), JSON.stringify({ kinds: KINDS, step }));
console.log(name);
