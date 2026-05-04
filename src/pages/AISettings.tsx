import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

const MODELS = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (default, fast)" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (most capable)" },
  { id: "openai/gpt-5-mini", label: "GPT-5 Mini" },
  { id: "openai/gpt-5", label: "GPT-5 (most capable)" },
];

export default function AISettings() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [model, setModel] = useState("google/gemini-3-flash-preview");
  const [saving, setSaving] = useState(false);
  const [testInput, setTestInput] = useState("Hi, what time do you open tomorrow?");
  const [testReply, setTestReply] = useState<string>("");
  const [testing, setTesting] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("bot_settings")
      .select("ai_enabled, ai_system_prompt, ai_model")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setEnabled(!!data.ai_enabled);
      setSystemPrompt(data.ai_system_prompt || "");
      setModel(data.ai_model || "google/gemini-3-flash-preview");
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("bot_settings")
      .update({ ai_enabled: enabled, ai_system_prompt: systemPrompt, ai_model: model })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("AI settings saved.");
  };

  const test = async () => {
    setTesting(true); setTestReply("");
    const { data, error } = await supabase.functions.invoke("ai-test", {
      body: { systemPrompt, userMessage: testInput, model },
    });
    setTesting(false);
    if (error) return toast.error(error.message);
    if ((data as any)?.error) return toast.error((data as any).error);
    setTestReply((data as any)?.reply || "");
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">AI Assistant</h1>
        <p className="text-muted-foreground text-sm">Let AI auto-reply to incoming messages when no rule matches.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="size-5" /> Configuration</CardTitle>
          <CardDescription>Per-contact opt-out is supported via the contact's <code>ai_enabled</code> flag.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm">Enable AI replies</Label>
              <div className="text-xs text-muted-foreground">When on, unmatched messages get an AI response.</div>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="space-y-1.5">
            <Label>Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>System prompt</Label>
            <Textarea rows={6} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />
          </div>

          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
            Save
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Test prompt</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input value={testInput} onChange={(e) => setTestInput(e.target.value)} />
          <Button variant="secondary" onClick={test} disabled={testing}>
            {testing ? <Loader2 className="size-4 animate-spin mr-2" /> : null} Try it
          </Button>
          {testReply && (
            <div className="rounded-lg border bg-muted/40 p-3 prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{testReply}</ReactMarkdown>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
