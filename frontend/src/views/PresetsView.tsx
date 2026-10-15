import { useState } from "react"
import { Button, Card, Input, Note } from "../components/ui"
import { cache } from "../lib/storage"
import type { Pilot, Preset } from "../lib/types"
import { useStudio } from "../studio"

export function PresetsView() {
  const studio = useStudio()
  const [presets, setPresets] = useState<Preset[]>(cache.presets())
  const [name, setName] = useState("")
  const [mode, setMode] = useState<"warm" | "day" | "off" | "current">("warm")

  function paramsFor(): Pilot {
    if (mode === "off") return { state: false }
    if (mode === "day") return { state: true, temp: 5000, dimming: 80 }
    if (mode === "current") {
      const bulb = studio.bulbs.find((item) => item.ip === studio.selected[0])
      const pilot = bulb?.pilot
      if (!pilot) return { state: true, dimming: 70 }
      const next: Pilot = { state: Boolean(pilot.state), dimming: pilot.dimming }
      if (pilot.sceneId) next.sceneId = pilot.sceneId
      else if (pilot.temp) next.temp = pilot.temp
      else if (pilot.r != null) {
        next.r = pilot.r
        next.g = pilot.g
        next.b = pilot.b
      }
      if (pilot.speed) next.speed = pilot.speed
      return next
    }
    return { state: true, temp: 2700, dimming: 40 }
  }

  function save() {
    if (!name.trim()) return
    const next = [...presets, { id: crypto.randomUUID(), name: name.trim(), ips: studio.selected, params: paramsFor() }]
    setPresets(next)
    cache.savePresets(next)
    setName("")
  }

  return (
    <div className="grid gap-4">
      <Note>A preset is a named mix of bulbs and a pilot. It is stored in this browser and sent with setPilot when you apply it.</Note>
      <Card className="grid gap-3 p-4">
        <Input value={name} placeholder="Preset name" onChange={(event) => setName(event.target.value)} />
        <div className="flex flex-wrap gap-2">
          {(["warm", "day", "off", "current"] as const).map((item) => (
            <Button key={item} size="sm" variant={mode === item ? "default" : "secondary"} onClick={() => setMode(item)}>{item}</Button>
          ))}
        </div>
        <Button onClick={save}>Save preset for {studio.selected.length || "no"} selected bulb{studio.selected.length === 1 ? "" : "s"}</Button>
      </Card>
      {presets.map((preset) => (
        <Card key={preset.id} className="flex items-center justify-between gap-3 p-4">
          <div>
            <strong>{preset.name}</strong>
            <p className="text-sm text-muted-foreground">{preset.ips.join(", ") || "Uses the current selection"}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => studio.pilot(preset.params, preset.ips.length ? preset.ips : undefined)}>Apply</Button>
            <Button size="sm" variant="outline" onClick={() => {
              const next = presets.filter((item) => item.id !== preset.id)
              setPresets(next)
              cache.savePresets(next)
            }}>Delete</Button>
          </div>
        </Card>
      ))}
    </div>
  )
}
