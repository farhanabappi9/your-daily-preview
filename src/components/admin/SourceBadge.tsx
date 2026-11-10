import { SOURCE_BADGE, SOURCE_LABEL, sourceKey } from "@/lib/order-source";

/**
 * অর্ডারের সোর্স badge — TikTok / Facebook / Instagram / Google / Direct …
 * estimated = পুরনো অর্ডার, SQL দিয়ে আন্দাজে বসানো (ডট-বর্ডার + "আনুমানিক")।
 */
export function SourceBadge({
  source,
  medium,
  estimated = false,
}: {
  source?: string | null;
  medium?: string | null;
  estimated?: boolean;
}) {
  const key = sourceKey(source);
  const base = SOURCE_LABEL[key];
  const title = estimated
    ? `${base} (আনুমানিক) — ট্র্যাকিং চালুর আগের অর্ডার, নিশ্চিত নয়`
    : medium
      ? `${base} · ${medium}`
      : base;
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${SOURCE_BADGE[key]} ${estimated ? "opacity-80 outline-dashed outline-1 outline-offset-1 outline-current" : ""}`}
      title={title}
    >
      {base}
      {estimated ? (
        <span className="font-normal opacity-90">· আনুমানিক</span>
      ) : (
        medium === "paid" && <span className="opacity-80">· Ad</span>
      )}
    </span>
  );
}
