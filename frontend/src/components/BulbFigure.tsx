import { useLayoutEffect, useRef, useState } from "react"
import mark from "./bulb-mark.svg?raw"
import "./bulb-figure.css"

type Rgb = { r: number; g: number; b: number }

function mix(rgb: Rgb, gain: number): Rgb {
  return {
    r: Math.max(0, Math.min(255, Math.round(rgb.r * gain))),
    g: Math.max(0, Math.min(255, Math.round(rgb.g * gain))),
    b: Math.max(0, Math.min(255, Math.round(rgb.b * gain))),
  }
}

function paint(group: Element, rgb: Rgb) {
  const css = (color: Rgb) => `rgb(${color.r}, ${color.g}, ${color.b})`
  const fill = group.querySelector(".iso-fill")
  const top = group.querySelector(".iso-top")
  if (fill instanceof SVGElement) {
    fill.style.fill = css(rgb)
    fill.style.stroke = "none"
  }
  if (top instanceof SVGElement) {
    const tone = css(mix(rgb, 1.06))
    top.style.fill = tone
    top.style.stroke = tone
  }
  group.querySelectorAll(".iso-shade").forEach((path, index) => {
    if (!(path instanceof SVGElement)) return
    const tone = css(mix(rgb, 0.62 + index * 0.08))
    path.style.fill = tone
    path.style.stroke = tone
  })
  const edge = group.querySelector(".iso-edge")
  if (edge instanceof SVGElement) edge.style.stroke = css(mix(rgb, 0.42))
}

export function BulbFigure({ color, lit, theme }: { color: Rgb; lit: boolean; theme: "dark" | "light" }) {
  const root = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const shown = lit ? color : mix(color, 0.16)

  useLayoutEffect(() => {
    const node = root.current
    if (!node) return
    node.querySelectorAll(".bulb-glass").forEach((glass) => paint(glass, shown))
    node.querySelectorAll(".bulb-die").forEach((die) => paint(die, shown))
  }, [shown.r, shown.g, shown.b])

  return (
    <div className="grid justify-items-center gap-2">
      <div ref={root} className="iso bulb-figure w-full" data-theme={theme} data-open={open ? "inner" : "outer"} aria-hidden="true" dangerouslySetInnerHTML={{ __html: mark }} />
      <button
        type="button"
        className="rounded-md bg-secondary px-3 py-1.5 text-sm"
        aria-pressed={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Outer" : "Inner"}
      </button>
    </div>
  )
}
