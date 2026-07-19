import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy /settings deep-links redirect to the investor settings tree. Founder
// users are then bounced by the /_authenticated/investor role gate to their
// own home.
export const Route = createFileRoute("/settings")({
  beforeLoad: () => {
    throw redirect({ to: "/investor/settings" });
  },
});
