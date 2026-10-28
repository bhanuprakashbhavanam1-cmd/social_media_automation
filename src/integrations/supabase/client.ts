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
const supabaseUrl =
  (typeof window !== "undefined"
    ? metaEnv.VITE_SUPABASE_URL || metaEnv.NEXT_PUBLIC_SUPABASE_URL
    : process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) || "";

const supabaseAnonKey =
  (typeof window !== "undefined"
    ? metaEnv.VITE_SUPABASE_ANON_KEY ||
      metaEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    : process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) || "";

// Add clean, masked diagnostic logger to confirm active connection parameters
if (typeof window !== "undefined") {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      "⚠️ Supabase Client Warning: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing from environment variables!",
      {
        urlLength: supabaseUrl?.length || 0,
        keyLength: supabaseAnonKey?.length || 0,
      }
    );
  } else {
    console.log(
      "✅ Supabase Client loaded successfully from client environment variables:",
      {
        url: `${supabaseUrl.substring(0, 25)}...`,
        keyFound: true,
        keyLength: supabaseAnonKey.length,
      }
    );
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
