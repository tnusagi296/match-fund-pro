import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listFoundersTool from "./tools/list-founders";
import getFounderTool from "./tools/get-founder";

// Direct Supabase auth issuer (not the .lovable.cloud proxy). Vite inlines
// this literal at build time on the client bundle; the fallback keeps the
// issuer well-formed during manifest extraction where env is not injected.
const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "match-fund-mcp",
  title: "Match Fund",
  version: "0.1.0",
  instructions:
    "Tools for Match Fund — the Tinder-style founder/investor matching app. Use `list_founders` to browse published founders and `get_founder` to pull a single profile with discovered signals (GitHub, arXiv, hackathons).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listFoundersTool, getFounderTool],
});
