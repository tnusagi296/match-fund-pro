import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/investor/")({
  beforeLoad: () => {
    throw redirect({ to: "/investor/discover" });
  },
});
