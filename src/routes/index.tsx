import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth", search: { next: "/" } });
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("account_role")
      .eq("user_id", data.user.id)
      .maybeSingle();
    const role = profile?.account_role;
    if (role === "investor") throw redirect({ to: "/investor/discover" });
    if (role === "founder") throw redirect({ to: "/founder/profile" });
    if (role === "admin") throw redirect({ to: "/admin" });
    throw redirect({ to: "/select-role" });
  },
});
