import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createClient } from "@supabase/supabase-js";

// POST /api/admin/create
// Body: { fullName, email, password, firstName }
// Auth: requires the caller to be a super_admin (verified via Bearer token).
export const Route = createFileRoute("/api/admin/create")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = request.headers.get("authorization");
          if (!auth?.startsWith("Bearer ")) {
            return json({ error: "Unauthorized" }, 401);
          }
          const token = auth.slice(7);
          const url = process.env.SUPABASE_URL!;
          const anon = process.env.SUPABASE_PUBLISHABLE_KEY!;
          const userClient = createClient(url, anon, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data: claims } = await userClient.auth.getClaims(token);
          const callerId = claims?.claims?.sub;
          if (!callerId) return json({ error: "Unauthorized" }, 401);

          // Check super_admin role
          const { data: roles, error: roleError } = await supabaseAdmin
            .from("user_roles")
            .select("role")
            .eq("user_id", callerId);
          if (roleError) return json({ error: roleError.message }, 500);
          const isSA = roles?.some((r) => r.role === "super_admin");
          if (!isSA) return json({ error: "Forbidden" }, 403);

          const body = (await request.json()) as {
            fullName?: string;
            email?: string;
            password?: string;
            firstName?: string;
          };
          const fullName = (body.fullName || "").trim();
          const email = (body.email || "").trim();
          const password = body.password || "";
          const firstName = (body.firstName || fullName.split(" ")[0] || "").trim();

          if (!fullName || !email || password.length < 6 || !firstName) {
            return json({ error: "Invalid input" }, 400);
          }

          // Generate Admin ID
          const { data: adminIdResp, error: idErr } = await supabaseAdmin.rpc("next_admin_id", {
            _first_name: firstName,
          });
          if (idErr || !adminIdResp) return json({ error: idErr?.message || "id error" }, 500);
          const adminId = adminIdResp as string;

          // Synthesized login email for admin sign-in
          const loginEmail = `${adminId.toLowerCase()}@admins.camp.local`;

          // Create auth user
          const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
            email: loginEmail,
            password,
            email_confirm: true,
            user_metadata: {
              full_name: fullName,
              real_email: email,
              admin_id: adminId,
              admin_password: password,
            },
          });
          if (cErr || !created.user) return json({ error: cErr?.message || "create failed" }, 500);

          // Insert admin row
          const { error: aErr } = await supabaseAdmin.from("admins").insert({
            user_id: created.user.id,
            admin_id: adminId,
            full_name: fullName,
            email,
            created_by: callerId,
          });
          if (aErr) {
            await supabaseAdmin.auth.admin.deleteUser(created.user.id);
            return json({ error: aErr.message }, 500);
          }

          // Insert role
          await supabaseAdmin.from("user_roles").insert({
            user_id: created.user.id,
            role: "admin",
          });

          return json({ ok: true, adminId });
        } catch (e) {
          return json({ error: String(e) }, 500);
        }
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
