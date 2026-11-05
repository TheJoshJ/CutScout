import { createServer, type Server } from "node:http"
import { afterEach, describe, expect, it } from "vitest"
import { createOpencodeClient } from "@opencode-ai/sdk/v2"
import { OpenCodeConnection } from "./opencode.js"

let server: Server | undefined
afterEach(async () => {
  server?.closeAllConnections()
  await new Promise<void>((resolve) => server ? server.close(() => resolve()) : resolve())
})

const topic = { startSegmentId: 42, summary: "The speaker describes a shield.", entities: [], events: [], aliases: [], searchPhrases: ["shield"], confidence: 0.9 }

async function connection(structured: unknown = { topics: [topic] }) {
  const requests: Array<{ method: string; path: string; body: Record<string, unknown> }> = []
  server = createServer(async (request, response) => {
    let content = ""
    for await (const chunk of request) content += chunk
    const path = new URL(request.url!, "http://localhost").pathname
    requests.push({ method: request.method!, path, body: content ? JSON.parse(content) : {} })
    response.setHeader("Content-Type", "application/json")
    response.end(JSON.stringify(path.endsWith("/provider") ? {
      all: [{ id: "connected", name: "My provider", models: { demo: { id: "demo", name: "Demo model", capabilities: { toolcall: true, output: { text: true } } }, image: { id: "image-only", capabilities: { toolcall: false, output: { text: false } } } } }, { id: "unconnected", models: {} }], connected: ["connected"], default: {}
    } : request.method === "DELETE" ? true : path.endsWith("/message") ? { info: { structured }, parts: [] } : { id: "generated-session" }))
  })
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("Missing test server address")
  return { requests, engine: new OpenCodeConnection("C:/CutScout/topic-workspace", createOpencodeClient({ baseUrl: `http://127.0.0.1:${address.port}` })) }
}

describe("OpenCode enrichment", () => {
  it("lists connected models and validates structured output using the selected provider", async () => {
    const { engine, requests } = await connection()
    await expect(engine.listModels()).resolves.toEqual([{ id: "connected/demo", name: "Demo model", provider: "My provider" }])
    const enricher = engine.createEnricher("connected/demo")
    await expect(enricher.enrichTranscript([{ segmentId: 42, text: "The shield protects us." }])).resolves.toEqual([topic])
    expect(enricher.version).toContain("connected/demo")
    const create = requests.find((request) => request.method === "POST" && request.path.endsWith("/session"))!
    expect(create.body.permission).toEqual([{ permission: "*", pattern: "*", action: "deny" }, { permission: "StructuredOutput", pattern: "*", action: "allow" }])
    const prompt = requests.find((request) => request.path.endsWith("/message"))!
    expect(prompt.body.model).toEqual({ providerID: "connected", modelID: "demo" })
    expect(prompt.body.format).toMatchObject({ type: "json_schema" })
    expect(JSON.stringify(prompt.body)).not.toContain("startMs")
    expect(requests.at(-1)?.method).toBe("DELETE")
  })

  it("rejects invalid topic boundaries and still removes the temporary session", async () => {
    const { engine, requests } = await connection({ topics: [{ ...topic, startSegmentId: 999 }] })
    await expect(engine.createEnricher("connected/demo").enrichTranscript([{ segmentId: 42, text: "A transcript" }])).rejects.toThrow("first transcript segment")
    expect(requests.at(-1)?.method).toBe("DELETE")
  })
})
