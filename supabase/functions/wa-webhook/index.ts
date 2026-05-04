import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-bot-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const secret = req.headers.get("x-bot-secret") || "";
    const body = await req.json();
    const { wa_id, body: text, wa_message_id } = body || {};
    if (!wa_id || typeof text !== "string") {
      return json({ error: "wa_id and body required" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Match user by webhook_secret (multi-tenant safe)
    const { data: settings, error: sErr } = await admin
      .from("bot_settings")
      .select("*")
      .eq("webhook_secret", secret)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!settings) return json({ error: "invalid secret" }, 401);

    const userId = settings.user_id;

    // Upsert contact
    await admin
      .from("contacts")
      .upsert({ user_id: userId, wa_id, name: wa_id }, { onConflict: "user_id,wa_id" });

    // Store inbound message
    await admin.from("messages").insert({
      user_id: userId,
      wa_id,
      direction: "in",
      body: text,
      wa_message_id,
    });

    let reply: string | null = null;

    // 1) Try auto-reply rules
    const { data: rules } = await admin
      .from("auto_replies")
      .select("*")
      .eq("user_id", userId)
      .eq("enabled", true);

    for (const r of rules || []) {
      const t = r.trigger_text || "";
      const hay = text.toLowerCase();
      const needle = t.toLowerCase();
      let match = false;
      if (r.match_type === "equals") match = hay === needle;
      else if (r.match_type === "regex") {
        try { match = new RegExp(t, "i").test(text); } catch { /* ignore */ }
      } else match = hay.includes(needle);
      if (match) { reply = r.response; break; }
    }

    // 2) Otherwise, AI reply if enabled & contact opted in
    if (!reply && settings.ai_enabled) {
      const { data: contact } = await admin
        .from("contacts")
        .select("ai_enabled")
        .eq("user_id", userId)
        .eq("wa_id", wa_id)
        .maybeSingle();
      if (!contact || contact.ai_enabled) {
        const { data: history } = await admin
          .from("messages")
          .select("direction, body, created_at")
          .eq("user_id", userId)
          .eq("wa_id", wa_id)
          .order("created_at", { ascending: false })
          .limit(20);
        const msgs = (history || [])
          .reverse()
          .map((m) => ({ role: m.direction === "in" ? "user" : "assistant", content: m.body }));

        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: settings.ai_model || "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: settings.ai_system_prompt },
              ...msgs,
            ],
          }),
        });
        if (aiResp.ok) {
          const data = await aiResp.json();
          reply = data.choices?.[0]?.message?.content?.trim() || null;
        } else {
          console.error("AI gateway error", aiResp.status, await aiResp.text());
        }
      }
    }

    // 3) Send reply via bot server
    if (reply && settings.server_url && settings.api_token) {
      try {
        const sendResp = await fetch(`${settings.server_url.replace(/\/$/, "")}/send`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${settings.api_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ to: wa_id, body: reply }),
        });
        const sendJson = await sendResp.json().catch(() => ({}));
        await admin.from("messages").insert({
          user_id: userId,
          wa_id,
          direction: "out",
          body: reply,
          wa_message_id: sendJson.id || null,
        });
      } catch (e) {
        console.error("send-back failed", e);
      }
    }

    return json({ ok: true, replied: !!reply });
  } catch (e) {
    console.error("wa-webhook error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
