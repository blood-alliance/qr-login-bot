import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

type Rule = {
  id: string;
  trigger_text: string;
  match_type: "contains" | "equals" | "regex";
  response: string;
  enabled: boolean;
};

export default function AutoReplies() {
  const { user } = useAuth();
  const [rules, setRules] = useState<Rule[]>([]);
  const [trigger, setTrigger] = useState("");
  const [matchType, setMatchType] = useState<"contains" | "equals" | "regex">("contains");
  const [response, setResponse] = useState("");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("auto_replies")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setRules((data as Rule[]) || []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const add = async () => {
    if (!trigger.trim() || !response.trim()) return toast.error("Trigger and response required");
    const { error } = await supabase.from("auto_replies").insert({
      user_id: user!.id, trigger_text: trigger, match_type: matchType, response,
    });
    if (error) return toast.error(error.message);
    setTrigger(""); setResponse("");
    load();
  };
  const toggle = async (r: Rule) => {
    await supabase.from("auto_replies").update({ enabled: !r.enabled }).eq("id", r.id);
    load();
  };
  const del = async (id: string) => {
    await supabase.from("auto_replies").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Auto-replies</h1>
        <p className="text-muted-foreground text-sm">Rules run before AI. First match wins.</p>
      </header>

      <Card>
        <CardHeader><CardTitle>Add rule</CardTitle><CardDescription>Match incoming text and respond.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Trigger</Label>
              <Input value={trigger} onChange={(e) => setTrigger(e.target.value)} placeholder="hello" />
            </div>
            <div className="space-y-1.5">
              <Label>Match type</Label>
              <Select value={matchType} onValueChange={(v: any) => setMatchType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">Contains</SelectItem>
                  <SelectItem value="equals">Equals</SelectItem>
                  <SelectItem value="regex">Regex</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Response</Label>
            <Textarea value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Hi there! 👋" />
          </div>
          <Button onClick={add}><Plus className="size-4 mr-2" /> Add rule</Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {rules.length === 0 && <div className="text-sm text-muted-foreground">No rules yet.</div>}
        {rules.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-4 flex items-start gap-3">
              <Switch checked={r.enabled} onCheckedChange={() => toggle(r)} />
              <div className="flex-1 space-y-1">
                <div className="text-sm font-medium">
                  <span className="text-muted-foreground">{r.match_type}:</span> <code>{r.trigger_text}</code>
                </div>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">→ {r.response}</div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="size-4" /></Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
