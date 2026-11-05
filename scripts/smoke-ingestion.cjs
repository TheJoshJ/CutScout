// Run after pnpm build and the desktop predev native rebuild. Uses only generated media.
const { createRequire } = require("node:module")
const { join, resolve } = require("node:path")
const { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } = require("node:fs")
const { promisify } = require("node:util")
const execFile = promisify(require("node:child_process").execFile)
const desktopRequire = createRequire(join(__dirname, "..", "apps", "desktop", "package.json"))
const { app, utilityProcess } = desktopRequire("electron")
const project = resolve(__dirname, "..")
mkdirSync(join(project, ".cache"), { recursive: true })
const root = mkdtempSync(join(project, ".cache", "ingestion-smoke-"))
const source = join(root, "source")
mkdirSync(source)
let child
const pending = new Map()
let nextId = 0

function request(method, payload, timeoutMs = 30000) {
  return new Promise((resolveRequest, reject) => {
    const id = String(++nextId)
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)) }, timeoutMs)
    pending.set(id, { resolve: resolveRequest, reject, timer })
    child.postMessage({ type: "request", id, method, payload })
  })
}

async function until(label, read, matches, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs
  let latest
  while (Date.now() < deadline) {
    latest = await read()
    if (matches(latest)) return latest
    await new Promise((resolveWait) => setTimeout(resolveWait, 300))
  }
  throw new Error(`${label}: ${JSON.stringify(latest)}`)
}

app.whenReady().then(async () => {
  try {
    const wav = join(root, "voice.wav")
    const escapedWav = wav.replaceAll("'", "''")
    await execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
      `Add-Type -AssemblyName System.Speech; $speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer; $speaker.SetOutputToWaveFile('${escapedWav}'); $speaker.Speak('The blue shield protects the knight from the dragon.'); $speaker.Dispose()`], { windowsHide: true })
    const ffmpeg = join(project, "resources", "runtime", "windows", "ffmpeg", "bin", "ffmpeg.exe")
    for (const name of ["captioned", "speech"]) {
      await execFile(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=black:s=160x90:r=10", "-i", wav,
        "-shortest", "-c:v", "mpeg4", "-q:v", "5", "-c:a", "aac", join(source, `${name}.mp4`)], { windowsHide: true })
    }
    writeFileSync(join(source, "captioned.srt"), "1\n00:00:00,000 --> 00:00:03,000\nThe sapphire shield protects the knight from the dragon.\n")
    const env = { ...process.env }
    for (const key of Object.keys(env)) if (key.toLowerCase() === "path") delete env[key]
    env.Path = join(process.env.SystemRoot, "System32")
    Object.assign(env, {
      VOD_SEARCH_DB_PATH: join(root, "index.db"), VOD_SEARCH_MODELS_PATH: join(root, "models"),
      VOD_SEARCH_RESOURCES_PATH: join(project, "resources"), VOD_SEARCH_CODEX_PATH: join(root, "no-codex.exe"),
      VOD_SEARCH_CODEX_MANAGED_PATH: join(root, "no-managed-codex.exe"), VOD_SEARCH_CODEX_PREFIX_ARGS: "[]",
      VOD_SEARCH_SHERPA_SEGMENTATION_MODEL_PATH: join(root, "no-speaker-model.onnx")
    })
    await new Promise((ready, reject) => {
      child = utilityProcess.fork(join(project, "apps", "desktop", "out", "main", "indexer.js"), [], { env, stdio: "pipe" })
      child.stderr.on("data", (chunk) => process.stderr.write(String(chunk)))
      child.on("exit", (code) => reject(new Error(`Indexer exited ${code}`)))
      child.on("message", (message) => {
        if (message.type === "event" && message.name === "ready") ready()
        if (message.type !== "response") return
        const waiting = pending.get(message.id)
        if (!waiting) return
        pending.delete(message.id)
        clearTimeout(waiting.timer)
        if (message.error) waiting.reject(new Error(message.error))
        else waiting.resolve(message.result)
      })
    })
    const folder = await request("library:add-folder", { path: source })
    await until("scan", () => request("library:list-folders"), (folders) => folders.find((item) => item.id === folder.id)?.lastScanAtMs)
    const keyword = await request("search:query", { query: "sapphire shield", mode: "keyword", includeMissing: false, limit: 10 })
    if (!keyword.hits.length) throw new Error("Captions were not searchable without models or Codex")
    console.log("PASS: subtitle ingestion and keyword search without any model or account")
    await until("missing-model explanation", () => request("jobs:list"), (jobs) => jobs.some((job) => job.stage === "transcribe" && job.blockedReason?.includes("Install Whisper")))
    console.log("PASS: missing speech model has an actionable blocked reason")
    if (process.env.CUTSCOUT_SMOKE_MODELS) symlinkSync(resolve(process.env.CUTSCOUT_SMOKE_MODELS), join(root, "models"), "junction")
    for (const modelId of ["bge-small-en-v1.5", "whisper-small-en"]) {
      if ((await request("models:list")).some((model) => model.modelId === modelId && model.status === "installed")) continue
      console.log(`Preparing ${modelId} for local smoke test`)
      await request("models:download", modelId, 600000)
    }
    const jobs = await until("local transcription and embeddings", () => request("jobs:list"), (items) =>
      items.some((job) => job.stage === "transcribe" && job.status === "succeeded") &&
      items.filter((job) => job.stage === "embed" && job.status === "succeeded").length === 2)
    if (jobs.some((job) => job.stage === "enrich" && job.status === "succeeded")) throw new Error("Unexpected external enrichment")
    const semantic = await request("search:query", { query: "a knight protected from a dragon", mode: "semantic", includeMissing: false, limit: 10 })
    if (!semantic.hits.length) throw new Error("Semantic search had no results without Codex")
    console.log("PASS: real Whisper transcription, BGE embeddings, and semantic search without Codex")
    const unavailable = join(root, "unavailable")
    const failed = await request("library:add-folder", { path: unavailable })
    await until("scan failure", () => request("library:get-folder", failed.id), (item) => item.scanState === "failed" && item.scanError)
    mkdirSync(unavailable)
    await request("library:rescan", failed.id)
    await until("scan recovery", () => request("library:get-folder", failed.id), (item) => item.scanState === "idle" && item.scanError === null && item.lastScanAtMs)
    console.log("PASS: failed source scan recovers with Rescan now")
    console.log(`Generated fixtures and index: ${root}`)
    await new Promise((resolveExit, reject) => {
      const timer = setTimeout(() => reject(new Error("Indexer did not shut down gracefully")), 5000)
      child.once("exit", () => { clearTimeout(timer); resolveExit() })
      child.postMessage({ type: "shutdown" })
    })
    child = null
    console.log("PASS: graceful indexer shutdown")
    app.exit(0)
  } catch (error) {
    console.error(error)
    app.exit(1)
  } finally {
    child?.kill()
  }
})
