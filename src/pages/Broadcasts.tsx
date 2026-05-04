import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { botProxy } from "@/lib/botApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

type Past = { id: string; body: string; recipient_count: number; sent_at: string | null; created_at: string };

export default function Broadcasts() {
  const { user } = useAuth();
  const [body, setBody] = useState("");
  const [recipients, setRecipients] = useState("");
  const [sending, setSending] = useState(false);
  const [past, setPast] = useState<Past[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("broadcasts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setPast(data || []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const send = async () => {
    if (!user) return;
    const list = recipients
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!body.trim() || list.length === 0) {
      return toast.error("Add a message and at least one recipient");
    }
    setSending(true);
    const { data: bc, error } = await supabase
      .from("broadcasts")
      .insert({ user_id: user.id, body, recipient_count: list.length })
      .select()
      .single();
    if (error || !bc) { setSending(false); return toast.error(error?.message || "Failed"); }

    let okCount = 0;
    for (const wa_id of list) {
      try {
        await botProxy("/send", { method: "POST", body: { to: wa_id, body } });
        await supabase.from("broadcast_recipients").insert({
          broadcast_id: bc.id, user_id: user.id, wa_id, status: "sent",
        });
        await supabase.from("messages").insert({
          user_id: user.id, wa_id, direction: "out", body,
        });
        okCount++;
      } catch (e: any) {
        await supabase.from("broadcast_recipients").insert({
          broadcast_id: bc.id, user_id: user.id, wa_id, status: "failed", error: e?.message,
        });
      }
    }
    await supabase.from("broadcasts").update({ sent_at: new Date().toISOString() }).eq("id", bc.id);
    setSending(false);
    toast.success(`Broadcast finished — ${okCount}/${list.length} sent`);
    setBody(""); setRecipients("");
    load();
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Broadcasts</h1>
        <p className="text-muted-foreground text-sm">Send a single message to many WhatsApp numbers.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>New broadcast</CardTitle>
          <CardDescription>Numbers may be plain (e.g. <code>15551234567</code>) or full WhatsApp IDs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Recipients</Label>
            <Textarea rows={4} placeholder="15551234567, 15557654321&#10;15558889999" value={recipients} onChange={(e) => setRecipients(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Message</Label>
            <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Hi! Just a quick update…" />
          </div>
          <Button onClick={send} disabled={sending}>
            {sending ? <Loader2 className="size-4 animate-spin mr-2" /> : <Send className="size-4 mr-2" />}
            Send broadcast
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent broadcasts</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {past.length === 0 && <div className="text-sm text-muted-foreground">None yet.</div>}
          {past.map((p) => (
            <div key={p.id} className="rounded-lg border p-3 flex items-start gap-3">
              <div className="flex-1">
                <div className="text-sm whitespace-pre-wrap line-clamp-3">{p.body}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {p.sent_at ? new Date(p.sent_at).toLocaleString() : "pending"} · {p.recipient_count} recipients
                </div>
              </div>
              <Badge variant={p.sent_at ? "default" : "outline"}>{p.sent_at ? "sent" : "pending"}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
