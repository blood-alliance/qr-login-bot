import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

/**
 * Authenticated proxy. The dashboard calls this with the user's JWT.
 * The function looks up the user's bot_settings (server_url + api_token)
 * and forwards the request to the bot server. The token never leaves the backend.
 *
 * Body: { path: string, method?: string, body?: any }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return json({ error: "unauthorized" }, 401);

    const { path, method = "GET", body } = await req.json();
    if (typeof path !== "string" || !path.startsWith("/")) {
      return json({ error: "invalid path" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: settings } = await admin
      .from("bot_settings")
      .select("server_url, api_token, webhook_secret")
      .eq("user_id", user.id)
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
