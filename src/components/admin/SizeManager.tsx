import { useState } from "react";
import { Plus, Trash2, Star, X } from "lucide-react";
import type { SizeGroupConfig } from "@/lib/shop-types";
import { DEFAULT_SIZE_PRESETS } from "@/lib/sizes";

type Props = {
  value: SizeGroupConfig[];
  onChange: (groups: SizeGroupConfig[]) => void;
};

/** Admin UI: add / edit / remove size groups (men, women, custom) and pick a default option. */
export function SizeManager({ value, onChange }: Props) {
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  const patch = (i: number, p: Partial<SizeGroupConfig>) =>
    onChange(value.map((g, idx) => (idx === i ? { ...g, ...p } : g)));

  const addPreset = (preset: SizeGroupConfig) => {
    if (value.some((g) => g.key === preset.key)) return;
    onChange([...value, { ...preset, options: [...preset.options] }]);
  };

  const addOption = (i: number) => {
    const raw = (drafts[i] ?? "").trim();
    if (!raw) return;
    const next = raw
      .split(/[,|]/)
      .map((s) => s.trim())
      .filter((s) => s && !value[i].options.includes(s));
    if (next.length) patch(i, { options: [...value[i].options, ...next] });
    setDrafts({ ...drafts, [i]: "" });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {DEFAULT_SIZE_PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => addPreset(preset)}
            disabled={value.some((g) => g.key === preset.key)}
            className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" /> {preset.labelBn}
          </button>
        ))}
        <button
          type="button"
          onClick={() =>
            onChange([
              ...value,
              {
                key: `custom-${value.length + 1}`,
                labelBn: "নতুন সাইজ",
                labelEn: "Custom size",
                options: [],
              },
            ])
          }
          className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium"
        >
          <Plus className="h-3.5 w-3.5" /> কাস্টম গ্রুপ
        </button>
      </div>

      {value.length === 0 && (
        <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          কোনো কাস্টম সাইজ সেট করা নেই — প্রোডাক্টের ক্যাটাগরি অনুযায়ী অটোমেটিক সাইজ দেখানো হবে।
        </p>
      )}

      {value.map((g, i) => (
        <div key={i} className="space-y-3 rounded-lg border p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={g.labelBn}
              onChange={(e) => patch(i, { labelBn: e.target.value })}
              placeholder="লেবেল (বাংলা)"
              className="input flex-1"
            />
            <input
              value={g.labelEn}
              onChange={(e) => patch(i, { labelEn: e.target.value })}
              placeholder="Label (English)"
              className="input flex-1"
            />
            <button
              type="button"
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              className="inline-flex h-10 items-center justify-center gap-1 rounded-md border px-3 text-xs text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> মুছুন
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {g.options.map((o) => (
              <span
                key={o}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  g.default === o ? "border-primary bg-primary/10 text-primary" : ""
                }`}
              >
                <button type="button" title="ডিফল্ট করুন" onClick={() => patch(i, { default: o })}>
                  <Star className={`h-3.5 w-3.5 ${g.default === o ? "fill-current" : ""}`} />
                </button>
                {o}
                <button
                  type="button"
                  title="সরান"
                  onClick={() =>
                    patch(i, {
                      options: g.options.filter((x) => x !== o),
                      default: g.default === o ? undefined : g.default,
                    })
                  }
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              value={drafts[i] ?? ""}
              onChange={(e) => setDrafts({ ...drafts, [i]: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addOption(i);
                }
              }}
              placeholder="সাইজ লিখুন (যেমন XL অথবা M, L, XL)"
              className="input flex-1"
            />
            <button
              type="button"
              onClick={() => addOption(i)}
              className="rounded-md border px-3 text-xs font-semibold"
            >
              যোগ করুন
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
