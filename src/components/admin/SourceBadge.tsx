import { SOURCE_BADGE, SOURCE_LABEL, sourceKey } from "@/lib/order-source";

/** অর্ডারের সোর্স badge — TikTok / Facebook / Instagram / Google / Direct … */
export function SourceBadge({
  source,
  medium,
}: {
  source?: string | null;
  medium?: string | null;
}) {
  const key = sourceKey(source);
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${SOURCE_BADGE[key]}`}
      title={medium ? `${SOURCE_LABEL[key]} · ${medium}` : SOURCE_LABEL[key]}
    >
      {SOURCE_LABEL[key]}
      {medium === "paid" && <span className="opacity-80">· Ad</span>}
    </span>
  );
}
