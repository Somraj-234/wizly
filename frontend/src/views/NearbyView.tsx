import { useState } from "react"
import { Button, Card, Note } from "../components/ui"
import { api } from "../lib/api"

type Field = { label: string; technical: string; value: string }
type NearbyDevice = {
  ip: string
  name: string
  kind: string
  via: string[]
  detail: string
  technical: string[]
}
type Network = { title: string; interface: string; subnet: string; fields: Field[] }

const VIA: Record<string, string> = {
  announce: "announced a name",
  ping: "answered a ping",
  neighbor: "seen on this network",
  ir: "answered as an IR blaster",
}

export function NearbyView() {
  const [network, setNetwork] = useState<Network | null>(null)
  const [devices, setDevices] = useState<NearbyDevice[]>([])
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function scan() {
    setBusy(true)
    setError("")
    try {
      const data = await api.nearby()
      setNetwork(data.network)
      setDevices(data.devices)
      setNote(data.note)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Scan failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Nearby</h2>
          <p className="text-sm text-muted-foreground">This connection, and the other devices on it. Nothing is controlled.</p>
        </div>
        <Button onClick={scan} disabled={busy}>
          {busy ? "Scanning" : "Scan"}
        </Button>
      </div>
      <Note>
        The network block is the Wi-Fi this computer is joined to. Device titles are the names they give out. The line under
        each one keeps the technical name, such as Host or a _service.
      </Note>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {network && (
        <Card className="grid gap-3 px-3 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">This network</p>
            <h3 className="text-base font-semibold">{network.title}</h3>
          </div>
          <dl className="grid gap-2 sm:grid-cols-2">
            {network.fields.map((field) => (
              <div key={field.technical} className="grid gap-0.5">
                <dt className="text-xs text-muted-foreground">
                  {field.label}
                  <span className="ml-1 font-mono text-[10px] uppercase tracking-wide">{field.technical}</span>
                </dt>
                <dd className="text-sm">{field.value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
      {note && devices.length === 0 && !busy && network && (
        <p className="text-sm text-muted-foreground">No other devices answered on {network.subnet}.0/24.</p>
      )}
      <div className="grid gap-2">
        {devices.map((device) => (
          <Card key={device.ip} className="grid gap-1 px-3 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-medium">{device.name || device.kind}</p>
              <p className="text-xs text-muted-foreground">{device.ip}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              {device.name ? device.kind : "Device on this network"}
              {" · "}
              {device.via.map((source) => VIA[source] ?? source).join(", ")}
            </p>
            {device.technical.length > 0 && (
              <p className="truncate font-mono text-xs text-muted-foreground">{device.technical.join(" · ")}</p>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
