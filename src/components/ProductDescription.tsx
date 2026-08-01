import { parseDescription } from "@/lib/description";

/**
 * Renders a product description as clean, readable blocks:
 * a headline, body paragraphs, a spec list and offer highlights.
 */
export function ProductDescription({ text }: { text: string }) {
  const blocks = parseDescription(text);
  if (!blocks.length) return null;

  return (
    <div className="space-y-5 text-left">
      {blocks.map((b, i) => {
        if (b.kind === "heading")
          return (
            <h3
              key={i}
              className="border-l-4 border-primary/60 pl-3 font-display text-base font-bold leading-snug text-foreground sm:pl-4 sm:text-lg"
            >
              {b.text}
            </h3>
          );

        if (b.kind === "para")
          return (
            <p
              key={i}
              className="text-[15px] leading-7 text-muted-foreground sm:text-base sm:leading-8"
            >
              {b.text}
            </p>
          );

        if (b.kind === "bullets")
          return (
            <ul key={i} className="grid gap-2 sm:grid-cols-2">
              {b.items.map((it, j) => (
                <li
                  key={j}
                  className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/40 p-3"
                >
                  <span aria-hidden="true" className="mt-0.5 shrink-0 text-sm leading-none">
                    {it.marker}
                  </span>
                  <span className="min-w-0 text-sm leading-6">
                    {it.label && (
                      <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {it.label}
                      </span>
                    )}
                    <span className="block font-medium text-foreground">{it.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          );

        return (
          <div key={i} className="flex flex-col gap-2 rounded-2xl bg-gradient-hero p-3.5 sm:p-4">
            {b.items.map((it, j) => (
              <div
                key={j}
                className="flex items-start gap-2.5 text-sm font-semibold text-primary-foreground sm:text-[15px]"
              >
                <span aria-hidden="true" className="shrink-0 leading-6">
                  {it.marker}
                </span>
                <span className="min-w-0 leading-6">{it.text}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
