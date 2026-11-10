import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { getStorefront } from "@/lib/shop.functions";
import { getTrackingSecretStatus, type SecretStatus } from "@/lib/tracking.functions";
import { DEFAULT_SETTINGS, type ShopSettings } from "@/lib/shop-types";

/**
 * Facebook Pixel / TikTok Pixel / Google Tag Manager — তিনটা admin পেজের common অংশ।
 */

export function useTrackingAdmin() {
  const store = useQuery({ queryKey: ["storefront"], queryFn: () => getStorefront() });
  const secrets = useQuery({
    queryKey: ["tracking-secrets"],
    queryFn: () => getTrackingSecretStatus(),
    retry: false,
  });
  const saved = { ...DEFAULT_SETTINGS, ...(store.data?.settings ?? {}) } as ShopSettings;
  return {
    saved,
    rawSettings: (store.data?.settings ?? {}) as Partial<ShopSettings>,
    loading: store.isLoading,
    secretStatus: secrets.data as SecretStatus | undefined,
    secretError: secrets.error ? String((secrets.error as Error).message ?? secrets.error) : "",
  };
}

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </div>
  );
}

export function F({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function StatusPill({ on, label }: { on: boolean; label?: string }) {
  return on ? (
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
      {label ?? "Active"}
    </span>
  ) : (
    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
      {label ?? "Off"}
    </span>
  );
}

/**
 * গোপন key-এর ঘর। আগে সেভ করা key কখনো দেখানো হয় না — শুধু "সেট আছে ••••ab12"।
 * নতুন কিছু লিখলে সেটা দিয়ে বদলাবে, "মুছুন" চাপলে মুছে যাবে, কিছু না করলে আগেরটাই থাকবে।
 */
export function SecretField({
  label,
  help,
  status,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  help?: ReactNode;
  status?: { set: boolean; hint: string };
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  placeholder?: string;
}) {
  const clearing = value === "";
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        {status?.set && !clearing ? (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
            সেট আছে {status.hint}
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {clearing ? "সেভ করলে মুছে যাবে" : "সেট করা নেই"}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="password"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
          placeholder={status?.set ? "বদলাতে চাইলে নতুনটা লিখুন" : (placeholder ?? "")}
          className="input min-w-0 flex-1 font-mono"
          autoComplete="off"
          spellCheck={false}
        />
        {status?.set && (
          <button
            type="button"
            onClick={() => onChange(clearing ? undefined : "")}
            className="rounded-md border px-3 text-xs"
          >
            {clearing ? "থাক" : "মুছুন"}
          </button>
        )}
      </div>
      {help && <span className="block text-xs text-muted-foreground">{help}</span>}
    </div>
  );
}
