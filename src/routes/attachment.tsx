import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { Download, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/attachment")({
  validateSearch: (search: Record<string, unknown>) => ({
    url: typeof search.url === "string" ? search.url : "",
    title: typeof search.title === "string" ? search.title : "Attachment",
    fileName: typeof search.fileName === "string" ? search.fileName : "attachment",
    kind: search.kind === "photo" || search.kind === "marksheet" ? search.kind : "file",
  }),
  component: AttachmentPage,
});

function AttachmentPage() {
  const { loading, session, role } = useAuth();
  const navigate = useNavigate();
  const { url, title, fileName, kind } = Route.useSearch();
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session || (role !== "admin" && role !== "super_admin")) {
      navigate({ to: "/login" });
    }
  }, [loading, navigate, role, session]);

  const isPdf = useMemo(() => {
    try {
      return new URL(url).pathname.toLowerCase().endsWith(".pdf");
    } catch {
      return url.toLowerCase().includes(".pdf");
    }
  }, [url]);

  async function downloadAttachment() {
    if (!url) return;
    setDownloading(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Unable to download attachment");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      toast.error((err as Error).message);
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  }

  if (loading || !session) return null;

  return (
    <AppShell
      title={title}
      right={
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={downloadAttachment} disabled={downloading}>
            {downloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download
          </Button>
          <Button asChild type="button" variant="outline" size="sm">
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open
            </a>
          </Button>
        </div>
      }
    >
      <Card>
        <CardContent className="p-3">
          {!url ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Attachment not found.
            </p>
          ) : kind === "photo" || !isPdf ? (
            <div className="flex min-h-[60vh] items-center justify-center bg-muted">
              <img
                src={url}
                alt={title}
                className="max-h-[75vh] max-w-full object-contain"
              />
            </div>
          ) : (
            <iframe
              title={title}
              src={url}
              className="h-[75vh] w-full rounded-md border bg-muted"
            />
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
