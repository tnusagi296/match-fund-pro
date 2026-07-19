import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/matchfund/AppShell";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: ({ context }) => {
    const role = (context as { role: string | null }).role;
    if (role !== "admin") {
      throw redirect({
        to:
          role === "investor"
            ? "/investor/discover"
            : role === "founder"
              ? "/founder/profile"
              : "/select-role",
      });
    }
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
