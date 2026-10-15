import { Moon, Sun } from "lucide-react"
import { useState } from "react"
import { BulbFigure } from "./components/BulbFigure"
import { Button, Note, TooltipProvider } from "./components/ui"
import type { Rgb } from "./lib/color"
import { kelvinToRgb } from "./lib/utils"
import { cache } from "./lib/storage"
import type { ViewId } from "./lib/types"
import { StudioProvider, useStudio } from "./studio"
import { AutomationsView } from "./views/AutomationsView"
import { ColorView } from "./views/ColorView"
import { GradientView } from "./views/GradientView"
import { HardwareView } from "./views/HardwareView"
import { LightsView } from "./views/LightsView"
import { MediaView } from "./views/MediaView"
import { MusicView } from "./views/MusicView"
import { NearbyView } from "./views/NearbyView"
import { PresetsView } from "./views/PresetsView"
import { ScenesView } from "./views/ScenesView"
import { SecurityView } from "./views/SecurityView"

const NAV: { id: ViewId; label: string }[] = [
  { id: "lights", label: "Lights" },
  { id: "color", label: "Color" },
  { id: "scenes", label: "Modes" },
  { id: "gradient", label: "Gradient" },
  { id: "music", label: "Music" },
  { id: "media", label: "Media" },
  { id: "presets", label: "Presets" },
  { id: "auto", label: "Automations" },
  { id: "security", label: "Lock" },
  { id: "nearby", label: "Nearby" },
  { id: "hardware", label: "Hardware" },
]

function lampColor(studio: ReturnType<typeof useStudio>): { color: Rgb; lit: boolean } {
  if (studio.glow) return { color: studio.glow, lit: true }
  const bulb = studio.bulbs.find((item) => studio.selected.includes(item.ip)) ?? studio.bulbs[0]
  const pilot = bulb?.pilot
  if (!pilot || pilot.state === false) return { color: { r: 255, g: 176, b: 96 }, lit: false }
  if (pilot.r != null || pilot.g != null || pilot.b != null) {
    return { color: { r: pilot.r ?? 0, g: pilot.g ?? 0, b: pilot.b ?? 0 }, lit: true }
  }
  if (pilot.temp) return { color: kelvinToRgb(pilot.temp), lit: true }
  return { color: { r: 255, g: 214, b: 140 }, lit: true }
}

function Shell() {
  const studio = useStudio()
  const [view, setView] = useState<ViewId>("lights")
  const [dark, setDark] = useState(cache.theme() === "dark")
  const lamp = lampColor(studio)

  function toggleTheme() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle("dark", next)
    cache.saveTheme(next ? "dark" : "light")
  }

  return (
    <div className="mx-auto grid min-h-screen max-w-6xl gap-6 px-4 py-6 md:grid-cols-[200px_1fr] md:px-6">
      <aside className="flex flex-col gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Wizly</p>
          <h1 className="text-2xl font-semibold tracking-tight">Lights</h1>
        </div>
        <nav className="flex gap-1 overflow-x-auto md:flex-col">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={`rounded-md px-3 py-2 text-left text-sm ${view === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto flex items-center justify-between">
          <Button variant="ghost" size="icon" aria-label="Toggle color theme" onClick={toggleTheme}>
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </Button>
          <span className="text-xs text-muted-foreground">{studio.selected.length} selected</span>
        </div>
      </aside>
      <main className="grid content-start items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid content-start gap-4">
        {studio.notice && <p className="rounded-md border border-border bg-card px-3 py-2 text-sm">{studio.notice}</p>}
        {studio.locked && view !== "security" && <Note>The API is locked. Open Lock and enter the PIN if a control is refused.</Note>}
        {view === "lights" && <LightsView />}
        {view === "color" && <ColorView />}
        {view === "scenes" && <ScenesView />}
        {view === "gradient" && <GradientView />}
        {view === "music" && <MusicView />}
        {view === "media" && <MediaView />}
        {view === "presets" && <PresetsView />}
        {view === "auto" && <AutomationsView />}
        {view === "security" && <SecurityView />}
        {view === "nearby" && <NearbyView />}
        {view === "hardware" && <HardwareView />}
        </div>
        <div className="sticky top-6">
          <BulbFigure color={lamp.color} lit={lamp.lit} theme={dark ? "dark" : "light"} />
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <TooltipProvider>
      <StudioProvider>
        <Shell />
      </StudioProvider>
    </TooltipProvider>
  )
}
