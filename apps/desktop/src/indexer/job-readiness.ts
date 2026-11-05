import type { Job, ModelInstallation } from "@vod-search/contracts"

export function describeBlockedJob(job: Job, models: ModelInstallation[], runtimes: {
  ffprobe: boolean
  ffmpeg: boolean
  whisper: boolean
}): Job {
  if (job.status !== "queued") return job
  let blockedReason: string | undefined
  if (job.stage === "probe" && !runtimes.ffprobe) {
    blockedReason = "Media inspection is missing from this build. Reinstall CutScout or check its runtime setup."
  } else if (job.stage === "transcribe") {
    if (!runtimes.ffmpeg || !runtimes.whisper) {
      blockedReason = "The speech runtime is missing from this build. Reinstall CutScout or check its runtime setup."
    } else if (!models.some((model) => model.modelId === "whisper-small-en" && model.status === "installed")) {
      blockedReason = "Speech recognition needs a download. Install Whisper in Settings, or add matching subtitles."
    }
  } else if (job.stage === "embed" && !models.some((model) => model.modelId === "bge-small-en-v1.5" && model.status === "installed")) {
    blockedReason = "Meaning search needs a download. Install the semantic search component in Settings. Keyword search still works."
  }
  return blockedReason ? { ...job, blockedReason } : job
}
