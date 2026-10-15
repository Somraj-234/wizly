import { useState } from "react"
import { Badge, Button, Note, Range } from "../components/ui"
import { useStudio } from "../studio"

export function ScenesView() {
  const studio = useStudio()
  const [speed, setSpeed] = useState(100)
  const [dimming, setDimming] = useState(70)
  const [filter, setFilter] = useState<"all" | "pro" | "more">("pro")
  const scenes = studio.scenes.filter((scene) => {
    if (filter === "pro") return scene.source === "pro"
    if (filter === "more") return scene.source !== "pro"
    return true
  })

  return (
    <div className="grid gap-4">
      <Note>
        These are the light modes from the WiZ Pro table (ids 1–33). Extra ids come from WiZ’s local library and from pywizlight, and a bulb ignores a mode it does not support.
      </Note>
      <div className="flex flex-wrap gap-2">
        {(["pro", "more", "all"] as const).map((item) => (
          <Button key={item} size="sm" variant={filter === item ? "default" : "secondary"} onClick={() => setFilter(item)}>
            {item === "pro" ? "WiZ modes" : item === "more" ? "Extra modes" : "All"}
          </Button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Range label="Speed (dynamic modes)" min={20} max={200} value={speed} onValueChange={setSpeed} />
        <Range label="Dimming" min={10} max={100} value={dimming} onValueChange={setDimming} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {scenes.map((scene) => (
          <button
            key={scene.id}
            type="button"
            className="rounded-lg border border-border bg-card p-3 text-left"
            onClick={() => studio.pilot({
              state: true,
              sceneId: scene.id,
              ...(scene.dimming ? { dimming } : {}),
              ...(scene.speed ? { speed } : {}),
            })}
          >
            <span className="flex items-center justify-between gap-2">
              <strong className="text-sm">{scene.name}</strong>
              <Badge>{scene.id}</Badge>
            </span>
            <span className="mt-2 flex flex-wrap gap-1">
              {scene.speed && <Badge>Speed</Badge>}
              {scene.rgb && <Badge>Color</Badge>}
              {scene.tw && <Badge>Tunable</Badge>}
              {scene.dw && <Badge>Dim only</Badge>}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
