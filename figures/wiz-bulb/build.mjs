import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const KIT = "C:/Users/somraj/.agents/skills/anatomy";
const k = await import(pathToFileURL(`${KIT}/kit/iso-kit.mjs`).href);
const latheKit = await import(pathToFileURL(`${KIT}/kit/lathe.mjs`).href);
const { frameAlong, lathe, pointOf, viewOf, angleToward } = latheKit;
const { kitScript } = await import(pathToFileURL(`${KIT}/scripts/inline-kit.mjs`).href);

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 480;
const HEIGHT = 640;

// A60 envelope is about 60 mm across the glass. World units are millimetres.
const BX = 0;
const BY = 0;
const SHELL_Z = 3.2;
const SHELL_H = 22;
const SHELL_R = 13.4;
const NECK_Z = SHELL_Z + SHELL_H;
const NECK_H = 9;
const NECK_R = 10.4;
const GLOBE_Z = NECK_Z + NECK_H - 1;
const DRIVER_Z = GLOBE_Z + 1.5;
const BOARD_Z = GLOBE_Z + 20;
const RADIUS = 30;
const MOUTH = 11.2;
const CENTER = Math.sqrt(RADIUS * RADIUS - MOUTH * MOUTH);
const TOP = CENTER + RADIUS;

const P = k.fitProjection(
  [
    [BX - 16, BY - 16, -1],
    [BX + 16, BY + 16, -1],
    [BX - 32, BY - 32, GLOBE_Z + 32],
    [BX + 32, BY + 32, GLOBE_Z + 32],
    [BX, BY, GLOBE_Z + TOP],
  ],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 38, elevation: 26 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);

const UP = frameAlong([BX, BY, GLOBE_Z], [0, 0, 1]);
const GLOBE = Array.from({ length: 19 }, (_, index) => {
  const s = (TOP * index) / 18;
  const radius = Math.sqrt(Math.max(0, RADIUS * RADIUS - (s - CENTER) ** 2));
  if (index === 0) return [0, MOUTH];
  if (index === 18) return [TOP, 0];
  return [s, radius, 1];
});
const FACE = angleToward(UP, viewOf(P));
const CUT = 0.72;
const OPEN_S = CENTER + 14;

function baseMetal() {
  const out = [];
  out.push(S(k.cylinder(BX, BY, 3.2, 0, 1.5, P, 16), { tone: "hi" }));
  out.push(S(k.cylinder(BX, BY, 8.4, 1.4, 1.6, P, 24), { tone: "lo" }));
  out.push(S(k.cylinder(BX, BY, SHELL_R, SHELL_Z, SHELL_H, P, 48, 0.4), { tone: "mid" }));
  const threads = [];
  for (let z = SHELL_Z + 2.4; z < SHELL_Z + SHELL_H - 2; z += 2.8) threads.push(k.sideArc(BX, BY, SHELL_R, z, P, 32));
  out.push(L(threads.join(""), { tone: "lo" }));
  out.push(S(k.cylinder(BX, BY, SHELL_R + 0.7, SHELL_Z + SHELL_H - 1.1, 1.5, P, 40), { tone: "hi" }));
  out.push(S(k.cylinder(BX, BY, NECK_R, NECK_Z, NECK_H, P, 36), { tone: "mid", crease: "none" }));
  out.push(L(k.sideArc(BX, BY, NECK_R, NECK_Z + 3.2, P, 24), { tone: "faint" }));
  out.push(L(k.sideArc(BX, BY, NECK_R, NECK_Z + 6.4, P, 24), { tone: "faint" }));
  return out.join("");
}

function guts() {
  const out = [];
  out.push(S(k.cylinder(BX, BY, 9.2, DRIVER_Z, 8.5, P, 36, 0.35), { tone: "lo" }));
  out.push(L(k.ring(BX, BY, 6.4, DRIVER_Z + 8.5, P, 28), { tone: "faint" }));
  const screws = [
    [BX + 4.2, BY + 3.2],
    [BX - 3.6, BY + 2.4],
  ];
  out.push(D(screws.map(([x, y]) => at([x, y, DRIVER_Z + 8.5])), { size: 0.42 }));
  const can = { x: BX - 1, y: BY - 7.2, w: 11, d: 6.4, r: 0.8 };
  out.push(S(k.slabOf(can, DRIVER_Z + 8.5, 3.4, P, 3, 0.3), { tone: "hi" }));
  out.push(L(k.planOutline(k.insetPlan(can, 1.1), DRIVER_Z + 11.9, P, 3), { tone: "faint" }));
  out.push(D([
    at([can.x + 1.6, can.y + 1.6, DRIVER_Z + 11.9]),
    at([can.x + can.w - 1.6, can.y + 1.6, DRIVER_Z + 11.9]),
  ], { size: 0.35 }));
  const aerial = [can.x + can.w - 0.6, can.y + 3.2, DRIVER_Z + 11.9];
  const tip = [can.x + can.w + 5.5, can.y + 3.2, DRIVER_Z + 14.2];
  out.push(L(k.segment(aerial, tip, P), { tone: "lo" }));
  out.push(D([at(aerial), at(tip)], { size: 0.45, tone: "hi" }));
  out.push(k.wireSvg([BX + 5.5, BY + 1.2, DRIVER_Z + 8.5], [BX + 4.2, BY + 2.4, BOARD_Z], { tone: "mid", size: 0.55 }));
  out.push(k.wireSvg([BX - 5.2, BY - 1.4, DRIVER_Z + 8.5], [BX - 3.6, BY - 2.2, BOARD_Z], { tone: "mid", size: 0.55 }));
  for (const [x, y] of [[BX + 7, BY], [BX - 3.5, BY + 6], [BX - 3.5, BY - 6]]) {
    out.push(S(k.cylinder(x, y, 1.15, DRIVER_Z + 8.5, BOARD_Z - DRIVER_Z - 8.5, P, 12), { tone: "mid" }));
  }
  out.push(S(k.cylinder(BX, BY, 13.5, BOARD_Z, 1.5, P, 40), { tone: "hi" }));
  out.push(L(k.ring(BX, BY, 11.2, BOARD_Z + 1.5, P, 36), { tone: "lo" }));
  const dies = [
    [BX, BY + 5.2],
    [BX + 4.8, BY + 1.4],
    [BX + 2.8, BY - 4.2],
    [BX - 2.8, BY - 4.2],
    [BX - 4.8, BY + 1.4],
  ];
  for (const [x, y] of dies) {
    out.push(S(k.cylinder(x, y, 1.35, BOARD_Z + 1.5, 0.65, P, 12), { tone: "hi", className: "bulb-die" }));
  }
  return `<g class="bulb-guts">${out.join("")}</g>`;
}

function radiusAt(s) {
  return Math.sqrt(Math.max(0, RADIUS * RADIUS - (s - CENTER) ** 2));
}

function globe(className) {
  const slope = (s) => {
    const rel = s - CENTER;
    const radius = Math.sqrt(Math.max(1e-4, RADIUS * RADIUS - rel * rel));
    return -rel / radius;
  };
  return S(lathe(GLOBE, UP, P, { steps: 80, smooth: { slope, rows: 7 } }), { tone: "hi", className, crease: "lo" });
}

function windowPath() {
  const count = 24;
  const along = (angle, from, to) => Array.from({ length: count + 1 }, (_, index) => {
    const s = from + ((to - from) * index) / count;
    return k.iso(pointOf(UP, s, radiusAt(s), angle), P);
  });
  const across = (s, from, to) => Array.from({ length: 16 + 1 }, (_, index) => {
    const angle = from + ((to - from) * index) / 16;
    return k.iso(pointOf(UP, s, radiusAt(s), angle), P);
  });
  return k.pathOf([
    ...along(FACE - CUT, 0, OPEN_S),
    ...across(OPEN_S, FACE - CUT, FACE + CUT).slice(1),
    ...along(FACE + CUT, OPEN_S, 0).slice(1),
    ...across(0, FACE + CUT, FACE - CUT).slice(1),
  ], true);
}

const clip = `<defs><clipPath id="wiz-cut" clipPathUnits="userSpaceOnUse"><path clip-rule="evenodd" d="M0 0H${WIDTH}V${HEIGHT}H0Z${windowPath()}"/></clipPath></defs>`;

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: "A Philips WiZ A60 bulb. The glass can be opened to show the driver, the radio can, and the five LED dice.",
  body: [clip, baseMetal(), guts(), `<g class="bulb-shell" clip-path="url(#wiz-cut)">${globe("bulb-glass")}</g>`, globe("bulb-glass bulb-closed")],
});

const live = `
const root = document.querySelector(".iso");
const glasses = [...document.querySelectorAll(".bulb-glass")];
const dies = [...document.querySelectorAll(".bulb-die")];
const button = document.querySelector("[data-open-toggle]");
const hsl = (hue) => {
  const h = ((hue % 360) + 360) % 360;
  const s = 0.78, l = 0.56;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const row = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return row.map((channel) => Math.round((channel + m) * 255));
};
const shade = (rgb, gain) => rgb.map((channel) => Math.round(channel * gain));
const css = (rgb) => "rgb(" + rgb.join(",") + ")";
const paintGroup = (group, rgb) => {
  if (!group) return;
  const fill = group.querySelector(".iso-fill");
  const top = group.querySelector(".iso-top");
  if (fill) { fill.style.fill = css(rgb); fill.style.stroke = "none"; }
  if (top) {
    const tone = css(shade(rgb, 1.06).map((channel) => Math.min(255, channel)));
    top.style.fill = tone;
    top.style.stroke = tone;
  }
  const shell = group.classList.contains("bulb-shell");
  group.querySelectorAll(".iso-shade").forEach((path, index) => {
    const tone = css(shade(rgb, 0.62 + index * 0.08));
    path.style.fill = tone;
    path.style.stroke = shell ? "none" : tone;
  });
  const edge = group.querySelector(".iso-edge");
  if (edge) edge.style.stroke = css(shade(rgb, 0.42));
};
const rgb = hsl(28);
for (const glass of glasses) paintGroup(glass, rgb);
for (const die of dies) paintGroup(die, rgb);
const setOpen = (open) => {
  root.dataset.open = open ? "inner" : "outer";
  if (button) button.textContent = open ? "Outer" : "Inner";
};
setOpen(false);
button?.addEventListener("click", () => setOpen(root.dataset.open !== "inner"));
`;

const body = k.plateHtml({
  fig: "Fig 1",
  title: "WiZ bulb",
  hint: "Inner opens the glass",
  readout: "A60",
  keys: [
    { mark: "lit", label: "Globe and the five LED dice" },
    { mark: "raised", label: "E27 shell, driver, and the radio can" },
  ],
  caption: "An A60 is about 60 mm across the glass. The E27 screw is 27 mm across. Inside are the driver, an ESP32 radio can, and five LED dice on the board.",
  body: `<div class="iso-stage">${svg}<button type="button" data-open-toggle style="position:absolute;left:20px;bottom:18px;z-index:2">Inner</button></div>`,
});

const page = k.pageHtml({
  title: theme === "light" ? "WiZ bulb, light" : "WiZ bulb",
  theme,
  body,
  script: kitScript() + live,
  width: 760,
});

const extra = `.iso[data-open="outer"] .bulb-guts,.iso[data-open="outer"] .bulb-shell{display:none}.iso[data-open="inner"] .bulb-closed{display:none}.bulb-shell .iso-fill,.bulb-shell .iso-shade,.bulb-shell .iso-top{stroke:none}`;
const name = theme === "light" ? "wiz-bulb-light.html" : "wiz-bulb.html";
writeFileSync(join(HERE, name), page.replace("</style>", `${extra}</style>`));
console.log(name);
