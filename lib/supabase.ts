import { createClient, SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;
let serviceClient: SupabaseClient | null = null;

function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
}

function getAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
}

function getServiceKey(): string {
  return process.env.SUPABASE_SERVICE_KEY || "placeholder-service-key";
}

export function getBrowserSupabase(): SupabaseClient {
  if (!browserClient) {
    browserClient = createClient(getSupabaseUrl(), getAnonKey());
  }
  return browserClient;
}

export function getServiceSupabase(): SupabaseClient {
  if (!serviceClient) {
    serviceClient = createClient(getSupabaseUrl(), getServiceKey());
  }
  return serviceClient;
}

export const supabase = {
  from: (...args: Parameters<SupabaseClient["from"]>) => getBrowserSupabase().from(...args),
};
