import type { Automation, Bulb, Scene } from "./types"

const TOKEN = "wizly.token"

export function getToken() {
  return sessionStorage.getItem(TOKEN)
}

export function setToken(token: string | null) {
  if (token) sessionStorage.setItem(TOKEN, token)
  else sessionStorage.removeItem(TOKEN)
}

async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const token = getToken()
  if (token) headers.set("X-Wizly-Token", token)
  let body = init.body
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json")
    body = JSON.stringify(init.json)
  }
  const response = await fetch(path, { ...init, headers, body })
  const data = await response.json().catch(() => ({}))
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent("wizly-locked"))
  }
  if (!response.ok) {
    const detail = typeof data.detail === "string" ? data.detail : response.statusText
    throw new Error(detail)
  }
  return data as T
}

export const api = {
  health: () => request<{ ok: boolean }>("/api/health"),
  protocol: () => request<{ scenes: Scene[] }>("/api/protocol"),
  lockStatus: () => request<{ enabled: boolean; enforce: boolean }>("/api/lock"),
  lock: (pin: string, enforce: boolean) =>
    request<{ token: string; enabled: boolean; enforce: boolean }>("/api/lock", { method: "POST", json: { pin, enforce } }),
  unlock: (pin: string) => request<{ enabled: boolean }>("/api/unlock", { method: "POST", json: { pin } }),
  discover: (wait = 3) => request<{ bulbs: Bulb[] }>("/api/discover", { method: "POST", json: { wait } }),
  nearby: (wait = 2.5) =>
    request<{
      network: { title: string; interface: string; subnet: string; fields: { label: string; technical: string; value: string }[] }
      devices: { ip: string; name: string; kind: string; via: string[]; detail: string; technical: string[] }[]
      note: string
    }>("/api/nearby", { method: "POST", json: { wait } }),
  addBulb: (ip: string) => request<Bulb>("/api/bulbs", { method: "POST", json: { ip } }),
  bulbs: () => request<{ bulbs: Bulb[] }>("/api/bulbs"),
  hardware: (ip: string) => request<{ summary: Bulb; methods: Record<string, unknown> }>(`/api/bulbs/${ip}/hardware`),
  pilot: (ips: string[], params: Record<string, unknown>) =>
    request<{ bulbs: Bulb[] }>("/api/pilot", { method: "POST", json: { ips, params } }),
  gradient: (ips: string[], start: { r: number; g: number; b: number }, end: { r: number; g: number; b: number }, dimming: number) =>
    request<{ bulbs: Bulb[] }>("/api/gradient", { method: "POST", json: { ips, start, end, dimming } }),
  fade: (ips: string[], start: number, end: number, ms: number, params: Record<string, unknown> = {}) =>
    request<{ bulbs: Bulb[] }>("/api/fade", { method: "POST", json: { ips, start, end, ms, params } }),
  reboot: (ip: string) => request(`/api/bulbs/${ip}/reboot`, { method: "POST" }),
  automations: () => request<{ automations: Automation[] }>("/api/automations"),
  saveAutomations: (automations: Automation[]) =>
    request<{ automations: Automation[] }>("/api/automations", { method: "PUT", json: { automations } }),
  youtube: (url: string) =>
    request<{ colors: { r: number; g: number; b: number }[] }>("/api/media/youtube", { method: "POST", json: { url } }),
}
