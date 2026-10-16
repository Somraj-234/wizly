import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { api } from "./lib/api"
import { cache } from "./lib/storage"
import type { Rgb } from "./lib/color"
import type { Bulb, Profile, Scene } from "./lib/types"

type StudioValue = {
  bulbs: Bulb[]
  scenes: Scene[]
  selected: string[]
  setSelected: (ips: string[]) => void
  toggle: (ip: string) => void
  profiles: Profile[]
  saveProfile: (profile: Profile) => void
  profileFor: (bulb: Bulb) => Profile
  pilot: (params: Record<string, unknown>, ips?: string[]) => Promise<void>
  refresh: () => Promise<void>
  discover: () => Promise<void>
  addIp: (ip: string) => Promise<void>
  removeBulb: (ip: string) => Promise<void>
  busy: boolean
  notice: string | null
  setNotice: (value: string | null) => void
  locked: boolean
  setLocked: (value: boolean) => void
  glow: Rgb | null
  setGlow: (color: Rgb | null) => void
}

const StudioContext = createContext<StudioValue | null>(null)

export function StudioProvider({ children }: { children: ReactNode }) {
  const [bulbs, setBulbs] = useState<Bulb[]>([])
  const [scenes, setScenes] = useState<Scene[]>([])
  const [selected, setSelectedState] = useState<string[]>(cache.selected())
  const [profiles, setProfiles] = useState<Profile[]>(cache.profiles())
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)
  const [glow, setGlow] = useState<Rgb | null>(null)

  function setSelected(ips: string[]) {
    setSelectedState(ips)
    cache.saveSelected(ips)
  }

  async function refresh() {
    const data = await api.bulbs()
    setBulbs(data.bulbs)
  }

  useEffect(() => {
    api.lockStatus().then((status) => setLocked(status.enabled)).catch(() => setNotice("The Python API is not running."))
    api.protocol().then((data) => setScenes(data.scenes)).catch(() => undefined)
    refresh().catch((error: Error) => {
      if (error.message.toLowerCase().includes("locked")) setLocked(true)
    })
    const onLocked = () => setLocked(true)
    window.addEventListener("wizly-locked", onLocked)
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh().catch(() => undefined)
    }, 8000)
    return () => {
      window.removeEventListener("wizly-locked", onLocked)
      window.clearInterval(timer)
    }
  }, [])

  async function run(work: () => Promise<void>) {
    setBusy(true)
    setNotice(null)
    try {
      await work()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Request failed")
    } finally {
      setBusy(false)
    }
  }

  const value = useMemo<StudioValue>(() => ({
    bulbs,
    scenes,
    selected,
    setSelected,
    toggle: (ip) => setSelected(selected.includes(ip) ? selected.filter((item) => item !== ip) : [...selected, ip]),
    profiles,
    saveProfile: (profile) => {
      const next = [...profiles.filter((item) => item.mac !== profile.mac), profile]
      setProfiles(next)
      cache.saveProfiles(next)
    },
    profileFor: (bulb) => profiles.find((item) => item.mac === bulb.mac) ?? { mac: bulb.mac ?? bulb.ip, name: "", room: "" },
    pilot: async (params, ips) => {
      const targets = ips ?? selected
      if (!targets.length) {
        setNotice("Select at least one bulb.")
        return
      }
      await run(async () => {
        const data = await api.pilot(targets, params)
        setBulbs(data.bulbs)
      })
    },
    refresh: () => run(refresh),
    discover: () => run(async () => {
      const data = await api.discover()
      setBulbs(data.bulbs)
      setNotice(data.bulbs.length ? `Found ${data.bulbs.length} device${data.bulbs.length === 1 ? "" : "s"}.` : "No bulbs answered. You can add an IP manually.")
    }),
    addIp: (ip) => run(async () => {
      await api.addBulb(ip)
      await refresh()
    }),
    removeBulb: (ip) => run(async () => {
      // Drop the card immediately — the point of deleting is to make it go
      // away, including for stale/unreachable bulbs where a round trip to the
      // server isn't guaranteed to succeed. Still tell the server in the
      // background so it forgets the bulb too (api.deleteBulb is itself
      // idempotent: it never fails just because the bulb was already gone).
      setBulbs((current) => current.filter((bulb) => bulb.ip !== ip))
      if (selected.includes(ip)) setSelected(selected.filter((item) => item !== ip))
      try {
        await api.deleteBulb(ip)
      } catch (error) {
        setNotice(error instanceof Error ? `Removed here, but the server didn't confirm: ${error.message}` : "Removed here, but the server didn't confirm.")
      }
    }),
    busy,
    notice,
    setNotice,
    locked,
    setLocked,
    glow,
    setGlow,
  }), [bulbs, scenes, selected, profiles, busy, notice, locked, glow])

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
}

export function useStudio() {
  const value = useContext(StudioContext)
  if (!value) throw new Error("Studio missing")
  return value
}
