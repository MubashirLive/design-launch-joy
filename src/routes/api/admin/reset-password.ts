import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// POST /api/admin/reset-password   { adminId, newPassword }
// Caller must be super_admin (verified via Bearer + role check)
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/admin/reset-password")({
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
            { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } },
          );
          const { data: claims } = await userClient.auth.getClaims(token);
          const callerId = claims?.claims?.sub;
          if (!callerId) return resp({ error: "Unauthorized" }, 401);

          const { data: roles } = await supabaseAdmin
            .from("user_roles").select("role").eq("user_id", callerId);
          if (!roles?.some((r) => r.role === "super_admin"))
            return resp({ error: "Forbidden" }, 403);

          const body = (await request.json()) as { adminId?: string; newPassword?: string };
          if (!body.adminId || !body.newPassword || body.newPassword.length < 6)
            return resp({ error: "Invalid input" }, 400);

          const { data: admin } = await supabaseAdmin
            .from("admins").select("user_id").eq("admin_id", body.adminId).maybeSingle();
          if (!admin) return resp({ error: "Admin not found" }, 404);

          const { error } = await supabaseAdmin.auth.admin.updateUserById(admin.user_id, {
            password: body.newPassword,
          });
          if (error) return resp({ error: error.message }, 500);
          return resp({ ok: true });
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
