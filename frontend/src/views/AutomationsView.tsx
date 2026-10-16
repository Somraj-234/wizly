import { useEffect, useRef, useState, type ReactNode } from "react"
import { Button, Card, Field, Input, Note, Range, Toggle } from "../components/ui"
import { SWATCHES } from "../lib/color"
import { rgbCss } from "../lib/utils"
import { api } from "../lib/api"
import { cache } from "../lib/storage"
import type { ActionConfig, ActionKind, Automation, Pilot, RhythmPoint, Scene, SensorKey, SensorRule } from "../lib/types"
import { useStudio } from "../studio"

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

const KIND_INFO: Record<Automation["kind"], { label: string; blurb: string }> = {
  schedule: { label: "Daily schedule", blurb: "Runs once a day at a clock time you set, every day of the week." },
  sun: { label: "Sunrise / sunset", blurb: "Runs at sunrise or sunset for a latitude and longitude, worked out on this computer — no internet call needed." },
  rhythm: { label: "Rhythm (several times a day)", blurb: "A sequence of steps through the day, e.g. soft light in the morning, bright at noon, warm in the evening, off at night. Add as many steps as you like." },
}

function minutesFromTime(value: string): number {
  const [h, m] = value.split(":").map((part) => Number(part))
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}

function timeFromMinutes(value: number): string {
  const h = Math.floor(value / 60) % 24
  const m = value % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function describeAction(action: ActionKind | undefined, params: Pilot | undefined, scenes: Scene[]): string {
  const dim = params?.dimming ? ` at ${params.dimming}%` : ""
  switch (action) {
    case "off":
      return "turn off"
    case "toggle":
      return "toggle on/off"
    case "scene": {
      const scene = scenes.find((item) => item.id === params?.sceneId)
      return `run "${scene?.name ?? `mode ${params?.sceneId ?? "?"}`}"${dim}`
    }
    case "color":
      return params?.r != null ? `set color rgb(${params.r}, ${params.g ?? 0}, ${params.b ?? 0})${dim}` : `set a color${dim}`
    case "white":
      return params?.temp ? `set white ${params.temp}K${dim}` : `set white${dim}`
    case "on":
    default:
      return `turn on${dim}`
  }
}

/** Shared control for "what should happen" — used by schedules, sunrise/sunset,
 * each rhythm step, and the clap/motion/PIR sensors below. */
function ActionEditor({
  value,
  onChange,
  scenes,
  kelvinMin = 2200,
  kelvinMax = 6500,
  allowToggle = false,
}: {
  value: ActionConfig
  onChange: (next: ActionConfig) => void
  scenes: Scene[]
  kelvinMin?: number
  kelvinMax?: number
  allowToggle?: boolean
}) {
  const kinds: { id: ActionKind; label: string }[] = [
    { id: "on", label: "Turn on" },
    { id: "off", label: "Turn off" },
    ...(allowToggle ? [{ id: "toggle" as ActionKind, label: "Toggle on/off" }] : []),
    { id: "color", label: "Set color" },
    { id: "white", label: "Set white" },
    { id: "scene", label: "Run a light mode" },
  ]
  const params = value.params ?? {}

  function pick(kind: ActionKind) {
    if (kind === "scene") onChange({ kind, params: { sceneId: scenes[0]?.id ?? 1, dimming: 70 } })
    else if (kind === "white") onChange({ kind, params: { temp: 2700, dimming: 70 } })
    else if (kind === "color") onChange({ kind, params: { r: 255, g: 170, b: 80, dimming: 70 } })
    else if (kind === "on") onChange({ kind, params: { dimming: 70 } })
    else onChange({ kind, params: undefined })
  }

  function setParams(patch: Partial<Pilot>) {
    onChange({ ...value, params: { ...params, ...patch } })
  }

  const scene = scenes.find((item) => item.id === params.sceneId)

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {kinds.map((item) => (
          <Button key={item.id} type="button" size="sm" variant={value.kind === item.id ? "default" : "secondary"} onClick={() => pick(item.id)}>
            {item.label}
          </Button>
        ))}
      </div>
      {value.kind === "on" && (
        <Range label="Brightness" min={10} max={100} value={params.dimming ?? 70} onValueChange={(v) => setParams({ dimming: v })} />
      )}
      {value.kind === "color" && (
        <div className="grid gap-2">
          <div className="grid grid-cols-8 gap-2">
            {SWATCHES.filter((item) => item.rgb).map((swatch) => (
              <button
                key={swatch.name}
                type="button"
                title={swatch.name}
                aria-label={swatch.name}
                className="h-7 rounded-md border border-border"
                style={{ background: rgbCss(swatch.rgb!.r, swatch.rgb!.g, swatch.rgb!.b), outline: params.r === swatch.rgb!.r && params.g === swatch.rgb!.g && params.b === swatch.rgb!.b ? "2px solid var(--foreground)" : undefined }}
                onClick={() => setParams({ r: swatch.rgb!.r, g: swatch.rgb!.g, b: swatch.rgb!.b })}
              />
            ))}
          </div>
          <Range label="Brightness" min={10} max={100} value={params.dimming ?? 70} onValueChange={(v) => setParams({ dimming: v })} />
        </div>
      )}
      {value.kind === "white" && (
        <div className="grid gap-2">
          <Range label="Color temperature (K)" min={kelvinMin} max={kelvinMax} step={50} value={params.temp ?? 2700} onValueChange={(v) => setParams({ temp: v })} />
          <Range label="Brightness" min={10} max={100} value={params.dimming ?? 70} onValueChange={(v) => setParams({ dimming: v })} />
        </div>
      )}
      {value.kind === "scene" && (
        <div className="grid gap-2">
          {scenes.length === 0 ? (
            <Note>No light modes loaded yet. Open the Modes tab once so the list of scene ids loads, then come back here.</Note>
          ) : (
            <select
              className="h-9 rounded-md border border-input bg-card px-3 text-sm"
              value={params.sceneId ?? scenes[0]?.id}
              onChange={(event) => setParams({ sceneId: Number(event.target.value) })}
            >
              {scenes.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          )}
          {scene?.dimming !== false && <Range label="Brightness" min={10} max={100} value={params.dimming ?? 70} onValueChange={(v) => setParams({ dimming: v })} />}
          {scene?.speed && <Range label="Speed" min={20} max={200} value={params.speed ?? 100} onValueChange={(v) => setParams({ speed: v })} />}
        </div>
      )}
    </div>
  )
}

function SensorCard({
  sensorKey,
  title,
  description,
  value,
  onChange,
  scenes,
  selectedCount,
  onUseSelected,
  children,
}: {
  sensorKey: SensorKey
  title: string
  description: string
  value: SensorRule
  onChange: (next: SensorRule) => void
  scenes: Scene[]
  selectedCount: number
  onUseSelected: () => void
  children?: ReactNode
}) {
  return (
    <Card className="grid gap-3 p-4">
      <Toggle checked={value.enabled} onCheckedChange={(enabled) => onChange({ ...value, enabled })} label={title} />
      <Note>{description}</Note>
      {value.enabled && (
        <div className="grid gap-3 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              Applies to: {value.ips.length ? value.ips.join(", ") : "nothing yet — select bulbs in Lights, then use the button"}
            </span>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={onUseSelected}>
            Use the {selectedCount || "no"} bulb{selectedCount === 1 ? "" : "s"} selected in Lights
          </Button>
          <div>
            <p className="mb-2 text-sm text-muted-foreground">When {sensorKey === "pir" ? "motion is reported" : "this fires"}:</p>
            <ActionEditor
              value={{ kind: value.action, params: value.params }}
              onChange={(next) => onChange({ ...value, action: next.kind, params: next.params })}
              scenes={scenes}
              allowToggle
            />
          </div>
          {children}
        </div>
      )}
    </Card>
  )
}

export function AutomationsView() {
  const studio = useStudio()
  const [items, setItems] = useState<Automation[]>([])
  const [name, setName] = useState("Evening")
  const [kind, setKind] = useState<Automation["kind"]>("schedule")
  const [time, setTime] = useState("19:00")
  const [event, setEvent] = useState<"sunrise" | "sunset">("sunset")
  const [lat, setLat] = useState("28.61")
  const [lon, setLon] = useState("77.21")
  const [offsetMin, setOffsetMin] = useState("0")
  const [action, setAction] = useState<ActionConfig>({ kind: "on", params: { dimming: 60, temp: 2700 } })
  const [rhythm, setRhythm] = useState<{ time: string; action: ActionConfig }[]>([
    { time: "07:00", action: { kind: "white", params: { temp: 3500, dimming: 70 } } },
    { time: "12:00", action: { kind: "white", params: { temp: 5000, dimming: 100 } } },
    { time: "18:00", action: { kind: "white", params: { temp: 2700, dimming: 40 } } },
    { time: "22:00", action: { kind: "off" } },
  ])

  const [sensors, setSensorsState] = useState<Record<SensorKey, SensorRule>>(cache.sensors())
  const clapHits = useRef<number[]>([])
  const videoRef = useRef<HTMLVideoElement>(null)
  const lastFrame = useRef<Uint8ClampedArray | null>(null)
  const studioRef = useRef(studio)
  studioRef.current = studio
  const sensorsRef = useRef(sensors)
  sensorsRef.current = sensors

  function setSensors(next: Record<SensorKey, SensorRule>) {
    setSensorsState(next)
    cache.saveSensors(next)
  }

  function setSensor(key: SensorKey, rule: SensorRule) {
    setSensors({ ...sensorsRef.current, [key]: rule })
  }

  useEffect(() => {
    api.automations().then((data) => setItems(data.automations)).catch((error: Error) => studio.setNotice(`Could not load automations: ${error.message}`))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function persist(next: Automation[]) {
    setItems(next)
    try {
      await api.saveAutomations(next)
    } catch (error) {
      studio.setNotice(error instanceof Error ? `Could not save automations: ${error.message}` : "Could not save automations.")
    }
  }

  function add() {
    if (!name.trim()) {
      studio.setNotice("Give the automation a name first.")
      return
    }
    if (!studio.selected.length) {
      studio.setNotice("Select at least one bulb in Lights before saving an automation.")
      return
    }
    if (kind === "sun" && (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon)))) {
      studio.setNotice("Latitude and longitude need to be numbers.")
      return
    }
    if (kind === "rhythm" && rhythm.length === 0) {
      studio.setNotice("Add at least one step to the rhythm.")
      return
    }
    const automation: Automation = {
      id: crypto.randomUUID(),
      name: name.trim(),
      enabled: true,
      kind,
      ips: studio.selected,
      days: [0, 1, 2, 3, 4, 5, 6],
      time: kind === "schedule" ? time : undefined,
      event: kind === "sun" ? event : undefined,
      latitude: kind === "sun" ? Number(lat) : undefined,
      longitude: kind === "sun" ? Number(lon) : undefined,
      offsetMin: kind === "sun" ? Number(offsetMin) || 0 : undefined,
      action: kind !== "rhythm" ? action.kind : undefined,
      params: kind !== "rhythm" ? action.params : undefined,
      points: kind === "rhythm"
        ? [...rhythm]
          .sort((a, b) => minutesFromTime(a.time) - minutesFromTime(b.time))
          .map((step): RhythmPoint => ({ minutes: minutesFromTime(step.time), action: step.action.kind, params: step.action.params }))
        : undefined,
    }
    persist([...items, automation]).catch((error: Error) => studio.setNotice(error.message))
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      studio.setNotice("This browser does not support geolocation. Type latitude and longitude manually.")
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toFixed(4))
        setLon(position.coords.longitude.toFixed(4))
      },
      (error) => studio.setNotice(`Could not get your location: ${error.message}. Type latitude and longitude manually.`),
    )
  }

  function updateRhythmStep(index: number, patch: Partial<{ time: string; action: ActionConfig }>) {
    setRhythm(rhythm.map((step, i) => (i === index ? { ...step, ...patch } : step)))
  }

  function removeRhythmStep(index: number) {
    setRhythm(rhythm.filter((_, i) => i !== index))
  }

  function addRhythmStep() {
    setRhythm([...rhythm, { time: "12:00", action: { kind: "on", params: { dimming: 70 } } }])
  }

  async function applyAction(rule: SensorRule, targets: string[]) {
    if (!targets.length) {
      studio.setNotice("A sensor automation is enabled but has no bulbs assigned. Open Automations and press \"Use the bulbs selected in Lights\".")
      return
    }
    try {
      if (rule.action === "toggle") {
        const on = studioRef.current.bulbs.some((bulb) => targets.includes(bulb.ip) && bulb.pilot?.state)
        await studioRef.current.pilot({ state: !on }, targets)
      } else if (rule.action === "off") {
        await studioRef.current.pilot({ state: false }, targets)
      } else {
        await studioRef.current.pilot({ state: true, ...rule.params }, targets)
      }
    } catch (error) {
      studioRef.current.setNotice(error instanceof Error ? error.message : "The sensor automation could not reach a bulb.")
    }
  }

  useEffect(() => {
    if (!sensors.clap.enabled) return
    if (!window.isSecureContext) {
      studio.setNotice("Clap detection needs a secure context (https:// or localhost) for microphone access.")
      return
    }
    let stream: MediaStream | null = null
    let context: AudioContext | null = null
    let frame = 0
    let cancelled = false
    navigator.mediaDevices.getUserMedia({ audio: true }).then(async (mic) => {
      if (cancelled) {
        mic.getTracks().forEach((track) => track.stop())
        return
      }
      stream = mic
      context = new AudioContext()
      if (context.state === "suspended") await context.resume()
      const analyser = context.createAnalyser()
      analyser.fftSize = 1024
      context.createMediaStreamSource(mic).connect(analyser)
      const samples = new Uint8Array(analyser.fftSize)
      const loop = () => {
        analyser.getByteTimeDomainData(samples)
        let energy = 0
        for (const sample of samples) {
          const delta = sample - 128
          energy += delta * delta
        }
        energy = Math.sqrt(energy / samples.length)
        const now = performance.now()
        if (energy > 28) {
          const recent = clapHits.current.filter((hit) => now - hit < 900)
          recent.push(now)
          clapHits.current = recent
          if (recent.length >= 2) {
            clapHits.current = []
            const rule = sensorsRef.current.clap
            const targets = rule.ips.length ? rule.ips : studioRef.current.selected
            void applyAction(rule, targets)
          }
        }
        frame = requestAnimationFrame(loop)
      }
      frame = requestAnimationFrame(loop)
    }).catch((error: Error) => {
      const hint = error.name === "NotAllowedError"
        ? "Microphone access was blocked. Allow the microphone for this site in your browser's address-bar settings, then turn Clap back on."
        : error.name === "NotFoundError"
          ? "No microphone was found on this computer."
          : error.message
      studioRef.current.setNotice(hint)
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach((track) => track.stop())
      void context?.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sensors.clap.enabled])

  useEffect(() => {
    if (!sensors.motion.enabled) return
    if (!window.isSecureContext) {
      studio.setNotice("Camera motion detection needs a secure context (https:// or localhost) for camera access.")
      return
    }
    let timer = 0
    let stream: MediaStream | null = null
    navigator.mediaDevices.getUserMedia({ video: { width: 64, height: 48 } }).then(async (camera) => {
      stream = camera
      if (!videoRef.current) return
      videoRef.current.srcObject = camera
      await videoRef.current.play()
      const canvas = document.createElement("canvas")
      canvas.width = 32
      canvas.height = 24
      const context = canvas.getContext("2d", { willReadFrequently: true })
      timer = window.setInterval(() => {
        if (!context || !videoRef.current) return
        context.drawImage(videoRef.current, 0, 0, 32, 24)
        const frame = context.getImageData(0, 0, 32, 24).data
        const previous = lastFrame.current
        lastFrame.current = frame
        if (!previous) return
        let diff = 0
        for (let i = 0; i < frame.length; i += 16) diff += Math.abs((frame[i] ?? 0) - (previous[i] ?? 0))
        if (diff / (frame.length / 16) > 18) {
          const rule = sensorsRef.current.motion
          const targets = rule.ips.length ? rule.ips : studioRef.current.selected
          void applyAction(rule, targets)
        }
      }, 400)
    }).catch((error: Error) => {
      const hint = error.name === "NotAllowedError"
        ? "Camera access was blocked. Allow the camera for this site in your browser's address-bar settings, then turn Camera movement back on."
        : error.name === "NotFoundError"
          ? "No camera was found on this computer."
          : error.message
      studioRef.current.setNotice(hint)
    })
    return () => {
      window.clearInterval(timer)
      stream?.getTracks().forEach((track) => track.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sensors.motion.enabled])

  useEffect(() => {
    if (!sensors.pir.enabled) return
    const seen = new Set<string>()
    const timer = window.setInterval(() => {
      for (const bulb of studioRef.current.bulbs) {
        if (bulb.pilot?.src !== "pir") continue
        const key = `${bulb.ip}:${bulb.pilot.dimming}:${bulb.pilot.state}`
        if (seen.has(key)) continue
        seen.add(key)
        const rule = sensorsRef.current.pir
        const targets = rule.ips.length ? rule.ips : [bulb.ip]
        void applyAction(rule, targets)
      }
    }, 2000)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sensors.pir.enabled])

  return (
    <div className="grid gap-4">
      <Note>
        Schedules, sunrise/sunset, and rhythms run inside the Python process, so they still fire with this browser tab closed.
        Clap, camera movement, and the built-in motion sensor (PIR) need this tab open, because the microphone, camera, and the
        short sensor pulse a bulb reports all live in the browser. A bulb's own schedule memory (setSchd) is not used here —
        the fields WiZ expects for that were not in the documentation this app was built from.
      </Note>

      <Card className="grid gap-3 p-4">
        <Field label="Name"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(KIND_INFO) as Automation["kind"][]).map((item) => (
              <Button key={item} type="button" size="sm" variant={kind === item ? "default" : "secondary"} onClick={() => setKind(item)}>{KIND_INFO[item].label}</Button>
            ))}
          </div>
          <Note>{KIND_INFO[kind].blurb}</Note>
        </div>

        {kind === "schedule" && (
          <Field label="Time"><Input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></Field>
        )}

        {kind === "sun" && (
          <div className="grid gap-3">
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={event === "sunrise" ? "default" : "secondary"} onClick={() => setEvent("sunrise")}>Sunrise</Button>
              <Button type="button" size="sm" variant={event === "sunset" ? "default" : "secondary"} onClick={() => setEvent("sunset")}>Sunset</Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Field label="Latitude"><Input value={lat} onChange={(event) => setLat(event.target.value)} /></Field>
              <Field label="Longitude"><Input value={lon} onChange={(event) => setLon(event.target.value)} /></Field>
              <Field label="Offset (minutes)"><Input type="number" value={offsetMin} onChange={(event) => setOffsetMin(event.target.value)} /></Field>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={useMyLocation}>Use my location</Button>
            <Note>Offset shifts the trigger from the exact event — e.g. -30 fires half an hour before sunset, +15 fires fifteen minutes after.</Note>
          </div>
        )}

        {kind !== "rhythm" ? (
          <div>
            <p className="mb-2 text-sm text-muted-foreground">What should happen:</p>
            <ActionEditor value={action} onChange={setAction} scenes={studio.scenes} />
          </div>
        ) : (
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">Steps, in order of time of day:</p>
            {rhythm.map((step, index) => (
              <Card key={index} className="grid gap-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <Input type="time" value={step.time} className="w-32" onChange={(event) => updateRhythmStep(index, { time: event.target.value })} />
                  <Button type="button" size="sm" variant="outline" onClick={() => removeRhythmStep(index)}>Remove step</Button>
                </div>
                <ActionEditor value={step.action} onChange={(next) => updateRhythmStep(index, { action: next })} scenes={studio.scenes} />
              </Card>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={addRhythmStep}>Add a step</Button>
          </div>
        )}

        <Note>Applies to the {studio.selected.length || "no"} bulb{studio.selected.length === 1 ? "" : "s"} currently selected in Lights.</Note>
        <Button onClick={add}>Save for selected bulbs</Button>
      </Card>

      {items.length === 0 && <Note>No automations saved yet.</Note>}
      {items.map((item) => (
        <Card key={item.id} className="grid gap-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <strong>{item.name}</strong>
              <p className="text-sm text-muted-foreground">
                {KIND_INFO[item.kind].label}
                {item.kind === "schedule" && ` · every day at ${item.time}`}
                {item.kind === "sun" && ` · ${item.event} at ${item.latitude}, ${item.longitude}${item.offsetMin ? ` (offset ${item.offsetMin}m)` : ""}`}
                {item.kind === "rhythm" && ` · ${item.points?.length ?? 0} step${(item.points?.length ?? 0) === 1 ? "" : "s"}`}
                {" "}· {item.ips.join(", ") || "no bulbs"}
              </p>
              {item.kind !== "rhythm" ? (
                <p className="text-sm">→ {describeAction(item.action, item.params, studio.scenes)}</p>
              ) : (
                <ul className="mt-1 grid gap-0.5 text-sm">
                  {(item.points ?? []).map((point, index) => (
                    <li key={index}>{timeFromMinutes(point.minutes)} → {describeAction(point.action, point.params, studio.scenes)}</li>
                  ))}
                </ul>
              )}
              <p className="mt-1 text-xs text-muted-foreground">{item.days.map((day) => DAYS[day]).join(" ")}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Toggle checked={item.enabled} label="On" onCheckedChange={(enabled) => persist(items.map((row) => row.id === item.id ? { ...row, enabled } : row))} />
              <Button size="sm" variant="outline" onClick={() => persist(items.filter((row) => row.id !== item.id))}>Delete</Button>
            </div>
          </div>
        </Card>
      ))}

      <h3 className="mt-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Sensors (need this tab open)</h3>

      <SensorCard
        sensorKey="clap"
        title="Double clap"
        description="Listens through this computer's microphone for two sharp sounds within about a second, then runs the action below."
        value={sensors.clap}
        onChange={(rule) => setSensor("clap", rule)}
        scenes={studio.scenes}
        selectedCount={studio.selected.length}
        onUseSelected={() => setSensor("clap", { ...sensors.clap, ips: studio.selected })}
      />

      <SensorCard
        sensorKey="motion"
        title="Camera movement"
        description="Watches this computer's camera for a frame-to-frame change, then runs the action below. Nothing is recorded or uploaded."
        value={sensors.motion}
        onChange={(rule) => setSensor("motion", rule)}
        scenes={studio.scenes}
        selectedCount={studio.selected.length}
        onUseSelected={() => setSensor("motion", { ...sensors.motion, ips: studio.selected })}
      >
        <video ref={videoRef} muted playsInline className="h-24 w-40 rounded-md bg-black" />
      </SensorCard>

      <SensorCard
        sensorKey="pir"
        title="Built-in motion sensor (PIR)"
        description={'Some WiZ bulbs or accessories report src: "pir" in their status when their own passive-infrared sensor sees movement. When that happens, this runs the action below — by default on the same bulb, or on the bulbs you assign below if you want one sensor to control other lights.'}
        value={sensors.pir}
        onChange={(rule) => setSensor("pir", rule)}
        scenes={studio.scenes}
        selectedCount={studio.selected.length}
        onUseSelected={() => setSensor("pir", { ...sensors.pir, ips: studio.selected })}
      />

      {!window.isSecureContext && (
        <Note>This page is not running on https:// or localhost, so the browser will refuse microphone and camera access — Clap and Camera movement will not be able to turn on.</Note>
      )}
    </div>
  )
}
