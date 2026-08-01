import { Languages } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function LangToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <button
      onClick={() => setLang(lang === "bn" ? "en" : "bn")}
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/20 ${className}`}
      aria-label="Toggle language"
    >
      <Languages className="h-3.5 w-3.5" />
      {lang === "bn" ? "EN" : "বাংলা"}
    </button>
  );
}
