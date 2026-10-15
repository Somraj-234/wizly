import { useEffect, useRef, useState } from "react"
import { Button, Note, Range } from "../components/ui"
import { MUSIC_PALETTES, type Rgb } from "../lib/color"
import { rgbCss } from "../lib/utils"
import { useStudio } from "../studio"

type Source = "player" | "share" | "mic"

export function MusicView() {
  const studio = useStudio()
  const [palette, setPalette] = useState(0)
  const [dimming, setDimming] = useState(80)
  const [running, setRunning] = useState(false)
  const [source, setSource] = useState<Source>("player")
  const [level, setLevel] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceNode = useRef<MediaElementAudioSourceNode | null>(null)
  const studioRef = useRef(studio)
  studioRef.current = studio
  const fileUrl = useRef<string | null>(null)
  const index = useRef(0)
  const lastBeat = useRef(0)

  useEffect(() => {
    if (!running) return
    let frame = 0
    const tick = () => {
      const analyser = analyserRef.current
      if (analyser && studioRef.current.selected.length) {
        const bins = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(bins)
        let sum = 0
        for (const bin of bins) sum += bin
        const energy = sum / bins.length / 255
        setLevel(energy)
        const now = performance.now()
        if (energy > 0.18 && now - lastBeat.current > 160 && studioRef.current.selected.length) {
          lastBeat.current = now
          const colors = MUSIC_PALETTES[palette]?.colors ?? []
          const color: Rgb = colors[index.current % colors.length] ?? { r: 255, g: 255, b: 255 }
          index.current += 1
          const amount = Math.max(10, Math.min(100, Math.round(dimming * (0.45 + energy))))
          void studioRef.current.pilot({ state: true, dimming: amount, r: color.r, g: color.g, b: color.b })
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [running, palette, dimming])

  async function ensureContext() {
    if (!contextRef.current) contextRef.current = new AudioContext()
    if (contextRef.current.state === "suspended") await contextRef.current.resume()
    return contextRef.current
  }

  async function start() {
    const context = await ensureContext()
    if (!analyserRef.current) {
      const analyser = context.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser
    }
    const analyser = analyserRef.current
    if (source === "player") {
      const audio = audioRef.current
      if (!audio?.src) {
        studio.setNotice("Choose an audio file first. It plays through the speakers while the lights follow it.")
        return
      }
      if (!sourceNode.current) sourceNode.current = context.createMediaElementSource(audio)
      sourceNode.current.connect(analyser)
      analyser.connect(context.destination)
      await audio.play()
    } else if (source === "share") {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      const track = display.getAudioTracks()[0]
      if (!track) {
        studio.setNotice("Share a tab or screen and enable its audio. That is how the browser can hear the speakers.")
        display.getTracks().forEach((item) => item.stop())
        return
      }
      const node = context.createMediaStreamSource(new MediaStream([track]))
      node.connect(analyser)
    } else {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true })
      context.createMediaStreamSource(mic).connect(analyser)
    }
    setRunning(true)
  }

  function stop() {
    setRunning(false)
    audioRef.current?.pause()
    analyserRef.current?.disconnect()
    analyserRef.current = null
  }

  return (
    <div className="grid max-w-2xl gap-4">
      <Note>
        The WiZ app listens with the microphone, and some phones block that while the speaker is playing. This page can follow a file played here, or audio from a shared tab, so the speakers and the lights run together.
      </Note>
      <div className="flex flex-wrap gap-2">
        {(["player", "share", "mic"] as Source[]).map((item) => (
          <Button key={item} size="sm" variant={source === item ? "default" : "secondary"} onClick={() => setSource(item)} disabled={running}>
            {item === "player" ? "Play a file" : item === "share" ? "Share tab audio" : "Microphone"}
          </Button>
        ))}
      </div>
      <input
        type="file"
        accept="audio/*"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (!file || !audioRef.current) return
          if (fileUrl.current) URL.revokeObjectURL(fileUrl.current)
          fileUrl.current = URL.createObjectURL(file)
          audioRef.current.src = fileUrl.current
        }}
      />
      <audio ref={audioRef} controls className="w-full" />
      <div className="grid grid-cols-3 gap-2">
        {MUSIC_PALETTES.map((item, itemIndex) => (
          <button key={item.name} type="button" className={`rounded-lg border p-2 text-left text-sm ${palette === itemIndex ? "border-foreground" : "border-border"}`} onClick={() => setPalette(itemIndex)}>
            <span className="mb-2 flex gap-1">
              {item.colors.map((color) => <span key={rgbCss(color.r, color.g, color.b)} className="h-4 flex-1 rounded" style={{ background: rgbCss(color.r, color.g, color.b) }} />)}
            </span>
            {item.name}
          </button>
        ))}
      </div>
      <Range label="Intensity" min={10} max={100} value={dimming} onValueChange={setDimming} />
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full bg-primary" style={{ width: `${Math.round(level * 100)}%`, transition: "width 80ms linear" }} />
      </div>
      {running ? <Button variant="secondary" onClick={stop}>Stop sync</Button> : <Button onClick={() => start().catch((error: Error) => studio.setNotice(error.message))}>Start sync</Button>}
    </div>
  )
}
