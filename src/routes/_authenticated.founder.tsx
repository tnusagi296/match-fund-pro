import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/founder")({
  beforeLoad: ({ context }) => {
    const role = (context as { role: string | null }).role;
    if (role !== "founder") {
      throw redirect({
        to:
          role === "investor"
            ? "/investor/discover"
            : role === "admin"
              ? "/admin"
              : "/select-role",
      });
    }
  },
  component: () => (
<Outlet />
  ),
});
