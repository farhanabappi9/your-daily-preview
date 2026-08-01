import { createClient } from "@supabase/supabase-js";

/** Publishable-key client for server-side calls to public SECURITY DEFINER RPCs. */
export function publicServerClient() {
  const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Supabase URL / publishable key is not configured.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: any, init: any) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const SETUP_MISSING_HINT =
  "Database setup এখনো চালানো হয়নি। Admin login স্ক্রিনের 'Super Admin setup SQL' কপি করে Supabase SQL Editor-এ একবার run করুন।";

export function isSetupMissing(message?: string | null): boolean {
  const m = (message ?? "").toLowerCase();
  return (
    m.includes("could not find the function") ||
    m.includes("does not exist") ||
    m.includes("schema cache")
  );
}

/** Verbose server-side diagnosis of a failed email-link verification. */
export function describeAuthFailure(input: {
  error?: string | null;
  errorCode?: string | null;
  errorDescription?: string | null;
  hadCode: boolean;
  hadTokenHash: boolean;
  url: string;
}): { reason: string; hint: string } {
  const code = (input.errorCode ?? input.error ?? "").toLowerCase();
  const desc = (input.errorDescription ?? "").toLowerCase();

  if (code.includes("expired") || desc.includes("expired")) {
    return {
      reason: "expired_link",
      hint: "লিংকটির মেয়াদ শেষ। নতুন লিংক নিন, অথবা পাসওয়ার্ড দিয়ে সরাসরি লগইন করুন।",
    };
  }
  if (code.includes("otp") || code.includes("invalid") || desc.includes("invalid")) {
    return {
      reason: "invalid_token",
      hint: "লিংকটি ইতিমধ্যে ব্যবহৃত বা ভুল। একই ব্রাউজারে নতুন লিংক খুলুন, অথবা পাসওয়ার্ড লগইন ব্যবহার করুন।",
    };
  }
  if (code.includes("access_denied") || desc.includes("redirect")) {
    return {
      reason: "redirect_not_allowed",
      hint: "এই সাইটের URL Supabase-এর Redirect URL তালিকায় নেই। Supabase → Authentication → URL Configuration-এ সাইটের ঠিকানা যোগ করুন, অথবা পাসওয়ার্ড লগইন ব্যবহার করুন।",
    };
  }
  if (!input.hadCode && !input.hadTokenHash) {
    return {
      reason: "missing_token",
      hint: "লিংকে কোনো verification token পাওয়া যায়নি — সম্ভবত ইমেইল ক্লায়েন্ট লিংকটি আগেই খুলে ফেলেছে। পাসওয়ার্ড লগইন ব্যবহার করুন।",
    };
  }
  return {
    reason: "exchange_failed",
    hint: "টোকেন বিনিময় ব্যর্থ হয়েছে (PKCE/audience mismatch হতে পারে)। পাসওয়ার্ড লগইন ব্যবহার করুন।",
  };
}
