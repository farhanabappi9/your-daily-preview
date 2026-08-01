import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, X } from "lucide-react";

export function imageUrlFromPath(path: string) {
  return `/api/public/img/${path}`;
}

export function ImageUploader({
  images,
  onChange,
  max = 6,
}: {
  images: string[];
  onChange: (next: string[]) => void;
  max?: number;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [urlInput, setUrlInput] = useState("");

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError("");
    const next = [...images];
    try {
      for (const file of Array.from(files).slice(0, max - images.length)) {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("product-images")
          .upload(path, file, { cacheControl: "31536000", upsert: false });
        if (upErr) throw upErr;
        next.push(imageUrlFromPath(path));
      }
      onChange(next);
    } catch (e: any) {
      setError(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {images.map((src, i) => (
          <div key={src + i} className="relative h-24 w-20 overflow-hidden rounded border bg-muted">
            <img src={src} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(images.filter((_, idx) => idx !== i))}
              className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-destructive shadow"
              aria-label="Remove image"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {images.length < max && (
          <label className="flex h-24 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded border border-dashed text-xs text-muted-foreground hover:bg-muted">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span>Upload</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => upload(e.target.files)}
              disabled={busy}
            />
          </label>
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="অথবা image URL পেস্ট করুন"
          className="flex-1 rounded-md border px-3 py-1.5 text-xs"
        />
        <button
          type="button"
          onClick={() => {
            if (urlInput.trim()) {
              onChange([...images, urlInput.trim()]);
              setUrlInput("");
            }
          }}
          className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          Add
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
