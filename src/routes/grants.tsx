import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/grants")({
  beforeLoad: () => {
    throw redirect({ to: "/founder/grants" });
  },
});
