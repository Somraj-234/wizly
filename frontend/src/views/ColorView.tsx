import { useCallback, useState } from "react"
import { ColorStudio } from "../components/ColorStudio"
import { Button, Note, Range } from "../components/ui"
import { api } from "../lib/api"
import { useStudio } from "../studio"

export function ColorView() {
  const studio = useStudio()
  const bounds = studio.bulbs.filter((bulb) => studio.selected.includes(bulb.ip)).map((bulb) => bulb.kelvin).find(Boolean)
  const min = bounds?.min ?? 2200
  const max = bounds?.max ?? 6500
  const [ratio, setRatio] = useState(50)
  const send = useCallback((params: Record<string, number | boolean>) => {
    void studio.pilot(params)
  }, [studio])

  async function fade(start: number, end: number) {
    if (!studio.selected.length) {
      studio.setNotice("Select at least one bulb.")
      return
    }
    try {
      const data = await api.fade(studio.selected, start, end, 1400)
      studio.setNotice(null)
      await studio.refresh()
      void data
    } catch (error) {
      studio.setNotice(error instanceof Error ? error.message : "Fade failed")
    }
  }

  return (
    <div className="grid gap-4">
      <Note>
        Color sends r, g, and b. White sends temp in kelvin, clamped to the range from getModelConfig or getUserConfig when the bulb reported one. Dimming stays in 10–100.
      </Note>
      <ColorStudio kelvinMin={min} kelvinMax={max} onPilot={send} onPreview={studio.setGlow} />
      <div className="grid gap-3 rounded-lg border border-border p-4">
        <Range label="Dual-zone ratio" min={0} max={100} value={ratio} onValueChange={setRatio} />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => studio.pilot({ ratio })}>Apply ratio</Button>
          <Button variant="outline" onClick={() => fade(10, 80)}>Fade in</Button>
          <Button variant="outline" onClick={() => fade(80, 10)}>Fade out</Button>
          <Button variant="outline" onClick={() => studio.pilot({ state: false })}>Turn off</Button>
        </div>
      </div>
    </div>
  )
}
