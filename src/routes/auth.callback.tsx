import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { reportAuthLinkFailure } from "@/lib/admin.functions";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Signing in — Ahsan Fashion" },
      { name: "description", content: "Completing your secure sign-in." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AuthCallback,
});

function AuthCallback() {
  const router = useRouter();
  const [state, setState] = useState<"working" | "failed">("working");
  const [report, setReport] = useState<{ reason: string; hint: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      const get = (k: string) => url.searchParams.get(k) ?? hash.get(k);

      const code = url.searchParams.get("code");
      const tokenHash = get("token_hash");
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const errorParam = get("error");
      const errorCode = get("error_code");
      const errorDescription = get("error_description");

      let failure: string | null = errorParam;

      try {
        if (!failure && accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) failure = error.message;
        } else if (!failure && code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) failure = error.message;
        } else if (!failure && tokenHash) {
          const type = (get("type") ?? "magiclink") as any;
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
          if (error) failure = error.message;
        }
      } catch (err: any) {
        failure = err?.message ?? "unknown error";
      }

      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      if (data.session) {
        // Clean the token out of the URL, then land on the dashboard.
        window.history.replaceState({}, "", "/auth/callback");
        await router.navigate({ to: "/admin", replace: true });
        return;
      }

      const diagnosis = await reportAuthLinkFailure({
        data: {
          url: url.origin + url.pathname,
          error: failure ?? undefined,
          errorCode: errorCode ?? undefined,
          errorDescription: errorDescription ?? undefined,
          hadCode: Boolean(code),
          hadTokenHash: Boolean(tokenHash),
        },
      }).catch(() => ({ reason: "report_failed", hint: "পাসওয়ার্ড দিয়ে লগইন করুন।" }));

      if (cancelled) return;
      setReport(diagnosis);
      setState("failed");
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center">
        {state === "working" ? (
          <p className="text-sm text-muted-foreground">সাইন-ইন সম্পন্ন করা হচ্ছে…</p>
        ) : (
          <>
            <h1 className="mb-2 text-lg font-bold">লিংক যাচাই ব্যর্থ হয়েছে</h1>
            <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
              কারণ: {report?.reason}
            </p>
            <p className="mb-4 text-sm text-muted-foreground">{report?.hint}</p>
            <a
              href="/admin"
              className="inline-flex w-full items-center justify-center rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
            >
              পাসওয়ার্ড দিয়ে লগইন করুন
            </a>
          </>
        )}
      </div>
    </div>
  );
}
