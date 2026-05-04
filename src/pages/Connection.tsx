import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useBotSocket } from "@/hooks/useBotSocket";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, Loader2, QrCode, RefreshCw, AlertTriangle, Copy } from "lucide-react";
import { botProxy } from "@/lib/botApi";

type Settings = {
  user_id: string;
  server_url: string | null;
  api_token: string | null;
  webhook_secret: string;
  connection_status: string;
};

export default function Connection() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [serverUrl, setServerUrl] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [saving, setSaving] = useState(false);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wa-webhook`;

  const load = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("bot_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) return toast.error(error.message);
    if (!data) {
      // Create row on first visit
      const { data: created, error: insErr } = await supabase
        .from("bot_settings")
        .insert({ user_id: user.id })
        .select()
        .single();
      if (insErr) return toast.error(insErr.message);
      setSettings(created as any);
      return;
    }
    setSettings(data as any);
    setServerUrl(data.server_url || "");
    setApiToken(data.api_token || "");
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const { status, qrDataUrl, info, connected } = useBotSocket(
    settings?.server_url || null,
    settings?.api_token || null
  );

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const cleanUrl = serverUrl.replace(/\/$/, "");
    const { error } = await supabase
      .from("bot_settings")
      .update({ server_url: cleanUrl || null, api_token: apiToken || null })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved.");
    // Configure the bot to push inbound messages to our webhook
    if (cleanUrl && apiToken && settings) {
      try {
        await botProxy("/webhook-config", {
          method: "POST",
          body: { url: webhookUrl, secret: settings.webhook_secret },
        });
      } catch (e: any) {
        toast.warning("Saved settings, but couldn't configure webhook on bot: " + (e?.message || ""));
      }
    }
    load();
  };

  const logout = async () => {
    try {
      await botProxy("/logout", { method: "POST" });
      toast.success("Bot logged out. New QR will appear.");
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  };

  const statusBadge = () => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      ready: { label: "Connected", variant: "default" },
      authenticated: { label: "Authenticated", variant: "secondary" },
      qr: { label: "Awaiting scan", variant: "outline" },
      starting: { label: "Starting…", variant: "outline" },
      disconnected: { label: "Disconnected", variant: "destructive" },
      unknown: { label: "Unknown", variant: "outline" },
    };
    const s = map[status] || map.unknown;
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Connection</h1>
        <p className="text-muted-foreground text-sm">Pair your WhatsApp account by scanning the QR.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="size-5" /> WhatsApp pairing
          </CardTitle>
          <CardDescription className="flex items-center gap-2">
            Status: {statusBadge()}
            {connected ? null : (
              <span className="text-xs text-muted-foreground">(socket not connected — check server URL/token)</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!settings?.server_url || !settings?.api_token ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Save your bot server URL and token below first.
            </div>
          ) : status === "ready" ? (
            <div className="rounded-lg border p-6 flex items-center gap-3 bg-accent/40">
              <CheckCircle2 className="size-6 text-primary" />
              <div>
                <div className="font-medium">Connected as {info?.pushname || "WhatsApp user"}</div>
                <div className="text-xs text-muted-foreground">{info?.wid}</div>
              </div>
              <Button variant="outline" size="sm" className="ml-auto" onClick={logout}>
                <RefreshCw className="size-4 mr-2" /> Re-pair
              </Button>
            </div>
          ) : qrDataUrl ? (
            <div className="flex flex-col items-center gap-3">
              <img src={qrDataUrl} alt="WhatsApp QR" className="rounded-lg border bg-white p-2 size-72" />
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Open WhatsApp → <b>Settings → Linked Devices → Link a device</b>, then scan the code above.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border p-6 flex items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Waiting for QR from bot server…
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bot server</CardTitle>
          <CardDescription>
            Run the Node.js bot server (in <code className="px-1 rounded bg-muted">whatsapp-bot-server/</code>) on your own host, then paste its public URL and shared token here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="url">Server URL</Label>
            <Input id="url" placeholder="https://your-bot.up.railway.app" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="token">API token (BOT_API_TOKEN)</Label>
            <Input id="token" type="password" placeholder="long random string" value={apiToken} onChange={(e) => setApiToken(e.target.value)} />
          </div>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
            Save & configure webhook
          </Button>

          <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
            <div className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="size-4 text-warning" /> Manual webhook setup
            </div>
            <p className="text-xs text-muted-foreground">
              Saving above will configure the webhook automatically. You can also set it manually via <code>POST /webhook-config</code> with:
            </p>
            <CopyRow label="Webhook URL" value={webhookUrl} />
            <CopyRow label="Webhook secret" value={settings?.webhook_secret || ""} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
      <code className="text-xs bg-background border rounded px-2 py-1 flex-1 truncate">{value}</code>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => { navigator.clipboard.writeText(value); toast.success("Copied"); }}
      >
        <Copy className="size-3.5" />
      </Button>
    </div>
  );
}
