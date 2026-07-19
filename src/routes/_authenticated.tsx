import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export type AccountRole = "investor" | "founder" | "admin";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { next: location.href } });
    }
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("account_role")
      .eq("user_id", data.user.id)
      .maybeSingle();
    const role = (profile?.account_role ?? null) as AccountRole | null;
    if (!role && !location.pathname.startsWith("/select-role")) {
      throw redirect({ to: "/select-role" });
    }
    return { user: data.user, role };
  },
  component: () => <Outlet />,
});
