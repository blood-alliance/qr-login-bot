import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SHARED_USER_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Single-user proxy. No JWT required. Looks up the shared bot_settings row
 * and forwards the request to the configured bot server.
 *
 * Body: { path: string, method?: string, body?: any }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { path, method = "GET", body } = await req.json();
    if (typeof path !== "string" || !path.startsWith("/")) {
      return json({ error: "invalid path" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: settings } = await admin
      .from("bot_settings")
      .select("server_url, api_token, webhook_secret")
      .eq("user_id", SHARED_USER_ID)
      .maybeSingle();

    if (!settings?.server_url || !settings?.api_token) {
      return json({ error: "bot_not_configured" }, 412);
    }

    const url = `${settings.server_url.replace(/\/$/, "")}${path}`;
    const resp = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${settings.api_token}`,
        "Content-Type": "application/json",
      },
      body: method === "GET" || !body ? undefined : JSON.stringify(body),
    });

    const text = await resp.text();
    const contentType = resp.headers.get("content-type") || "application/json";
    return new Response(text, {
      status: resp.status,
      headers: { ...corsHeaders, "Content-Type": contentType },
    });
  } catch (e) {
    console.error("wa-proxy error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
