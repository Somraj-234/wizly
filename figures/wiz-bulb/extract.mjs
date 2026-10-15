import { readFileSync, writeFileSync } from "node:fs"

const html = readFileSync(new URL("./wiz-bulb.html", import.meta.url), "utf8")
const svgStart = html.indexOf("<svg ")
const svgEnd = html.indexOf("</svg>")
const svg = html.slice(svgStart, svgEnd + "</svg>".length)
const styleStart = html.indexOf("<style>") + "<style>".length
const styleEnd = html.indexOf("</style>")
const style = html.slice(styleStart, styleEnd)
const isoStart = style.indexOf(".iso{")
const pageRules = style.indexOf("*{box-sizing", isoStart)
const iso = style.slice(isoStart, pageRules === -1 ? undefined : pageRules)
const out = "D:/MyCodes/wizly/frontend/src/components"
writeFileSync(`${out}/bulb-mark.svg`, svg)
writeFileSync(
  `${out}/bulb-figure.css`,
  `${iso}
.bulb-figure{background:transparent}
.bulb-figure .iso-svg{display:block;width:100%;height:auto}
.bulb-figure[data-open="outer"] .bulb-guts,.bulb-figure[data-open="outer"] .bulb-shell{display:none}
.bulb-figure[data-open="inner"] .bulb-closed{display:none}
`,
)
console.log(svg.length, iso.length)
