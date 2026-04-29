import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// POST /api/account/forgot-id { email } -> sends OTP
// POST /api/account/forgot-id { email, otp } -> verifies OTP and returns admin ID
export const Route = createFileRoute("/api/account/forgot-id")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { email?: string; otp?: string };
          const email = (body.email || "").trim().toLowerCase();
          const otp = body.otp?.trim();

          if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return j({ error: "Enter a valid email address" }, 400);
          }

          async function findUserByEmail(email: string) {
            let page = 1;
            while (true) {
              const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 });
              if (error) return { user: null, error };
              const user = data.users.find((u) => u.email?.toLowerCase() === email);
              if (user) return { user, error: null };
              if (!data.total || page * 100 >= data.total) break;
              page += 1;
            }
            return { user: null, error: null };
          }

          const { user, error: userError } = await findUserByEmail(email);
          if (userError) {
            return j({ error: "Failed to look up user" }, 500);
          }
          if (!user) {
            return j({ error: "No super admin account found with this email" }, 404);
          }

          const { data: roles, error: rolesError } = await supabaseAdmin
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id);

          if (rolesError) {
            return j({ error: "Failed to verify account role" }, 500);
          }

          const isSuperAdmin = roles?.some((r) => r.role === "super_admin");
          if (!isSuperAdmin) {
            return j({ error: "No super admin account found with this email" }, 404);
          }

          const { data: adminData, error: adminError } = await supabaseAdmin
            .from("admins")
            .select("admin_id")
            .eq("user_id", user.id)
            .maybeSingle();
          const recoveredAdminId = adminData?.admin_id ?? "SUPER";

          if (!otp) {
            const { error: otpError } = await supabaseAdmin.auth.admin.generateLink({
              type: "recovery",
              email,
              options: {
                redirectTo: `${request.headers.get("origin") || "http://localhost:3000"}/login`,
              },
            });

            if (otpError) {
              return j({ error: "Failed to send OTP. Please try again." }, 500);
            }

            return j({ message: "OTP sent to your email. Please check your inbox." });
          } else {
            return j({ admin_id: recoveredAdminId });
          }
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