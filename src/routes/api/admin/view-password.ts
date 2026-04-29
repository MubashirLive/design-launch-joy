import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/admin/view-password")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = request.headers.get("authorization");
          if (!auth?.startsWith("Bearer ")) return resp({ error: "Unauthorized" }, 401);

          const token = auth.slice(7);
          const userClient = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            {
              global: { headers: { Authorization: `Bearer ${token}` } },
              auth: { persistSession: false, autoRefreshToken: false },
            },
          );

          const { data: claims } = await userClient.auth.getClaims(token);
          const callerId = claims?.claims?.sub;
          if (!callerId) return resp({ error: "Unauthorized" }, 401);

          const { data: roles, error: roleError } = await supabaseAdmin
            .from("user_roles")
            .select("role")
            .eq("user_id", callerId);
          if (roleError) return resp({ error: roleError.message }, 500);
          if (!roles?.some((r) => r.role === "super_admin")) {
            return resp({ error: "Forbidden" }, 403);
          }

          const body = (await request.json()) as { adminId?: string };
          if (!body.adminId) return resp({ error: "Invalid input" }, 400);

          const { data: admin, error: adminError } = await supabaseAdmin
            .from("admins")
            .select("user_id")
            .eq("admin_id", body.adminId)
            .maybeSingle();
          if (adminError) return resp({ error: adminError.message }, 500);
          if (!admin) return resp({ error: "Admin not found" }, 404);

          const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(
            admin.user_id,
          );
          if (userError) return resp({ error: userError.message }, 500);

          const password = userData.user.user_metadata?.admin_password;
          if (typeof password !== "string" || !password) {
            return resp({ password: null });
          }

          return resp({ password });
        } catch (e) {
          return resp({ error: String(e) }, 500);
        }
      },
    },
  },
});

function resp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
