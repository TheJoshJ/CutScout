import { useEffect, useState } from "react"
import type { CodexStatus, EnrichmentModel, EnrichmentSettings, EnrichmentStatus } from "@vod-search/contracts"
import { LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function EnrichmentSettingsPanel({ codex, onInstallCodex, onSignInCodex, onError }: {
  codex: CodexStatus
  onInstallCodex: () => void
  onSignInCodex: () => void
  onError: (error: unknown) => void
}): React.JSX.Element {
  const [settings, setSettings] = useState<EnrichmentSettings | null>(null)
  const [saved, setSaved] = useState<EnrichmentSettings | null>(null)
  const [status, setStatus] = useState<EnrichmentStatus | null>(null)
  const [models, setModels] = useState<EnrichmentModel[]>([])
  const [busy, setBusy] = useState<"save" | "test" | "models" | null>(null)
  const [message, setMessage] = useState("")

  useEffect(() => {
    let active = true
    void Promise.all([window.vodSearch.enrichment.getSettings(), window.vodSearch.enrichment.status()]).then(([configuration, readiness]) => {
      if (active) { setSettings(configuration); setSaved(configuration); setStatus(readiness) }
    }).catch(onError)
    return () => { active = false }
  }, [onError])

  async function run(action: "save" | "test" | "models"): Promise<void> {
    if (!settings) return
    setBusy(action)
    setMessage("")
    try {
      if (action === "models") {
        const available = await window.vodSearch.enrichment.models()
        setModels(available)
        setMessage(available.length ? `${available.length} models from connected providers. Select a model below.` : "No connected providers found. Connect an account in OpenCode first.")
      } else if (action === "test") {
        await window.vodSearch.enrichment.test(settings)
        setMessage("Connection verified with a sample paragraph. Your library was not used.")
      } else {
        const configuration = await window.vodSearch.enrichment.setSettings(settings)
        setSettings(configuration)
        setSaved(configuration)
        setStatus(await window.vodSearch.enrichment.status())
        setMessage(configuration.provider === "off" ? "AI summaries are off." : "Saved. Missing summaries will use this provider and model.")
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
      onError(error)
    } finally { setBusy(null) }
  }

  function update(patch: Partial<EnrichmentSettings>): void {
    setSettings((current) => current ? { ...current, ...patch } : current)
    setMessage("")
  }

  const changed = JSON.stringify(settings) !== JSON.stringify(saved)
  const codexBusy = ["checking", "installing", "updating", "signing-in"].includes(codex.state)
  return (
    <section className="grid grid-cols-[13rem_minmax(0,1fr)] gap-8 border-b py-6 max-[1100px]:grid-cols-[11rem_minmax(0,1fr)]">
      <div><h2 className="text-xs font-semibold">AI summaries (optional)</h2><p className="mt-1 text-[11px] leading-5 text-muted-foreground">Bring a connected provider and choose a model. Ingestion and search work with summaries off.</p></div>
      {!settings ? <div className="text-xs text-muted-foreground">Loading summary settings…</div> : <div className="min-w-0 space-y-4">
        <label className="flex max-w-md flex-col gap-1.5 text-xs font-medium">Connection
          <Select value={settings.provider} disabled={Boolean(busy)} onValueChange={(provider) => update({ provider: provider as EnrichmentSettings["provider"], model: provider === "codex" ? "gpt-5.4-mini" : "" })}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="off">Off · local search only</SelectItem>
              <SelectItem value="codex">Codex · ChatGPT / OpenAI</SelectItem>
              <SelectItem value="opencode">OpenCode · connected providers</SelectItem>
            </SelectContent>
          </Select>
        </label>
        {settings.provider === "opencode" && <div className="text-[11px] leading-5 text-muted-foreground">
          Install OpenCode and connect your account there, then load its models here. Supported subscription sign-ins and API connections depend on the provider. CutScout uses OpenCode&apos;s own authentication.
          <div className="mt-2 flex gap-2"><Button variant="outline" size="sm" disabled={Boolean(busy)} onClick={() => void run("models")}>{busy === "models" && <LoaderCircle className="animate-spin" />}Load connected models</Button><Button variant="ghost" size="sm" onClick={() => void window.vodSearch.enrichment.openSetup().catch(onError)}>Setup guide</Button></div>
        </div>}
        {settings.provider !== "off" && <>
          <label className="flex max-w-md flex-col gap-1.5 text-xs font-medium">Model
            <Input aria-label="Summary model" list="summary-models" value={settings.model} disabled={Boolean(busy)} onChange={(event) => update({ model: event.target.value })} placeholder={settings.provider === "opencode" ? "provider/model" : "Model ID"} />
            <datalist id="summary-models">{models.map((model) => <option key={model.id} value={model.id}>{model.provider} · {model.name}</option>)}</datalist>
          </label>
          {settings.provider === "codex" && <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground"><span>{codex.authenticated ? "Codex is signed in." : codex.installed ? "Sign in to Codex to use your account." : "Codex is not installed."}</span>{!codex.installed ? <Button variant="outline" size="sm" disabled={codexBusy} onClick={onInstallCodex}>Install Codex</Button> : !codex.authenticated ? <Button variant="outline" size="sm" disabled={codexBusy} onClick={onSignInCodex}>Sign in</Button> : null}</div>}
          <p className="text-[11px] leading-5 text-muted-foreground">Saving enables background summaries and sends untimed transcript text to your selected provider. Video and audio stay on this computer. Testing uses a sample paragraph and may use your plan or API allowance.</p>
        </>}
        <div className="flex flex-wrap items-center gap-2"><Button size="sm" disabled={Boolean(busy) || !changed || settings.provider !== "off" && !settings.model.trim()} onClick={() => void run("save")}>{busy === "save" && <LoaderCircle className="animate-spin" />}Save connection</Button>{settings.provider !== "off" && <Button variant="outline" size="sm" disabled={Boolean(busy) || !settings.model.trim()} onClick={() => void run("test")}>{busy === "test" && <LoaderCircle className="animate-spin" />}Test connection</Button>}</div>
        <p role="status" className="break-words text-[11px] leading-5 text-muted-foreground">{message || (!changed ? status?.message : "Save to apply this connection.")}</p>
      </div>}
    </section>
  )
}
