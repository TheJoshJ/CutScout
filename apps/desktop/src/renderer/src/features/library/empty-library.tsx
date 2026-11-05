import type { CodexStatus, ModelInstallation, ProcessingSchedule, SourceFolder } from "@vod-search/contracts"
import { Database, FolderOpen, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LibraryReadiness } from "./library-readiness"

export function EmptyLibrary({ folders, models, codex, processingSchedule, onAddFolder, onPrepareModels, onOpenSettings, onError }: {
  folders: SourceFolder[]
  models: ModelInstallation[]
  codex: CodexStatus
  processingSchedule: ProcessingSchedule
  onAddFolder: (publishSharedMetadata: boolean) => void
  onPrepareModels: (modelId: string) => void
  onOpenSettings: () => void
  onError: (error: unknown) => void
}): React.JSX.Element {
  const connected = folders.length > 0
  return (
    <div className="mx-auto max-w-[980px] pt-10">
      <section className="border-y px-6 py-7">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">{connected ? "Your sources" : "Start here"}</div>
        <h2 className="mt-3 max-w-lg text-2xl font-semibold tracking-tight">{connected ? "Your folders are connected." : "Find the moments in your videos."}</h2>
        <p className="mt-3 max-w-xl text-xs leading-5 text-muted-foreground">Add a video folder to browse and search existing subtitles immediately. No account or local LLM is required. Videos stay in place.</p>
        <Button className="mt-5" size="sm" variant={connected ? "outline" : "default"} onClick={() => onAddFolder(false)}><FolderOpen />{connected ? "Add another folder" : "Choose video folder"}</Button>
      </section>
      <LibraryReadiness folders={folders} models={models} processingSchedule={processingSchedule} onDownload={onPrepareModels} onError={onError} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-4">
        <div><div className="text-xs font-medium">AI summaries · optional</div><p className="mt-1 text-[11px] text-muted-foreground">Choose a provider and model in Settings. Browsing, transcription, and search work with summaries off.</p></div>
        <Button variant="ghost" size="sm" onClick={onOpenSettings}><Settings />Summary settings</Button>
      </div>
      <p className="flex items-start gap-2 px-3 py-3 text-[11px] leading-5 text-muted-foreground"><Database className="mt-0.5 size-3.5 shrink-0" />Shared transcripts are imported automatically. You can enable publishing for each source in Settings.</p>
    </div>
  )
}
