export type Pilot = {
  state?: boolean
  dimming?: number
  r?: number
  g?: number
  b?: number
  c?: number
  w?: number
  temp?: number
  sceneId?: number
  speed?: number
  ratio?: number
  mac?: string
  rssi?: number
  src?: string
}

export type Bulb = {
  ip: string
  mac?: string
  online?: boolean
  errors?: string[]
  pilot?: Pilot
  module?: {
    moduleName?: string | null
    chip?: string | null
    wifi?: string | null
    band?: string | null
    heads?: string | null
    lightClass?: string | null
  }
  kelvin?: { min: number; max: number } | null
  rssi?: number | null
  fwVersion?: string | null
  lock?: boolean | null
  powerWatts?: number | null
  ports?: { control: number; push: number }
  rangeNote?: string
}

export type Scene = {
  id: number
  name: string
  rgb: boolean
  tw: boolean
  dw: boolean
  speed: boolean
  dimming: boolean
  source: string
}

export type Profile = {
  mac: string
  name: string
  room: string
}

export type Preset = {
  id: string
  name: string
  ips: string[]
  params: Pilot
}

export type RhythmPoint = {
  minutes: number
  params: Pilot
}

export type Automation = {
  id: string
  name: string
  enabled: boolean
  kind: "schedule" | "sun" | "rhythm"
  ips: string[]
  days: number[]
  time?: string
  event?: "sunrise" | "sunset"
  offsetMin?: number
  latitude?: number
  longitude?: number
  action?: "on" | "off" | "pilot"
  params?: Pilot
  points?: RhythmPoint[]
  fired?: Record<string, string>
}

export type ViewId =
  | "lights"
  | "color"
  | "scenes"
  | "gradient"
  | "music"
  | "media"
  | "presets"
  | "auto"
  | "security"
  | "nearby"
  | "hardware"
