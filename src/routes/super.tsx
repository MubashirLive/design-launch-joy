import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { FilePlus2, Users } from "lucide-react";

export const Route = createFileRoute("/super")({
  component: SuperHome,
});

function SuperHome() {
  const { loading, role, session } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (!session || role !== "super_admin") navigate({ to: "/login" });
  }, [loading, role, session, navigate]);

  if (loading || role !== "super_admin") return null;

  return (
    <AppShell title="Super Admin Dashboard">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DashCard to="/admins" icon={<Users className="h-6 w-6" />} title="Manage Admins" desc="Create, edit, reset, disable" />
        <DashCard to="/enroll" icon={<FilePlus2 className="h-6 w-6" />} title="New Enrollment" desc="Fill a new student form" />
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Analytics & CSV export coming next. View all enrollments via the Manage area for now.
      </p>
    </AppShell>
  );
}

function DashCard({ to, icon, title, desc }: { to: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link to={to}>
      <Card className="hover:shadow-md transition-shadow border-2 hover:border-primary cursor-pointer h-full">
        <CardContent className="p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary inline-flex items-center justify-center">
            {icon}
          </div>
          <div>
            <div className="font-semibold">{title}</div>
            <div className="text-xs text-muted-foreground">{desc}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
