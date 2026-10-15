import { useEffect, useState } from "react"
import { Button, Card, Field, Input, Note, Toggle } from "../components/ui"
import { api, setToken } from "../lib/api"
import { useStudio } from "../studio"

export function SecurityView() {
  const studio = useStudio()
  const [pin, setPin] = useState("")
  const [enforce, setEnforce] = useState(false)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    api.lockStatus().then((status) => {
      setEnabled(status.enabled)
      setEnforce(status.enforce)
    }).catch(() => undefined)
  }, [])

  return (
    <div className="grid max-w-xl gap-4">
      <Note>
        WiZ bulbs take unsigned JSON on UDP port 38899. The published setSystemConfig message does not include a way to set the lock flag, so this site cannot password-protect the bulb itself. What it can do is lock this API to your PIN, keep the API on this computer only, and optionally push your last command back if something else changes the bulb.
      </Note>
      <Card className="grid gap-3 p-4">
        <Field label={enabled ? "PIN" : "Choose a PIN"}>
          <Input type="password" value={pin} onChange={(event) => setPin(event.target.value)} />
        </Field>
        <Toggle checked={enforce} onCheckedChange={setEnforce} label="While locked, restore the last command if the bulb changes" />
        {enabled ? (
          <Button variant="secondary" onClick={() => api.unlock(pin).then(() => {
            setToken(null)
            setEnabled(false)
            studio.setLocked(false)
          }).catch((error: Error) => studio.setNotice(error.message))}>Unlock</Button>
        ) : (
          <Button onClick={() => api.lock(pin, enforce).then((result) => {
            setToken(result.token)
            setEnabled(true)
            studio.setLocked(true)
            studio.setNotice("Locked. The token stays in this tab until you close it.")
          }).catch((error: Error) => studio.setNotice(error.message))}>Lock this site</Button>
        )}
      </Card>
      <Card className="p-4">
        <h3 className="font-semibold">What another network can do</h3>
        <Note>
          Nothing, unless your router forwards UDP 38899 toward the bulb. The control API listens on 127.0.0.1, so phones on the Wi-Fi cannot open Wizly unless you change that bind address yourself. A computer already on the same Wi-Fi can still send setPilot directly to the bulb. Restore mode overwrites those changes about every five seconds while the server is running.
        </Note>
      </Card>
    </div>
  )
}
