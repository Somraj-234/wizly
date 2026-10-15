import { useState } from "react"
import { Button, Note, Range } from "../components/ui"
import { api } from "../lib/api"
import { rgbCss } from "../lib/utils"
import { useStudio } from "../studio"

export function GradientView() {
  const studio = useStudio()
  const [start, setStart] = useState("#ff8a3d")
  const [end, setEnd] = useState("#3d7dff")
  const [dimming, setDimming] = useState(70)

  function parse(hex: string) {
    const value = hex.replace("#", "")
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16),
    }
  }

  async function apply() {
    if (studio.selected.length < 2) {
      studio.setNotice("Select two bulbs, or more. Colors are spread from the first selected to the last.")
      return
    }
    try {
      const data = await api.gradient(studio.selected, parse(start), parse(end), dimming)
      studio.setNotice(`Gradient sent to ${studio.selected.length} bulbs.`)
      void data
      await studio.refresh()
    } catch (error) {
      studio.setNotice(error instanceof Error ? error.message : "Gradient failed")
    }
  }

  return (
    <div className="grid max-w-xl gap-4">
      <Note>The same command can also go to every selected bulb from the other pages. Here each bulb gets its own point between two colors, so two lamps can form a gradient.</Note>
      <div className="h-16 rounded-lg border border-border" style={{ background: `linear-gradient(90deg, ${start}, ${end})` }} />
      <div className="flex gap-4">
        <label className="grid gap-1 text-sm text-muted-foreground">
          Start
          <input type="color" value={start} onChange={(event) => setStart(event.target.value)} className="h-10 w-16 bg-transparent" />
        </label>
        <label className="grid gap-1 text-sm text-muted-foreground">
          End
          <input type="color" value={end} onChange={(event) => setEnd(event.target.value)} className="h-10 w-16 bg-transparent" />
        </label>
      </div>
      <div className="flex gap-2 text-xs text-muted-foreground">
        <span className="size-3 rounded-full" style={{ background: rgbCss(parse(start).r, parse(start).g, parse(start).b) }} />
        {studio.selected.length < 2 ? "Waiting for two selected bulbs" : studio.selected.join(" → ")}
      </div>
      <Range label="Dimming" min={10} max={100} value={dimming} onValueChange={setDimming} />
      <Button onClick={apply} disabled={studio.busy}>Apply gradient</Button>
    </div>
  )
}
