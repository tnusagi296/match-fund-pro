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
  name: "list_founders",
  title: "List founders",
  description:
    "List published founder profiles on Match Fund with their names, headlines, and match scores. Useful for browsing available founders.",
  inputSchema: {
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(20)
      .describe("Maximum number of founders to return (1-50)."),
    search: z
      .string()
      .optional()
      .describe("Optional case-insensitive search across name and headline."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, search }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let query = supabaseForUser(ctx)
      .from("founder_profiles")
      .select("id, name, headline, summary, scores, github, linkedin, site")
      .eq("published", true)
      .limit(limit);
    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      query = query.or(`name.ilike.${q},headline.ilike.${q}`);
    }
    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { founders: data ?? [] },
    };
  },
});
