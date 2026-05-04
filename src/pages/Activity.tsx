import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

type Row = { id: string; wa_id: string; direction: "in" | "out"; body: string; created_at: string };

export default function Activity() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("messages")
      .select("id, wa_id, direction, body, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setRows((data as Row[]) || []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("activity-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `user_id=eq.${user.id}` },
        (p) => setRows((prev) => [p.new as Row, ...prev].slice(0, 100)))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="text-muted-foreground text-sm">Live stream of all messages in and out.</p>
      </header>

      <Card>
        <CardHeader><CardTitle>Recent messages</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {rows.length === 0 && <div className="text-sm text-muted-foreground">Nothing yet.</div>}
          {rows.map((r) => (
            <div key={r.id} className="flex items-start gap-3 border rounded-lg p-3">
              <Badge variant={r.direction === "in" ? "secondary" : "default"} className="gap-1">
                {r.direction === "in" ? <ArrowDownLeft className="size-3" /> : <ArrowUpRight className="size-3" />}
                {r.direction}
              </Badge>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground">{r.wa_id} · {new Date(r.created_at).toLocaleString()}</div>
                <div className="text-sm whitespace-pre-wrap break-words">{r.body}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
