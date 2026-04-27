import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/account/change-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = request.headers.get("authorization");
          if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

          const token = auth.slice(7);
          const url = process.env.SUPABASE_URL!;
          const anon = process.env.SUPABASE_PUBLISHABLE_KEY!;
          const userClient = createClient(url, anon, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          });

          const { data: claims, error: claimsError } = await userClient.auth.getClaims(token);
          const userId = claims?.claims?.sub;
          if (claimsError || !userId) return json({ error: "Unauthorized" }, 401);

          const { data: roles } = await supabaseAdmin
            .from("user_roles")
            .select("role")
            .eq("user_id", userId);
          const isSuperAdmin = roles?.some((r) => r.role === "super_admin");
          if (!isSuperAdmin)
            return json({ error: "Only the Super Admin can change the login email" }, 403);

          const body = (await request.json()) as { email?: string };
          const email = (body.email || "").trim().toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return json({ error: "Enter a valid email address" }, 400);
          }

          const { data: currentUser, error: userError } =
            await supabaseAdmin.auth.admin.getUserById(userId);
          if (userError || !currentUser.user) {
            return json({ error: userError?.message || "User not found" }, 404);
          }
          if (currentUser.user.email?.toLowerCase() === email) {
            return json({ error: "Enter a different email address" }, 400);
          }

          const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            email,
            email_confirm: true,
          });
          if (updateError) return json({ error: updateError.message }, 400);

          await supabaseAdmin.from("admins").update({ email }).eq("user_id", userId);

          return json({ ok: true, email });
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
