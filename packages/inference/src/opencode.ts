import { mkdir } from "node:fs/promises"
import { createOpencode, type OpencodeClient } from "@opencode-ai/sdk/v2"
import type { EnrichmentModel, TranscriptTopic } from "@vod-search/contracts"
import { enrichmentJsonSchema, MAX_TRANSCRIPT_CHARACTERS, topicAnalysisInstructions, validateTranscriptTopics, type TranscriptEnricher, type TranscriptTopicInputSegment } from "./topic-analysis.js"

export class OpenCodeConnection {
  private server: { close(): void } | null = null
  private starting: Promise<OpencodeClient> | null = null

  constructor(private readonly workspacePath: string, private readonly suppliedClient?: OpencodeClient) {}

  private getClient(): Promise<OpencodeClient> {
    if (this.suppliedClient) return Promise.resolve(this.suppliedClient)
    if (this.starting) return this.starting
    this.starting = (async () => {
      await mkdir(this.workspacePath, { recursive: true })
      const { client, server } = await createOpencode({
        hostname: "127.0.0.1", port: 0, timeout: 20_000,
        config: {
          share: "disabled", snapshot: false, autoupdate: false,
          permission: { "*": "deny", StructuredOutput: "allow" },
          agent: { cutscout: { description: "Transcript analysis only", mode: "primary", prompt: topicAnalysisInstructions, permission: { "*": "deny", StructuredOutput: "allow" } } }
        }
      })
      this.server = server
      return client
    })().catch((error) => {
      this.starting = null
      if (error instanceof Error && "code" in error && error.code === "ENOENT") throw new Error("Install OpenCode and connect a provider before loading its models.")
      throw error
    })
    return this.starting
  }

  async listModels(): Promise<EnrichmentModel[]> {
    const client = await this.getClient()
    const { data } = await client.provider.list({ directory: this.workspacePath }, { throwOnError: true, signal: AbortSignal.timeout(30_000) })
    return data.all.filter((provider) => data.connected.includes(provider.id)).flatMap((provider) =>
      Object.values(provider.models).filter((model) => model.capabilities.toolcall && model.capabilities.output.text)
        .map((model) => ({ id: `${provider.id}/${model.id}`, name: model.name, provider: provider.name })))
      .sort((left, right) => left.id.localeCompare(right.id))
  }

  createEnricher(model: string): TranscriptEnricher {
    const separator = model.indexOf("/")
    if (separator < 1 || separator === model.length - 1) throw new Error("Choose an OpenCode model in provider/model format")
    return {
      version: `opencode:${model}:vod-transcript-topics-v3`,
      enrichTranscript: (segments) => this.enrich(model.slice(0, separator), model.slice(separator + 1), segments)
    }
  }

  private async enrich(providerID: string, modelID: string, segments: TranscriptTopicInputSegment[]): Promise<TranscriptTopic[]> {
    if (segments.length === 0) return []
    if (segments.reduce((size, segment) => size + segment.text.length, 0) > MAX_TRANSCRIPT_CHARACTERS) throw new Error("The transcript is too large for topic analysis")
    const client = await this.getClient()
    const { data: session } = await client.session.create({ directory: this.workspacePath, title: "CutScout transcript analysis", permission: [{ permission: "*", pattern: "*", action: "deny" }, { permission: "StructuredOutput", pattern: "*", action: "allow" }] }, { throwOnError: true, signal: AbortSignal.timeout(30_000) })
    try {
      const { data } = await client.session.prompt({
        directory: this.workspacePath, sessionID: session.id, agent: "cutscout", model: { providerID, modelID },
        system: topicAnalysisInstructions,
        parts: [{ type: "text", text: `<untimed_transcript_segments_json>${JSON.stringify({ segments })}</untimed_transcript_segments_json>` }],
        format: { type: "json_schema", schema: enrichmentJsonSchema, retryCount: 2 }
      }, { throwOnError: true, signal: AbortSignal.timeout(10 * 60_000) })
      if (data.info.error) throw new Error(`OpenCode topic analysis failed (${data.info.error.name}). Check the selected model and its connection in OpenCode, then retry.`)
      return validateTranscriptTopics(segments, data.info.structured)
    } finally {
      await client.session.delete({ directory: this.workspacePath, sessionID: session.id }, { throwOnError: true, signal: AbortSignal.timeout(10_000) }).catch(() => undefined)
    }
  }

  close(): void { this.server?.close(); this.server = null; this.starting = null }
}
