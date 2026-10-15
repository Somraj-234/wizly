import type { Preset, Profile } from "./types"

const PROFILES = "wizly.profiles"
const PRESETS = "wizly.presets"
const THEME = "wizly.theme"
const SELECTED = "wizly.selected"

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export const cache = {
  profiles: () => read<Profile[]>(PROFILES, []),
  saveProfiles: (profiles: Profile[]) => localStorage.setItem(PROFILES, JSON.stringify(profiles)),
  presets: () => read<Preset[]>(PRESETS, []),
  savePresets: (presets: Preset[]) => localStorage.setItem(PRESETS, JSON.stringify(presets)),
  theme: () => localStorage.getItem(THEME) ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
  saveTheme: (theme: string) => localStorage.setItem(THEME, theme),
  selected: () => read<string[]>(SELECTED, []),
  saveSelected: (ips: string[]) => localStorage.setItem(SELECTED, JSON.stringify(ips)),
}
