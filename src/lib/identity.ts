import { z } from "zod";

// Identity link validation & normalization.
//
// - Field-specific error messages (not a single form-level blob).
// - Accepts both raw usernames and full URLs where applicable.
// - Normalizes to a canonical shape before it hits the DB or crawl call.

const GITHUB_HANDLE = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

function stripProtocol(u: string) {
  return u.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
}

export type GithubResult = {
  handle: string;
  profileUrl: string;
  avatarUrl: string;
};

export function normalizeGithub(input: string): GithubResult {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("GitHub username is required.");

  // Accept "octocat", "@octocat", "github.com/octocat", "https://github.com/octocat"
  let handle = trimmed.replace(/^@/, "");
  const m = handle.match(/github\.com\/([^/?#]+)/i);
  if (m) handle = m[1];
  handle = handle.replace(/\/$/, "");

  if (!GITHUB_HANDLE.test(handle)) {
    throw new Error(
      "Enter a GitHub username or a github.com profile URL (letters, numbers, hyphens).",
    );
  }
  return {
    handle,
    profileUrl: `https://github.com/${handle}`,
    avatarUrl: `https://github.com/${handle}.png?size=200`,
  };
}

export function normalizeLinkedin(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const stripped = stripProtocol(trimmed);
  const m = stripped.match(/^linkedin\.com\/(in|company)\/([^/?#]+)/i);
  if (!m) {
    throw new Error("Enter a linkedin.com/in/… or linkedin.com/company/… URL.");
  }
  return `https://www.linkedin.com/${m[1].toLowerCase()}/${m[2].replace(/\/$/, "")}`;
}

export function normalizeWebsite(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withProto);
    if (!/^[^\s.]+\.[^\s.]+/.test(u.hostname)) {
      throw new Error();
    }
    return u.toString().replace(/\/$/, "");
  } catch {
    throw new Error("Enter a valid website URL (e.g. https://yoursite.com).");
  }
}

export const IdentityLinksSchema = z.object({
  github: z.string().trim().min(1, "GitHub username is required."),
  linkedin: z.string().trim().optional().default(""),
  site: z.string().trim().optional().default(""),
});
export type IdentityLinks = z.infer<typeof IdentityLinksSchema>;

/**
 * Validate all identity fields, returning field-scoped errors.
 * Returns `{ ok: true, normalized }` when every populated field is valid.
 */
export function validateIdentityLinks(input: IdentityLinks): {
  ok: boolean;
  errors: { github?: string; linkedin?: string; site?: string };
  normalized: { github: GithubResult | null; linkedin: string; site: string };
} {
  const errors: { github?: string; linkedin?: string; site?: string } = {};
  let github: GithubResult | null = null;
  let linkedin = "";
  let site = "";

  try {
    github = normalizeGithub(input.github);
  } catch (e) {
    errors.github = e instanceof Error ? e.message : "Invalid GitHub value.";
  }
  if (input.linkedin && input.linkedin.trim()) {
    try {
      linkedin = normalizeLinkedin(input.linkedin);
    } catch (e) {
      errors.linkedin = e instanceof Error ? e.message : "Invalid LinkedIn URL.";
    }
  }
  if (input.site && input.site.trim()) {
    try {
      site = normalizeWebsite(input.site);
    } catch (e) {
      errors.site = e instanceof Error ? e.message : "Invalid website URL.";
    }
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    normalized: { github, linkedin, site },
  };
}
