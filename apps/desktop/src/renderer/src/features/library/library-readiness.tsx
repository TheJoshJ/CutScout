import type { ModelInstallation, ProcessingSchedule, SourceFolder } from "@vod-search/contracts"
import { nextProcessingWindowStart } from "@vod-search/contracts"
import { CircleAlert, Download, LoaderCircle, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatBytes, formatNextScheduleStart } from "@/lib/format"

export function LibraryReadiness({ folders, models, processingSchedule, onDownload, onError }: {
  folders: SourceFolder[]
  models: ModelInstallation[]
  processingSchedule: ProcessingSchedule
  onDownload: (modelId: string) => void
  onError: (error: unknown) => void
}): React.JSX.Element | null {
  const sources = folders.filter((folder) => folder.scanState !== "idle" || folder.availableMediaCount === 0)
  const missingModels = models.filter((model) => model.status !== "installed")
  if (sources.length === 0 && missingModels.length === 0) return null
  const nextScan = nextProcessingWindowStart(processingSchedule.ingestion)
  return (
    <section aria-label="Library setup and ingestion" className="divide-y border-b">
      {sources.map((folder) => (
        <div key={folder.id} className="flex items-start justify-between gap-4 px-3 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium">
              {folder.scanState === "failed" ? <CircleAlert className="size-3.5 text-destructive" /> : folder.scanState === "scanning" ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
              {folder.scanState === "failed" ? "Scan failed" : folder.scanState === "scanning" ? "Finding videos and importing subtitles…" : folder.scanState === "queued" ? `Scan scheduled${nextScan ? ` · ${formatNextScheduleStart(nextScan)}` : ""}` : "No supported videos found"}
            </div>
            <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{folder.path}</p>
            {folder.scanError && <p className="mt-1 break-words text-[11px] text-destructive">{folder.scanError}</p>}
            {folder.scanState === "idle" && <p className="mt-1 text-[11px] text-muted-foreground">Choose a folder containing MP4, MKV, WebM, MOV, AVI, M4V, or TS videos.</p>}
          </div>
          {folder.scanState !== "scanning" && <Button variant="outline" size="sm" onClick={() => void window.vodSearch.library.rescanFolder(folder.id).catch(onError)}><RotateCw />{folder.scanState === "failed" ? "Retry scan" : "Rescan now"}</Button>}
        </div>
      ))}
      {missingModels.map((model) => {
        const speech = model.modelId === "whisper-small-en"
        const downloading = model.status === "downloading"
        return (
          <div key={model.modelId} className="flex items-center justify-between gap-4 px-3 py-3">
            <div className="min-w-0"><h3 className="text-xs font-medium">{speech ? "Speech recognition" : "Meaning search"}</h3>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{speech ? "Download Whisper for videos without subtitles. Existing subtitles need no download." : "Optional download for finding similar ideas. Keyword search works without it."} · {formatBytes(model.sizeBytes)}</p>
              {downloading && <p role="status" className="mt-1 font-mono text-[10px] text-muted-foreground">{Math.min(100, Math.round(model.bytesDownloaded / Math.max(1, model.sizeBytes) * 100))}% downloaded</p>}
              {model.error && <p className="mt-1 text-[11px] text-destructive">{model.error}</p>}
            </div>
            <Button size="sm" variant={speech && folders.length > 0 ? "default" : "outline"} disabled={downloading} onClick={() => onDownload(model.modelId)}>{downloading ? <LoaderCircle className="animate-spin" /> : <Download />}{downloading ? "Downloading" : model.error ? "Retry download" : "Download"}</Button>
          </div>
        )
      })}
    </section>
  )
}
