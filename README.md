# CutScout

CutScout is a private, Windows-first workspace for finding, reviewing, and
repurposing moments from long-form video. It indexes existing subtitles or
local Whisper transcripts, identifies recurring speakers with bundled Sherpa
ONNX models, optionally uses your chosen LLM to enrich transcript topics, and combines
full-text and semantic search.

Source videos are referenced in place and are never modified. Transcripts, tags,
speaker voice patterns, embeddings, and the search index stay under the application's local data folder.
Only untimed transcript text is sent to the selected provider when AI summaries
are enabled; video and audio files are never uploaded by CutScout.

## Download

[Download the latest Windows installer](https://github.com/TheJoshJ/CutScout/releases/latest).
Each release also includes the blockmap and `latest.yml` manifest used by
CutScout's background updater. Current installers are not code-signed, so
Windows SmartScreen may ask for confirmation.

## What works

- Recursively watches selected folders for common video and subtitle formats.
- Prefers SRT, VTT, ASS, or embedded captions before transcribing audio.
- Runs `whisper.cpp` locally with the free, open-source Whisper small.en model.
- Runs Sherpa ONNX locally with bundled segmentation and voice-embedding models to separate speakers, match recurring voices
  across clips, and annotate transcript lines with user-managed speaker names.
- Provides a Speakers review queue for finding every unassigned voice across the
  library, checking transcript evidence, and assigning or creating a speaker.
- Creates a local full-text index immediately, with optional AI topic sections later.
- Adds local BGE embeddings for meaning-based retrieval.
- Reuses portable transcript and topic bundles from a source folder's `.vod-search`
  directory, and can publish completed results there for other users of the same archive.
- Runs `codex exec` with the complete untimed transcript, a bundled topic-analysis
  skill, and a strict JSON schema to choose natural boundaries and create
  summaries, entities, events, aliases, and likely search phrases. The default
  Codex model is `gpt-5.4-mini` with low reasoning effort; the model is configurable.
- Supports OpenCode's provider catalog and existing connections through its SDK,
  including compatible subscription sign-ins, API providers, and local endpoints.
  Structured responses are validated before replacing any working search data.
- Opens matching videos in a full-width player with timestamp markers plus
  transcript and summary tabs.
- Exports a selected source range as an MP4 clip or carries it into the
  **Short form** editor.
- Builds 9:16 Short form videos from independently selected content and face
  regions, with final trim controls, caption presets, word highlighting, and
  local FFmpeg export.
- Persists background jobs, resumes interrupted work, pauses on battery, and
  keeps moved-file identity through content fingerprints.
- Keeps indexing and processing available from the Windows notification area
  when the main window is closed.
- Supports separate local-time processing windows for ingestion, Whisper
  transcription, and Codex summarization, including overnight ranges.
- Checks public GitHub Releases for newer packaged versions, downloads updates
  in the background, and offers to restart when an update is ready.

The enrichment model only sees transcript text. It cannot reliably describe a
purely visual event that nobody says aloud; computer-vision indexing is a later
extension.

## First run

1. Open **Library** and add a video folder. Existing subtitles become searchable
   without an account, a local LLM, or any model download.
2. For videos without subtitles, download **Speech recognition** (Whisper small.en)
   from Library or Settings. For meaning-based search, optionally download the
   semantic search component. Each download has its own progress and retry action;
   setup stays visible after videos are discovered.
3. Add more folders as needed. Compatible shared metadata is reused automatically;
   optionally enable **Contribute results to this folder** to share completed
   transcripts and summaries with other users of the same archive.
4. Search for spoken words, names, or descriptions such as “death to Kalphite
   King,” then open a result at its timestamp.
5. Optionally choose a connection and model under **Settings → AI summaries** for
   richer topic summaries. New libraries default to summaries off. Transcription,
   keyword search, and semantic indexing do not wait for an LLM. Semantic search indexes transcript text directly and
   refreshes its vectors when topic summaries become available.

If ingestion stops, Library and Activity show missing components and scan errors.
Use **Retry scan** for a failed source or **Retry** for failed processing jobs.
A completed scan with no supported videos is shown explicitly.

## Bring your own model

In **Settings → AI summaries**, choose **Off**, **Codex**, or **OpenCode**.
Codex uses its existing ChatGPT/OpenAI sign-in and lets you enter a model ID.
Existing libraries retain their prior Codex configuration when upgraded.

For OpenCode, [install OpenCode](https://opencode.ai/docs/) and
[connect a provider](https://opencode.ai/docs/providers/) there, then choose
**Load connected models** in CutScout. Select a `provider/model` ID and use
**Test connection** to verify access with a sample paragraph. **Save connection**
enables background summaries of library transcripts. The test can consume a small
amount of your plan or API allowance. Changing the provider or model queues
replacement topic analysis; existing keyword and semantic results remain usable
until validated replacements are ready.

CutScout starts an app-managed OpenCode server on loopback using an available
port. OpenCode owns provider credentials and sign-in; CutScout does not copy its
tokens or handle vendor passwords. Sessions permit only the structured-output
tool, and temporary transcript sessions are removed after each request. Supported
subscription sign-ins depend on the provider; a chat subscription is not a
universal API credential. For other services, configure an API key or compatible
endpoint in OpenCode. Local LLMs remain optional.

The Whisper, BGE, and speaker-model downloads are pinned and SHA-256 verified.
Whisper is about 465 MB, BGE is about 128 MB, and the bundled speaker models add
about 33 MB. No local generative model is downloaded and speaker recognition
does not require an account. Basic full-text search only requires Whisper (or existing subtitles); BGE supplies semantic
similarity, while Codex supplies richer summaries and event metadata.

The packaged Windows application includes Electron, FFmpeg, `whisper.cpp`, the
Sherpa ONNX native runtime, and its speaker models. End users do not need
Node.js, Python, pnpm, or a terminal. Local transcription, speaker recognition,
full-text search, and semantic search do not require an account. Codex
enrichment requires a ChatGPT or OpenAI sign-in. The Settings page uses
OpenAI's official standalone Windows installer for Codex, which downloads
checksum-verified release assets into Codex's standard per-user storage and
places the app-managed command under the CutScout application-data folder.

## Processing schedule

Under **Settings → Processing schedule**, ingestion, local speech processing, and
AI summaries can each run at any time or inside a daily local-time window.
Overnight ranges such as 10:00 PM–7:00 AM are supported. Work that has not
started remains queued outside its window; a job already running is allowed to
finish safely. **Rescan now** remains an explicit override for a source folder.
Lightweight local embedding work is not delayed, so completed summaries become
searchable without waiting for another window.

## Shared folder metadata

Every source folder can act as a portable metadata cache. CutScout always
looks for a matching `.vod-search/<video-fingerprint>.json` bundle before it
queues transcription or Codex summarization. A bundle contains timed transcript
segments, topic boundaries, summaries, entities, events, aliases, and search
phrases. It never contains the video, absolute local paths, credentials, voice
patterns, speaker labels, or device-specific vector embeddings.

Publishing is opt-in per source folder under **Settings → Source folders**.
Files are written atomically and identified by a content fingerprint, so the
same video can be renamed or mounted at a different path on another computer.
Imported JSON is schema-validated and must match the local video's fingerprint
and size. BGE embeddings are rebuilt locally from imported topics because they
are small, fast to generate, and model-version specific.

## Development

Install the pinned package manager once if `pnpm` is not already available:

```bash
npm install --global pnpm@11.15.1
```

```bash
pnpm install
pnpm prepare:runtimes:win
pnpm dev
```

Run validation with:

```bash
pnpm typecheck
pnpm test
pnpm build
```

For a Windows ingestion smoke test with generated speech and captions, run
`pnpm --filter @vod-search/desktop predev` and then `pnpm test:ingestion` after
building. It downloads verified Whisper/BGE models into an isolated `.cache`
directory and checks real transcription, search without Codex, scan recovery,
and shutdown. Set `CUTSCOUT_SMOKE_MODELS` to reuse an existing verified model
directory on subsequent runs. Rebuild `better-sqlite3` for the system Node
version before returning to Node-based database tests.

The bundled Windows runtimes are checksum-pinned builds of FFmpeg,
`whisper.cpp`, and the Sherpa segmentation and speaker-embedding models. They are downloaded into an ignored `resources/runtime/windows`
directory. Developers can override them with `VOD_SEARCH_FFMPEG_PATH`,
`VOD_SEARCH_FFPROBE_PATH`, `VOD_SEARCH_WHISPER_PATH`, and
`VOD_SEARCH_CODEX_PATH`. Speaker development can also use
`VOD_SEARCH_SHERPA_SEGMENTATION_MODEL_PATH` and
`VOD_SEARCH_SHERPA_EMBEDDING_MODEL_PATH`.

## Windows installer

Run this on Windows:

```bash
pnpm package:win
```

The NSIS installer is written to `release/`. Native Electron modules must be
rebuilt on Windows, so cross-packaging from Linux is intentionally unsupported.
The included `Windows installer` GitHub Actions workflow builds and uploads the
installer artifact on a Windows runner. Local packaging never publishes a
release.

Installed copies check for updates about 15 seconds after launch and every four
hours while running. Updates come from the public
`TheJoshJ/CutScout` GitHub Releases feed, download in the background, and are
installed after the user chooses **Restart now** or next closes the app.

To publish an update:

1. Set the same version in `package.json` and `apps/desktop/package.json`.
2. Run `pnpm typecheck`, `pnpm test`, and `pnpm build`.
3. Commit and push the release change to `main`.
4. Create and push a matching annotated tag:

   ```bash
   git tag -a vX.Y.Z -m "CutScout vX.Y.Z"
   git push origin vX.Y.Z
   ```

The tag workflow requires the tag and desktop package version to match. It
creates a public GitHub Release containing the installer, blockmap, and
`latest.yml` update manifest. End users do not need a GitHub token. Windows code
signing is strongly recommended before distributing the installer broadly to
reduce SmartScreen warnings and strengthen publisher verification.

## Architecture

See [the contributor architecture guide](docs/architecture.md) for process boundaries, feature ownership, and where new code belongs.

- `apps/desktop`: Electron main process, sandboxed preload, React UI, utility
  indexer process, filesystem watcher, durable job scheduler, tray lifecycle,
  and local clip/Short form export.
- `packages/database`: SQLite schema, FTS5/`sqlite-vec`, and repositories.
- `packages/search`: subtitle parsing, chunking, lexical/semantic rank fusion.
- `packages/inference`: verified models, FFmpeg/Whisper adapters, local BGE,
  native Sherpa ONNX diarization, and the schema-validated Codex
  enrichment client and skill.
- `packages/contracts`: validated domain and IPC contracts shared by processes.
