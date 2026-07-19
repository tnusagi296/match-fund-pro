import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const inputSchema = z.object({
  query: z.string().min(3).max(200),
  limit: z.number().int().min(1).max(10).default(5),
});

export const discoverGitHubCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const { runGitHubDiscovery } = await import("./graph/github-discovery.server");
    return runGitHubDiscovery({ query: data.query, limit: data.limit });
  });
