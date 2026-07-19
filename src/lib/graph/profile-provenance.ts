import type { GraphFounderCard } from "./types";

export function profileProvenanceLabel(
  profile: Pick<GraphFounderCard, "profileOrigin" | "claimStatus">,
): string {
  if (profile.profileOrigin === "public_scan") {
    return profile.claimStatus === "unclaimed"
      ? "Public-source profile · Unclaimed"
      : "Public-source profile · Self-submitted";
  }
  return profile.claimStatus === "claimed"
    ? "Claimed graph profile"
    : "Founder-published graph profile";
}
