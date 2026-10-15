import { useEffect, useMemo, useRef, useState } from "react"
import { SWATCHES, hsvToRgb, rgbToHsv, type Rgb } from "../lib/color"
import { kelvinCss, kelvinToRgb, rgbCss } from "../lib/utils"
import { Range } from "./ui"

type Mode = "color" | "white"

export function ColorStudio({
  kelvinMin,
  kelvinMax,
  onPilot,
  onPreview,
}: {
  kelvinMin: number
  kelvinMax: number
  onPilot: (params: Record<string, number | boolean>) => void
  onPreview?: (color: Rgb | null) => void
}) {
  const [mode, setMode] = useState<Mode>("color")
  const [hue, setHue] = useState(24)
  const [sat, setSat] = useState(0.85)
  const [val, setVal] = useState(1)
  const [kelvin, setKelvin] = useState(Math.round((kelvinMin + kelvinMax) / 2))
  const [dimming, setDimming] = useState(70)
  const color = useMemo(() => hsvToRgb(hue, sat, val), [hue, sat, val])
  const touched = useRef(false)
  const pilotRef = useRef(onPilot)
  pilotRef.current = onPilot
  const previewRef = useRef(onPreview)
  previewRef.current = onPreview

  useEffect(() => {
    const next = mode === "color" ? color : kelvinToRgb(kelvin)
    const gain = dimming / 100
    previewRef.current?.({
      r: Math.round(next.r * gain),
      g: Math.round(next.g * gain),
      b: Math.round(next.b * gain),
    })
  }, [mode, color, kelvin, dimming])

  useEffect(() => () => previewRef.current?.(null), [])

  useEffect(() => {
    if (!touched.current) return
    const handle = window.setTimeout(() => {
      if (mode === "color") pilotRef.current({ state: true, dimming, r: color.r, g: color.g, b: color.b })
      else pilotRef.current({ state: true, dimming, temp: kelvin })
    }, 140)
    return () => window.clearTimeout(handle)
  }, [mode, color, kelvin, dimming])

  function touch() {
    touched.current = true
  }

  function pick(rgb: Rgb) {
    const next = rgbToHsv(rgb.r, rgb.g, rgb.b)
    setMode("color")
    setHue(next.h)
    setSat(next.s)
    setVal(next.v || 1)
  }

  return (
    <div className="grid gap-5">
      <div className="flex gap-2">
        {(["color", "white"] as Mode[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              touch()
              setMode(item)
            }}
            className={`rounded-md px-3 py-1.5 text-sm ${mode === item ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
          >
            {item === "color" ? "Color" : "White"}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
        <div className="h-28 rounded-lg border border-border" style={{ background: mode === "color" ? rgbCss(color.r, color.g, color.b) : kelvinCss(kelvin) }} />
        <div className="grid grid-cols-6 gap-2">
          {SWATCHES.map((swatch) => {
            const fill = swatch.rgb ? rgbCss(swatch.rgb.r, swatch.rgb.g, swatch.rgb.b) : kelvinCss(swatch.kelvin ?? 2700)
            return (
              <button
                key={swatch.name}
                type="button"
                title={swatch.name}
                aria-label={swatch.name}
                className="h-8 rounded-md border border-border"
                style={{ background: fill }}
                onClick={() => {
                  touch()
                  if (swatch.rgb) pick(swatch.rgb)
                  else {
                    setMode("white")
                    setKelvin(Math.min(kelvinMax, Math.max(kelvinMin, swatch.kelvin ?? kelvin)))
                  }
                }}
              />
            )
          })}
        </div>
      </div>
      {mode === "color" ? (
        <div className="grid gap-4">
          <Range label="Hue" min={0} max={360} value={Math.round(hue)} onValueChange={(value) => { touch(); setHue(value) }} />
          <Range label="Saturation" min={0} max={100} value={Math.round(sat * 100)} onValueChange={(value) => { touch(); setSat(value / 100) }} />
          <Range label="Brightness of color" min={1} max={100} value={Math.round(val * 100)} onValueChange={(value) => { touch(); setVal(value / 100) }} />
        </div>
      ) : (
        <div className="grid gap-2">
          <Range label="Color temperature (K)" min={kelvinMin} max={kelvinMax} step={50} value={kelvin} onValueChange={(value) => { touch(); setKelvin(value) }} />
          <div className="h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${kelvinCss(kelvinMin)}, ${kelvinCss(kelvinMax)})` }} />
        </div>
      )}
      <Range label="Dimming" min={10} max={100} value={dimming} onValueChange={(value) => { touch(); setDimming(value) }} />
    </div>
  )
}
