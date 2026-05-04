import { supabase } from "@/integrations/supabase/client";

/** Authenticated proxy call to the user's bot server via the wa-proxy edge function. */
export async function botProxy<T = any>(path: string, init?: { method?: string; body?: any }): Promise<T> {
  const { data, error } = await supabase.functions.invoke("wa-proxy", {
    body: { path, method: init?.method || "GET", body: init?.body },
  });
  if (error) throw error;
  return data as T;
}
