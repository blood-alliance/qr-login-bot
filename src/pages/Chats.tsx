import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { botProxy } from "@/lib/botApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";

type Msg = { id: string; direction: "in" | "out"; body: string; created_at: string };
type Contact = { wa_id: string; name: string | null };

export default function Chats() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadContacts = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("contacts")
      .select("wa_id, name")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    setContacts(data || []);
    if (!active && data?.length) setActive(data[0].wa_id);
  };

  const loadMessages = async (wa_id: string) => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("messages")
      .select("id, direction, body, created_at")
      .eq("user_id", user.id)
      .eq("wa_id", wa_id)
      .order("created_at", { ascending: true })
      .limit(200);
    setMessages((data as Msg[]) || []);
    setLoading(false);
  };

  useEffect(() => { loadContacts(); /* eslint-disable-next-line */ }, [user?.id]);
  useEffect(() => { if (active) loadMessages(active); /* eslint-disable-next-line */ }, [active]);

  // Realtime: new messages
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("messages-rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const m = payload.new as Msg & { wa_id: string };
          if (m.wa_id === active) setMessages((prev) => [...prev, m]);
          loadContacts();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, active]);

  const send = async () => {
    if (!active || !text.trim()) return;
    setSending(true);
    try {
      const resp: any = await botProxy("/send", { method: "POST", body: { to: active, body: text } });
      await supabase.from("messages").insert({
        user_id: user!.id,
        wa_id: active,
        direction: "out",
        body: text,
        wa_message_id: resp?.id || null,
      });
      setText("");
      loadMessages(active);
    } catch (e: any) {
      toast.error(e?.message || "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Chats</h1>
        <p className="text-muted-foreground text-sm">Conversations recorded by your bot.</p>
      </header>

      <div className="grid grid-cols-12 gap-4 h-[70vh]">
        <Card className="col-span-4 overflow-hidden">
          <CardHeader className="py-3"><CardTitle className="text-sm">Contacts</CardTitle></CardHeader>
          <ScrollArea className="h-full">
            <div className="px-2 pb-2 space-y-1">
              {contacts.length === 0 && (
                <div className="text-xs text-muted-foreground px-3 py-6 text-center">No contacts yet — incoming messages will appear here.</div>
              )}
              {contacts.map((c) => (
                <button
                  key={c.wa_id}
                  onClick={() => setActive(c.wa_id)}
                  className={cn(
                    "w-full text-left rounded-lg px-3 py-2 text-sm transition",
                    active === c.wa_id ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                  )}
                >
                  <div className="font-medium truncate">{c.name || c.wa_id}</div>
                  <div className={cn("text-xs truncate", active === c.wa_id ? "opacity-80" : "text-muted-foreground")}>
                    {c.wa_id}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </Card>

        <Card className="col-span-8 flex flex-col">
          <CardHeader className="py-3 border-b"><CardTitle className="text-sm">{active || "Select a contact"}</CardTitle></CardHeader>
          <ScrollArea className="flex-1">
            <CardContent className="space-y-2 py-4">
              {loading ? (
                <div className="text-center text-sm text-muted-foreground py-6"><Loader2 className="size-4 animate-spin inline" /></div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                      m.direction === "out"
                        ? "ml-auto bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted rounded-bl-sm"
                    )}
                  >
                    <div className="whitespace-pre-wrap break-words">{m.body}</div>
                    <div className={cn("text-[10px] mt-1", m.direction === "out" ? "opacity-70" : "text-muted-foreground")}>
                      {new Date(m.created_at).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </ScrollArea>
          <div className="border-t p-3 flex gap-2">
            <Input
              placeholder={active ? "Type a reply…" : "Select a contact first"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={!active || sending}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <Button onClick={send} disabled={!active || !text.trim() || sending}>
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
