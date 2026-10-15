export type Rgb = { r: number; g: number; b: number }

export const SWATCHES: { name: string; rgb?: Rgb; kelvin?: number }[] = [
  { name: "Candle", kelvin: 2200 },
  { name: "Warm", kelvin: 2700 },
  { name: "Soft", kelvin: 3000 },
  { name: "Neutral", kelvin: 4000 },
  { name: "Daylight", kelvin: 5000 },
  { name: "Cool", kelvin: 6500 },
  { name: "Red", rgb: { r: 255, g: 32, b: 32 } },
  { name: "Amber", rgb: { r: 255, g: 140, b: 20 } },
  { name: "Yellow", rgb: { r: 255, g: 214, b: 40 } },
  { name: "Lime", rgb: { r: 140, g: 220, b: 40 } },
  { name: "Green", rgb: { r: 20, g: 180, b: 80 } },
  { name: "Teal", rgb: { r: 16, g: 180, b: 170 } },
  { name: "Cyan", rgb: { r: 40, g: 200, b: 255 } },
  { name: "Blue", rgb: { r: 40, g: 90, b: 255 } },
  { name: "Indigo", rgb: { r: 70, g: 50, b: 220 } },
  { name: "Purple", rgb: { r: 150, g: 60, b: 230 } },
  { name: "Pink", rgb: { r: 255, g: 70, b: 150 } },
  { name: "White", rgb: { r: 255, g: 255, b: 255 } },
]

export const MUSIC_PALETTES: { name: string; colors: Rgb[] }[] = [
  { name: "Ocean", colors: [{ r: 0, g: 80, b: 255 }, { r: 0, g: 180, b: 220 }, { r: 20, g: 40, b: 160 }, { r: 80, g: 220, b: 255 }] },
  { name: "Romance", colors: [{ r: 255, g: 40, b: 80 }, { r: 255, g: 120, b: 40 }, { r: 180, g: 20, b: 60 }, { r: 255, g: 180, b: 140 }] },
  { name: "Sunset", colors: [{ r: 255, g: 90, b: 20 }, { r: 255, g: 40, b: 80 }, { r: 255, g: 180, b: 40 }, { r: 120, g: 30, b: 90 }] },
  { name: "Party", colors: [{ r: 255, g: 0, b: 80 }, { r: 0, g: 200, b: 255 }, { r: 140, g: 0, b: 255 }, { r: 255, g: 220, b: 0 }] },
  { name: "Forest", colors: [{ r: 20, g: 140, b: 50 }, { r: 80, g: 180, b: 40 }, { r: 10, g: 70, b: 40 }, { r: 180, g: 220, b: 80 }] },
  { name: "Club", colors: [{ r: 120, g: 0, b: 255 }, { r: 0, g: 80, b: 255 }, { r: 255, g: 0, b: 140 }, { r: 0, g: 0, b: 40 }] },
  { name: "Pastel", colors: [{ r: 255, g: 180, b: 190 }, { r: 180, g: 210, b: 255 }, { r: 190, g: 240, b: 190 }, { r: 255, g: 230, b: 170 }] },
  { name: "Mojito", colors: [{ r: 40, g: 200, b: 90 }, { r: 180, g: 255, b: 80 }, { r: 0, g: 140, b: 80 }, { r: 220, g: 255, b: 180 }] },
  { name: "Neon", colors: [{ r: 255, g: 0, b: 60 }, { r: 0, g: 255, b: 180 }, { r: 80, g: 0, b: 255 }, { r: 255, g: 240, b: 0 }] },
]

export function hsvToRgb(h: number, s: number, v: number): Rgb {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) }
}

export function rgbToHsv(red: number, green: number, blue: number) {
  const r = red / 255
  const g = green / 255
  const b = blue / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : d / max, v: max }
}

export function sampleCanvas(source: CanvasImageSource, width: number, height: number): Rgb[] {
  const canvas = document.createElement("canvas")
  const sample = 36
  canvas.width = sample
  canvas.height = sample
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) return []
  context.drawImage(source, 0, 0, width, height, 0, 0, sample, sample)
  const data = context.getImageData(0, 0, sample, sample).data
  const buckets = new Map<string, { rgb: Rgb; n: number }>()
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i] ?? 0
    const g = data[i + 1] ?? 0
    const b = data[i + 2] ?? 0
    if (r + g + b < 30) continue
    const key = `${r >> 4}-${g >> 4}-${b >> 4}`
    const current = buckets.get(key) ?? { rgb: { r: r & 0xf0, g: g & 0xf0, b: b & 0xf0 }, n: 0 }
    current.n += 1
    buckets.set(key, current)
  }
  return [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, 5)
    .map((item) => item.rgb)
}

export async function coverFromFile(file: File): Promise<string | null> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return null
  const version = bytes[3] ?? 3
  let offset = 10
  const tagSize = ((bytes[6] ?? 0) & 0x7f) << 21 | ((bytes[7] ?? 0) & 0x7f) << 14 | ((bytes[8] ?? 0) & 0x7f) << 7 | ((bytes[9] ?? 0) & 0x7f)
  const end = Math.min(bytes.length, 10 + tagSize)
  while (offset + 10 < end) {
    const id = String.fromCharCode(bytes[offset] ?? 0, bytes[offset + 1] ?? 0, bytes[offset + 2] ?? 0, bytes[offset + 3] ?? 0)
    if (id === "\u0000\u0000\u0000\u0000") break
    let size = 0
    if (version === 4) {
      size = ((bytes[offset + 4] ?? 0) << 24) | ((bytes[offset + 5] ?? 0) << 16) | ((bytes[offset + 6] ?? 0) << 8) | (bytes[offset + 7] ?? 0)
    } else {
      size = ((bytes[offset + 4] ?? 0) & 0x7f) << 21 | ((bytes[offset + 5] ?? 0) & 0x7f) << 14 | ((bytes[offset + 6] ?? 0) & 0x7f) << 7 | ((bytes[offset + 7] ?? 0) & 0x7f)
    }
    const frameStart = offset + 10
    if (id === "APIC" && frameStart + size <= bytes.length) {
      let cursor = frameStart
      const encoding = bytes[cursor] ?? 0
      cursor += 1
      while (cursor < frameStart + size && bytes[cursor] !== 0) cursor += 1
      cursor += 1
      cursor += 1
      if (encoding === 1 || encoding === 2) {
        while (cursor + 1 < frameStart + size && !(bytes[cursor] === 0 && bytes[cursor + 1] === 0)) cursor += 2
        cursor += 2
      } else {
        while (cursor < frameStart + size && bytes[cursor] !== 0) cursor += 1
        cursor += 1
      }
      const picture = bytes.slice(cursor, frameStart + size)
      const type = picture[0] === 0xff ? "image/jpeg" : "image/png"
      return URL.createObjectURL(new Blob([picture], { type }))
    }
    offset = frameStart + size
  }
  return null
}
