import { z } from "zod"

export const enrichmentSettingsSchema = z.object({
  provider: z.enum(["off", "codex", "opencode"]).default("off"),
  model: z.string().trim().max(180).default(""),
  reasoningEffort: z.enum(["minimal", "low", "medium", "high", "xhigh"]).default("low")
}).superRefine((settings, context) => {
  if (settings.provider !== "off" && !settings.model) {
    context.addIssue({ code: "custom", path: ["model"], message: "Choose a model for AI summaries" })
  }
  if (settings.provider === "opencode" && !/^[^/\s]+\/\S+$/.test(settings.model)) {
    context.addIssue({ code: "custom", path: ["model"], message: "Use an OpenCode model ID in provider/model format" })
  }
})
export type EnrichmentSettings = z.infer<typeof enrichmentSettingsSchema>

export const enrichmentModelSchema = z.object({ id: z.string(), name: z.string(), provider: z.string() })
export type EnrichmentModel = z.infer<typeof enrichmentModelSchema>

export const enrichmentStatusSchema = z.object({
  state: z.enum(["off", "checking", "ready", "error"]),
  message: z.string()
})
export type EnrichmentStatus = z.infer<typeof enrichmentStatusSchema>
