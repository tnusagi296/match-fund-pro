import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/matchfund/AppShell";

export const Route = createFileRoute("/_authenticated/investor")({
  beforeLoad: ({ context }) => {
    const role = (context as { role: string | null }).role;
    if (role !== "investor") {
      throw redirect({
        to:
          role === "founder"
            ? "/founder/profile"
            : role === "admin"
              ? "/admin"
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
