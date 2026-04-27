import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { loading, session, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/login" });
    } else if (role === "super_admin") {
      navigate({ to: "/super" });
    } else if (role === "admin") {
      navigate({ to: "/dashboard" });
    } else {
      navigate({ to: "/login" });
    }
  }, [loading, session, role, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}
