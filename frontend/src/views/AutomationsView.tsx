import { useEffect, useRef, useState } from "react"
import { Button, Card, Field, Input, Note, Toggle } from "../components/ui"
import { api } from "../lib/api"
import type { Automation } from "../lib/types"
import { useStudio } from "../studio"

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export function AutomationsView() {
  const studio = useStudio()
  const [items, setItems] = useState<Automation[]>([])
  const [name, setName] = useState("Evening")
  const [kind, setKind] = useState<Automation["kind"]>("schedule")
  const [time, setTime] = useState("19:00")
  const [event, setEvent] = useState<"sunrise" | "sunset">("sunset")
  const [lat, setLat] = useState("28.61")
  const [lon, setLon] = useState("77.21")
  const [clap, setClap] = useState(false)
  const [motion, setMotion] = useState(false)
  const [pir, setPir] = useState(false)
  const clapHits = useRef<number[]>([])
  const videoRef = useRef<HTMLVideoElement>(null)
  const lastFrame = useRef<Uint8ClampedArray | null>(null)
  const studioRef = useRef(studio)
  studioRef.current = studio

  useEffect(() => {
    api.automations().then((data) => setItems(data.automations)).catch(() => undefined)
  }, [])

  async function persist(next: Automation[]) {
    setItems(next)
    await api.saveAutomations(next)
  }

  function add() {
    const automation: Automation = {
      id: crypto.randomUUID(),
      name,
      enabled: true,
      kind,
      ips: studio.selected,
      days: [0, 1, 2, 3, 4, 5, 6],
      action: "on",
      params: kind === "rhythm" ? undefined : { state: true, temp: kind === "sun" && event === "sunrise" ? 3000 : 2700, dimming: 60 },
      time,
      event,
      latitude: Number(lat),
      longitude: Number(lon),
      offsetMin: 0,
      points: kind === "rhythm" ? [
        { minutes: 7 * 60, params: { state: true, temp: 3500, dimming: 70 } },
        { minutes: 12 * 60, params: { state: true, temp: 5000, dimming: 100 } },
        { minutes: 18 * 60, params: { state: true, temp: 2700, dimming: 40 } },
        { minutes: 22 * 60, params: { state: false } },
      ] : undefined,
    }
    persist([...items, automation]).catch((error: Error) => studio.setNotice(error.message))
  }

  useEffect(() => {
    if (!clap) return
    let stream: MediaStream | null = null
    let context: AudioContext | null = null
    let frame = 0
    let cancelled = false
    navigator.mediaDevices.getUserMedia({ audio: true }).then((mic) => {
      if (cancelled) {
        mic.getTracks().forEach((track) => track.stop())
        return
      }
      stream = mic
      context = new AudioContext()
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
            const current = studioRef.current
            const on = current.bulbs.some((bulb) => current.selected.includes(bulb.ip) && bulb.pilot?.state)
            void current.pilot({ state: !on })
          }
        }
        frame = requestAnimationFrame(loop)
      }
      frame = requestAnimationFrame(loop)
    }).catch((error: Error) => studioRef.current.setNotice(error.message))
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach((track) => track.stop())
      void context?.close()
    }
  }, [clap])

  useEffect(() => {
    if (!motion) return
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
        if (diff / (frame.length / 16) > 18) void studioRef.current.pilot({ state: true, dimming: 70, temp: 3000 })
      }, 400)
    }).catch((error: Error) => studioRef.current.setNotice(error.message))
    return () => {
      window.clearInterval(timer)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [motion])

  useEffect(() => {
    if (!pir) return
    const seen = new Set<string>()
    const timer = window.setInterval(() => {
      for (const bulb of studioRef.current.bulbs) {
        if (bulb.pilot?.src !== "pir") continue
        const key = `${bulb.ip}:${bulb.pilot.dimming}:${bulb.pilot.state}`
        if (seen.has(key)) continue
        seen.add(key)
        void studioRef.current.pilot({ state: true, dimming: 50, temp: 2700 }, [bulb.ip])
      }
    }, 2000)
    return () => window.clearInterval(timer)
  }, [pir])

  return (
    <div className="grid gap-4">
      <Note>
        Schedules, sunrise, and rhythms run in the Python process, so the browser can be closed. Clap, camera movement, and PIR watching need this tab open because the microphone, camera, and the short sensor pulse live here. Bulb-native schedule packets are not sent; the published setSchd fields were not in the docs we could read.
      </Note>
      <Card className="grid gap-3 p-4">
        <Field label="Name"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <div className="flex flex-wrap gap-2">
          {(["schedule", "sun", "rhythm"] as const).map((item) => (
            <Button key={item} size="sm" variant={kind === item ? "default" : "secondary"} onClick={() => setKind(item)}>{item}</Button>
          ))}
        </div>
        {kind === "schedule" && <Field label="Time"><Input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></Field>}
        {kind === "sun" && (
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="flex gap-2">
              <Button size="sm" variant={event === "sunrise" ? "default" : "secondary"} onClick={() => setEvent("sunrise")}>Sunrise</Button>
              <Button size="sm" variant={event === "sunset" ? "default" : "secondary"} onClick={() => setEvent("sunset")}>Sunset</Button>
            </div>
            <Field label="Latitude"><Input value={lat} onChange={(event) => setLat(event.target.value)} /></Field>
            <Field label="Longitude"><Input value={lon} onChange={(event) => setLon(event.target.value)} /></Field>
          </div>
        )}
        <Button onClick={add}>Save for selected bulbs</Button>
      </Card>
      {items.map((item) => (
        <Card key={item.id} className="flex items-center justify-between gap-3 p-4">
          <div>
            <strong>{item.name}</strong>
            <p className="text-sm text-muted-foreground">{item.kind} · {item.ips.join(", ") || "no bulbs"} · {item.days.map((day) => DAYS[day]).join(" ")}</p>
          </div>
          <div className="flex items-center gap-3">
            <Toggle checked={item.enabled} label="On" onCheckedChange={(enabled) => persist(items.map((row) => row.id === item.id ? { ...row, enabled } : row))} />
            <Button size="sm" variant="outline" onClick={() => persist(items.filter((row) => row.id !== item.id))}>Delete</Button>
          </div>
        </Card>
      ))}
      <Card className="grid gap-3 p-4">
        <Toggle checked={clap} onCheckedChange={setClap} label="Double clap toggles the selection" />
        <Toggle checked={motion} onCheckedChange={setMotion} label="Camera movement turns the selection on" />
        <Toggle checked={pir} onCheckedChange={setPir} label="When a bulb reports src pir, turn that bulb on" />
        <video ref={videoRef} muted playsInline className={motion ? "h-24 w-40 rounded-md bg-black" : "hidden"} />
      </Card>
    </div>
  )
}
