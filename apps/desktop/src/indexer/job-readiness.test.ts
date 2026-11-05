import { describe, expect, it } from "vitest"
import type { Job } from "@vod-search/contracts"
import { describeBlockedJob } from "./job-readiness.js"

const job: Job = { id: "job", mediaId: "video", stage: "transcribe", status: "queued", priority: 0, progress: 0, attempts: 0, error: null, createdAtMs: 1, updatedAtMs: 1 }
const runtimes = { ffprobe: true, ffmpeg: true, whisper: true }

describe("job readiness", () => {
  it("explains missing speech downloads independently of Codex", () => {
    expect(describeBlockedJob(job, [], runtimes).blockedReason).toContain("Install Whisper")
    expect(describeBlockedJob({ ...job, stage: "probe" }, [], runtimes).blockedReason).toBeUndefined()
  })
  it("distinguishes missing executables from missing models", () => {
    expect(describeBlockedJob({ ...job, stage: "probe" }, [], { ...runtimes, ffprobe: false }).blockedReason).toContain("missing from this build")
    expect(describeBlockedJob(job, [], { ...runtimes, whisper: false }).blockedReason).toContain("runtime")
    expect(describeBlockedJob({ ...job, status: "failed" }, [], runtimes).blockedReason).toBeUndefined()
  })
})
