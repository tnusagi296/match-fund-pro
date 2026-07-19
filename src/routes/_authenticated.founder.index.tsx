import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/founder/")({
  beforeLoad: () => {
    throw redirect({ to: "/founder/profile" });
  },
});
