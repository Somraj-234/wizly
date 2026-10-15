import { useEffect, useState } from "react"
import { Button, Card, Note } from "../components/ui"
import { api } from "../lib/api"
import { useStudio } from "../studio"

const LABELS: Record<string, string> = {
  mac: "MAC address",
  rssi: "RSSI (dBm, bulb to access point)",
  state: "state",
  sceneId: "sceneId",
  speed: "speed",
  dimming: "dimming (percent)",
  temp: "temp (K)",
  r: "r",
  g: "g",
  b: "b",
  c: "c (cool white)",
  w: "w (warm white)",
  ratio: "ratio",
  src: "src",
  fwVersion: "fwVersion",
  moduleName: "moduleName",
  homeId: "homeId",
  groupId: "groupId",
  typeId: "typeId",
  lock: "lock",
  fwOtaStatus: "fwOtaStatus",
  whiteRange: "whiteRange (K)",
  extRange: "extRange (K)",
  cctRange: "cctRange (K)",
  pwmRange: "pwmRange",
  pwmFreq: "pwmFreq",
  dftDim: "dftDim",
  startupMode: "startupMode",
  nowc: "nowc (white channels)",
  wcr: "wcr (white to color ratio)",
  minDimLevel: "minDimLevel",
  hasTapSensor: "hasTapSensor",
  hasAdjMinDim: "hasAdjMinDim",
  fanSpeed: "fanSpeed",
  power: "power",
}

function Rows({ value }: { value: unknown }) {
  if (!value || typeof value !== "object") return <Note>No result.</Note>
  const record = value as Record<string, unknown>
  const result = (record.result && typeof record.result === "object" ? record.result : record) as Record<string, unknown>
  const entries = Object.entries(result).filter(([, item]) => item !== undefined)
  if ("error" in record) return <p className="text-sm text-destructive">{String(record.error)}</p>
  return (
    <dl className="grid gap-2">
      {entries.map(([key, item]) => (
        <div key={key} className="grid grid-cols-[minmax(8rem,14rem)_1fr] gap-2 text-sm">
          <dt className="text-muted-foreground">{LABELS[key] ?? key}</dt>
          <dd className="break-all font-medium">{typeof item === "object" ? JSON.stringify(item) : String(item)}</dd>
        </div>
      ))}
    </dl>
  )
}

export function HardwareView() {
  const studio = useStudio()
  const [ip, setIp] = useState(studio.selected[0] ?? studio.bulbs[0]?.ip ?? "")
  const [methods, setMethods] = useState<Record<string, unknown> | null>(null)
  const bulb = studio.bulbs.find((item) => item.ip === ip)

  useEffect(() => {
    if (!ip && studio.bulbs[0]) setIp(studio.bulbs[0].ip)
  }, [ip, studio.bulbs])

  async function load() {
    if (!ip) return
    const data = await api.hardware(ip)
    setMethods(data.methods)
  }

  return (
    <div className="grid gap-4">
      <Note>
        These blocks are the raw replies from getPilot, getSystemConfig, getUserConfig, getModelConfig, and getPower. There is no radius field. Signal strength is rssi. Wi-Fi generation is inferred from the module name prefix.
      </Note>
      <div className="flex flex-wrap gap-2">
        {studio.bulbs.map((item) => (
          <Button key={item.ip} size="sm" variant={item.ip === ip ? "default" : "secondary"} onClick={() => setIp(item.ip)}>{item.ip}</Button>
        ))}
        <Button size="sm" variant="outline" onClick={() => load().catch((error: Error) => studio.setNotice(error.message))}>Read hardware</Button>
        <Button size="sm" variant="destructive" onClick={() => {
          if (ip && window.confirm("Reboot this bulb?")) {
            api.reboot(ip).catch((error: Error) => studio.setNotice(error.message))
          }
        }}>Reboot</Button>
      </div>
      {bulb && (
        <Card className="grid gap-2 p-4 text-sm">
          <p>Module {bulb.module?.moduleName ?? "unknown"} · {bulb.module?.chip ?? "chip not inferred"} · {bulb.module?.wifi ?? "Wi-Fi standard unknown"} · {bulb.module?.band ?? ""}</p>
          <p>Class {bulb.module?.lightClass ?? "unknown"} · heads {bulb.module?.heads ?? "unknown"} · firmware {bulb.fwVersion ?? "unknown"}</p>
          <p>Kelvin {bulb.kelvin ? `${bulb.kelvin.min}–${bulb.kelvin.max}` : "not reported, default 2200–6500"} · power {bulb.powerWatts ?? "not reported"} W</p>
          <p>Control UDP {bulb.ports?.control ?? 38899} · push UDP {bulb.ports?.push ?? 38900} · bulb lock flag {String(bulb.lock ?? "not reported")}</p>
          <p>RSSI {bulb.rssi ?? "unknown"} dBm. {rssiLabel(bulb.rssi)}</p>
          <p>{bulb.rangeNote}</p>
        </Card>
      )}
      {methods && Object.entries(methods).map(([method, payload]) => (
        <Card key={method} className="p-4">
          <h3 className="mb-3 font-semibold">{method}</h3>
          <Rows value={payload} />
        </Card>
      ))}
    </div>
  )
}

function rssiLabel(rssi?: number | null) {
  if (rssi == null) return "No signal sample yet."
  if (rssi >= -50) return "Strong signal to the access point."
  if (rssi >= -65) return "Usable signal."
  if (rssi >= -75) return "Weak signal. The lamp is near the edge of the Wi-Fi cell."
  return "Very weak signal."
}
