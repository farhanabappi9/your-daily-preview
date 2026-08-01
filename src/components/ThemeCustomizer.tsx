import { useEffect, useState } from "react";
import { Palette, RotateCcw, X } from "lucide-react";

type ThemeVars = {
  headerBg: string;
  headerFg: string;
  footerBg: string;
  footerFg: string;
  background: string;
  primary: string;
  accent: string;
};

const STORAGE_KEY = "nm_theme_v1";

const DEFAULTS: ThemeVars = {
  headerBg: "#0e3d33",
  headerFg: "#faf6ec",
  footerBg: "#241a2f",
  footerFg: "#f4efe4",
  background: "#f7f1e4",
  primary: "#7a1a20",
  accent: "#d4a24a",
};

// YIQ luminance — return foreground that contrasts with the given hex.
function readableFg(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#ffffff";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? "#1a1420" : "#faf6ec";
}

function applyTheme(t: ThemeVars) {
  if (typeof document === "undefined") return;
  const r = document.documentElement.style;
  r.setProperty("--header-bg", t.headerBg);
  r.setProperty("--header-fg", t.headerFg);
  r.setProperty("--footer-bg", t.footerBg);
  r.setProperty("--footer-fg", t.footerFg);
  r.setProperty("--background", t.background);
  r.setProperty("--primary", t.primary);
  r.setProperty("--primary-foreground", readableFg(t.primary));
  r.setProperty("--accent", t.accent);
  r.setProperty("--accent-foreground", readableFg(t.accent));
  r.setProperty("--ring", t.primary);
  r.setProperty(
    "--gradient-primary",
    `linear-gradient(135deg, ${t.primary}, color-mix(in oklab, ${t.primary} 70%, black))`,
  );
  r.setProperty(
    "--gradient-accent",
    `linear-gradient(135deg, ${t.accent}, color-mix(in oklab, ${t.accent} 70%, black))`,
  );
  r.setProperty(
    "--gradient-hero",
    `linear-gradient(135deg, ${t.headerBg} 0%, color-mix(in oklab, ${t.headerBg} 65%, ${t.primary}) 100%)`,
  );
  r.setProperty(
    "--gradient-footer",
    `linear-gradient(180deg, ${t.footerBg} 0%, color-mix(in oklab, ${t.footerBg} 78%, black) 100%)`,
  );
}

function loadTheme(): ThemeVars {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function ThemeCustomizer() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeVars>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = loadTheme();
    setTheme(t);
    applyTheme(t);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    applyTheme(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
    } catch {
      /* ignore */
    }
  }, [theme, ready]);

  const update = (k: keyof ThemeVars) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setTheme((prev) => ({ ...prev, [k]: e.target.value }));

  const reset = () => setTheme(DEFAULTS);

  const fields: { key: keyof ThemeVars; label: string }[] = [
    { key: "headerBg", label: "Header background" },
    { key: "headerFg", label: "Header text" },
    { key: "background", label: "Body background" },
    { key: "primary", label: "Primary / Buttons" },
    { key: "accent", label: "Accent / Highlights" },
    { key: "footerBg", label: "Footer background" },
    { key: "footerFg", label: "Footer text" },
  ];

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Customize theme colors"
        className="fixed bottom-24 right-4 z-50 flex h-12 w-12 lg:bottom-5 lg:right-5 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-elegant transition hover:scale-110"
      >
        <Palette className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed bottom-40 right-4 z-50 max-h-[70vh] w-80 overflow-y-auto lg:bottom-20 lg:right-5 max-w-[calc(100vw-2.5rem)] rounded-2xl border border-border bg-card p-4 shadow-elegant animate-fade-in-up">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="font-display text-base font-bold text-foreground">
                Theme Customizer
              </div>
              <div className="text-xs text-muted-foreground">Live preview across all pages</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close customizer"
              className="rounded-full p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
            {fields.map((f) => (
              <label key={f.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-foreground">{f.label}</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase text-muted-foreground">
                    {theme[f.key]}
                  </span>
                  <input
                    type="color"
                    value={theme[f.key]}
                    onChange={update(f.key)}
                    className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
                    aria-label={f.label}
                  />
                </span>
              </label>
            ))}
          </div>
          <button
            onClick={reset}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset to defaults
          </button>
        </div>
      )}
    </>
  );
}
