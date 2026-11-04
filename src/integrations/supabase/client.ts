import { createClient } from "@supabase/supabase-js";

if (typeof window === "undefined" && !globalThis.WebSocket) {
  globalThis.WebSocket = class {
    addEventListener() {}
    removeEventListener() {}
    send() {}
    close() {}
  } as any;
}

const metaEnv = (import.meta.env || {}) as Record<string, string | undefined>;

// Read from client-side variables or server-side process env
const rawSupabaseUrl =
  (typeof window !== "undefined"
    ? metaEnv.VITE_SUPABASE_URL || metaEnv.NEXT_PUBLIC_SUPABASE_URL
    : process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) || "";

const rawSupabaseAnonKey =
  (typeof window !== "undefined"
    ? metaEnv.VITE_SUPABASE_ANON_KEY ||
      metaEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    : process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) || "";

/**
 * Checks whether valid, non-placeholder Supabase credentials are configured.
 */
export const isSupabaseConfigured = (): boolean => {
  if (!rawSupabaseUrl || !rawSupabaseAnonKey) return false;
  if (
    rawSupabaseUrl.includes("your-project-id") ||
    rawSupabaseUrl.includes("placeholder")
  ) {
    return false;
  }
  if (
    rawSupabaseAnonKey.includes("your-supabase-anon-key") ||
    rawSupabaseAnonKey.includes("placeholder")
  ) {
    return false;
  }
  return true;
};

// Safe fallback to prevent `@supabase/supabase-js` from throwing fatal unhandled runtime exceptions
const safeSupabaseUrl =
  rawSupabaseUrl && rawSupabaseUrl.startsWith("http")
    ? rawSupabaseUrl
    : "https://placeholder-project.supabase.co";

const safeSupabaseAnonKey = rawSupabaseAnonKey || "placeholder-anon-key";

// Masked diagnostic logger
if (typeof window !== "undefined") {
  if (!isSupabaseConfigured()) {
    console.warn(
      "⚠️ Supabase Client Warning: Valid VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing or contains placeholder values. Live authentication and database queries will require real credentials in .env.",
    );
  } else {
    console.log(
      "✅ Supabase Client initialized with configured credentials:",
      {
        url: `${safeSupabaseUrl.substring(0, 28)}...`,
        keyLength: safeSupabaseAnonKey.length,
      },
    );
  }
}

export const supabase = createClient(safeSupabaseUrl, safeSupabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
