import { describe, expect, it } from "vitest"
import { enrichmentSettingsSchema } from "./enrichment.js"

describe("enrichment settings", () => {
  it("defaults to summaries off and requires an explicit provider/model choice", () => {
    expect(enrichmentSettingsSchema.parse({}).provider).toBe("off")
    expect(enrichmentSettingsSchema.safeParse({ provider: "codex", model: "" }).success).toBe(false)
    expect(enrichmentSettingsSchema.safeParse({ provider: "opencode", model: "model-without-provider" }).success).toBe(false)
    expect(enrichmentSettingsSchema.parse({ provider: "opencode", model: "openrouter/vendor/model" }).model).toBe("openrouter/vendor/model")
  })
})
