import { Trash2 } from "lucide-react"
import { useState } from "react"
import { Badge, Button, Card, Field, Input, Note } from "../components/ui"
import { cn, kelvinCss, rgbCss } from "../lib/utils"
import { useStudio } from "../studio"
import type { Bulb } from "../lib/types"

function fill(bulb: { pilot?: { r?: number; g?: number; b?: number; temp?: number; state?: boolean } }) {
  const pilot = bulb.pilot
  if (!pilot?.state) return "transparent"
  if (pilot.r || pilot.g || pilot.b) return rgbCss(pilot.r ?? 0, pilot.g ?? 0, pilot.b ?? 0)
  if (pilot.temp) return kelvinCss(pilot.temp)
  return "rgb(255 214 140)"
}

/** The backend reports raw exception text like "getPilot: TimeoutError" when a
 * known bulb doesn't answer. That's useful in Hardware, but confusing here. */
function isUnreachable(bulb: Bulb) {
  return bulb.online === false
}

export function LightsView() {
  const studio = useStudio()
  const [ip, setIp] = useState("")
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [room, setRoom] = useState("")

  function remove(bulb: Bulb, title: string) {
    const ok = window.confirm(
      `Remove "${title}" (${bulb.ip}) from Wizly?\n\nIt stays on your Wi-Fi exactly as it is now — this only stops Wizly from tracking it. Add it back any time with Scan network or Add by IP.`,
    )
    if (ok) void studio.removeBulb(bulb.ip)
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <Button onClick={() => studio.discover()} disabled={studio.busy}>Scan network</Button>
        <Button variant="secondary" onClick={() => studio.refresh()} disabled={studio.busy}>Refresh status</Button>
        <Field label="">
          <div className="flex gap-2">
            <Input value={ip} placeholder="192.168.1.20" onChange={(event) => setIp(event.target.value)} />
            <Button variant="secondary" onClick={() => ip && studio.addIp(ip)} disabled={studio.busy}>Add</Button>
          </div>
        </Field>
      </div>
      <Note>Discovery broadcasts a registration packet. Each card is one bulb. Select more than one when a control should hit them together. Names and rooms stay in this browser.</Note>
      {studio.bulbs.length === 0 && <Card className="p-6"><Note>No bulbs yet. Scan while this computer is on the same Wi-Fi, or type an address.</Note></Card>}
      <div className="grid gap-3 md:grid-cols-2">
        {studio.bulbs.map((bulb, index) => {
          const profile = studio.profileFor(bulb)
          const selected = studio.selected.includes(bulb.ip)
          const title = profile.name || bulb.module?.moduleName || "WiZ light"
          const offline = isUnreachable(bulb)
          return (
            <Card key={bulb.ip} className={cn("rise p-4", offline && "opacity-70")} style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
              <div className="flex items-start gap-2">
                <button type="button" className="flex w-full min-w-0 items-start gap-3 text-left" onClick={() => studio.toggle(bulb.ip)}>
                  <span className="mt-1 size-4 shrink-0 rounded-full border border-border" style={{ background: fill(bulb), boxShadow: selected ? "inset 0 0 0 2px var(--foreground)" : undefined }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <strong>{title}</strong>
                      {profile.room && <Badge>{profile.room}</Badge>}
                      {offline ? <Badge className="text-destructive">Offline</Badge> : <Badge>{bulb.pilot?.state ? "On" : "Off"}</Badge>}
                      {selected && <Badge>Selected</Badge>}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">{bulb.ip} · {bulb.mac ?? "no mac yet"}</span>
                  </span>
                </button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Remove bulb"
                  title="Remove bulb"
                  onClick={() => remove(bulb, title)}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => studio.pilot({ state: true }, [bulb.ip])}>On</Button>
                <Button size="sm" variant="secondary" onClick={() => studio.pilot({ state: false }, [bulb.ip])}>Off</Button>
                <Button size="sm" variant="outline" onClick={() => {
                  setEditing(bulb.ip)
                  setName(profile.name)
                  setRoom(profile.room)
                }}>Profile</Button>
              </div>
              {offline ? (
                <p className="mt-2 text-xs text-destructive">
                  Not responding on this Wi-Fi. Make sure it's powered on and still connected, press "Refresh status" above, or remove it with the trash icon if it's no longer around.
                </p>
              ) : bulb.errors && bulb.errors.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">Answered, but one read failed: {bulb.errors[0]}</p>
              )}
              {editing === bulb.ip && (
                <div className="mt-3 grid gap-2">
                  <Input value={name} placeholder="Name" onChange={(event) => setName(event.target.value)} />
                  <Input value={room} placeholder="Room" onChange={(event) => setRoom(event.target.value)} />
                  <Button size="sm" onClick={() => {
                    studio.saveProfile({ mac: bulb.mac ?? bulb.ip, name, room })
                    setEditing(null)
                  }}>Save in this browser</Button>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
