import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// GET  /api/public/bootstrap  -> { needsBootstrap: boolean }
// POST /api/public/bootstrap  { email, password } -> creates first super admin
export const Route = createFileRoute("/api/public/bootstrap")({
  server: {
    handlers: {
      GET: async () => {
        const { count } = await supabaseAdmin
          .from("user_roles")
          .select("*", { count: "exact", head: true })
          .eq("role", "super_admin");
        return j({ needsBootstrap: (count ?? 0) === 0 });
      },
      POST: async ({ request }) => {
        try {
          const { count } = await supabaseAdmin
            .from("user_roles")
            .select("*", { count: "exact", head: true })
            .eq("role", "super_admin");
          if ((count ?? 0) > 0) return j({ error: "Already initialized" }, 400);

          const body = (await request.json()) as { email?: string; password?: string };
          const email = (body.email || "").trim();
          const password = body.password || "";
          if (!email || password.length < 8) return j({ error: "Invalid input" }, 400);

          const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: "Super Admin" },
          });
          if (error || !created.user) return j({ error: error?.message || "create failed" }, 500);

          await supabaseAdmin.from("user_roles").insert({
            user_id: created.user.id,
            role: "super_admin",
          });
          return j({ ok: true });
        } catch (e) {
          return j({ error: String(e) }, 500);
        }
      },
    },
  },
});

function j(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
