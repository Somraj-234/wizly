import { useEffect, useRef, useState } from "react"
import { Button, Note, Toggle } from "../components/ui"
import { coverFromFile, sampleCanvas, type Rgb } from "../lib/color"
import { api } from "../lib/api"
import { rgbCss } from "../lib/utils"
import { useStudio } from "../studio"

export function MediaView() {
  const studio = useStudio()
  const videoRef = useRef<HTMLVideoElement>(null)
  const shareRef = useRef<HTMLVideoElement>(null)
  const [colors, setColors] = useState<Rgb[]>([])
  const [follow, setFollow] = useState(true)
  const [cover, setCover] = useState<string | null>(null)
  const [url, setUrl] = useState("")
  const colorsRef = useRef(colors)
  colorsRef.current = colors
  const studioRef = useRef(studio)
  studioRef.current = studio

  useEffect(() => {
    if (!follow) return
    const timer = window.setInterval(() => {
      const color = colorsRef.current[0]
      if (!color || !studioRef.current.selected.length) return
      void studioRef.current.pilot({ state: true, dimming: 70, r: color.r, g: color.g, b: color.b })
    }, 700)
    return () => window.clearInterval(timer)
  }, [follow])

  useEffect(() => {
    let frame = 0
    const draw = () => {
      const video = videoRef.current
      if (video && video.readyState >= 2 && !video.paused) {
        try {
          setColors(sampleCanvas(video, video.videoWidth, video.videoHeight))
        } catch {
          studioRef.current.setNotice("This video cannot be sampled. Try a local file.")
        }
      }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [])

  async function loadFile(file: File) {
    const local = URL.createObjectURL(file)
    if (file.type.startsWith("video") && videoRef.current) {
      videoRef.current.src = local
      await videoRef.current.play()
    }
    if (file.type.startsWith("audio")) {
      const art = await coverFromFile(file)
      setCover(art)
      if (art) {
        const image = new Image()
        image.src = art
        await image.decode()
        setColors(sampleCanvas(image, image.naturalWidth, image.naturalHeight))
      }
    }
    if (file.type.startsWith("image")) {
      const image = new Image()
      image.src = local
      await image.decode()
      setColors(sampleCanvas(image, image.naturalWidth, image.naturalHeight))
      setCover(local)
    }
  }

  async function fromYoutube() {
    const data = await api.youtube(url)
    setColors(data.colors)
  }

  async function shareTab() {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
    if (!shareRef.current) return
    shareRef.current.srcObject = stream
    await shareRef.current.play()
    const timer = window.setInterval(() => {
      const video = shareRef.current
      if (!video) return
      try {
        setColors(sampleCanvas(video, video.videoWidth, video.videoHeight))
      } catch {
        studio.setNotice("The shared picture could not be read.")
      }
    }, 500)
    stream.getVideoTracks()[0]?.addEventListener("ended", () => window.clearInterval(timer))
  }

  return (
    <div className="grid gap-4">
      <Note>
        A YouTube embed cannot be read for colors. Paste a link to use its thumbnail, play a local file, or share the browser tab the video is already playing in.
      </Note>
      <video ref={videoRef} controls className="max-h-64 w-full rounded-lg bg-black" />
      <video ref={shareRef} muted className="hidden" />
      <input type="file" accept="video/*,audio/*,image/*" onChange={(event) => {
        const file = event.target.files?.[0]
        if (file) loadFile(file).catch((error: Error) => studio.setNotice(error.message))
      }} />
      <div className="flex flex-wrap gap-2">
        <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="YouTube link" className="h-9 min-w-64 flex-1 rounded-md border border-input bg-card px-3 text-sm" />
        <Button variant="secondary" onClick={() => fromYoutube().catch((error: Error) => studio.setNotice(error.message))}>Thumbnail colors</Button>
        <Button variant="outline" onClick={() => shareTab().catch((error: Error) => studio.setNotice(error.message))}>Share a tab</Button>
      </div>
      {cover && <img src={cover} alt="Artwork" className="h-28 w-28 rounded-lg object-cover" />}
      <div className="flex gap-2">
        {colors.map((color) => (
          <button key={rgbCss(color.r, color.g, color.b)} type="button" className="h-10 flex-1 rounded-md border border-border" style={{ background: rgbCss(color.r, color.g, color.b) }} onClick={() => studio.pilot({ state: true, dimming: 70, r: color.r, g: color.g, b: color.b })} />
        ))}
      </div>
      <Toggle checked={follow} onCheckedChange={setFollow} label="Keep the selected bulbs on the strongest color" />
    </div>
  )
}
