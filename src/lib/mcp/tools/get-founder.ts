import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "get_founder",
  title: "Get founder profile",
  description:
    "Fetch a single published founder profile by id, including all discovered signals (GitHub, arXiv, hackathons, etc.).",
  inputSchema: {
    id: z.string().uuid().describe("The founder profile UUID."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data: profile, error } = await sb
      .from("founder_profiles")
      .select("*")
      .eq("id", id)
      .eq("published", true)
      .maybeSingle();
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    if (!profile) {
      return {
        content: [{ type: "text", text: `No published founder with id ${id}` }],
        isError: true,
      };
    }
    const { data: signals } = await sb
      .from("founder_signals")
      .select("source, kind, title, detail, weight, evidence_url")
      .eq("profile_id", id);
    const payload = { profile, signals: signals ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
