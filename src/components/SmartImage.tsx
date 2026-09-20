import { useCallback, useEffect, useState } from "react";
import { buildSrcSet } from "@/lib/image";

type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "loading"> & {
  src: string;
  alt: string;
  /** true for above-the-fold images (hero/first row) */
  priority?: boolean;
  wrapperClassName?: string;
  /** intrinsic pixel width of the source, used for srcset descriptors */
  intrinsicWidth?: number;
};

/**
 * Image with lazy loading, async decoding, a skeleton placeholder and a
 * graceful fallback.
 *
 * Changes from the previous version:
 *  - `src` changing (a product swapping images, a category tile re-rendering)
 *    now resets the loaded/failed state. Before, one failure stuck forever.
 *  - A failed image is retried once with a cache-busting query before giving
 *    up, which recovers the common case of a request that lost the race with
 *    an R2 backfill still in flight.
 *  - The fallback is a proper tile rather than raw alt text on grey, so a
 *    momentarily missing image does not make the page look broken.
 */
export function SmartImage({
  src,
  alt,
  priority = false,
  className = "",
  wrapperClassName = "",
  intrinsicWidth,
  sizes,
  srcSet,
  ...rest
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // A new src is a new image: forget whatever happened to the previous one.
  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    setAttempt(0);
  }, [src]);

  // Images restored from cache can finish before React attaches onLoad.
  const attach = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete) {
      if (node.naturalWidth === 0) setFailed(true);
      else setLoaded(true);
    }
  }, []);

  const handleError = useCallback(() => {
    // One retry: the very first request for an image can arrive while the
    // server is still copying it into R2.
    setAttempt((current) => {
      if (current === 0) return 1;
      setFailed(true);
      return current;
    });
  }, []);

  const resolvedSrc = attempt > 0 ? appendRetry(src, attempt) : src;
  const computedSrcSet =
    attempt > 0
      ? undefined
      : (srcSet ??
        buildSrcSet(src, intrinsicWidth ?? (typeof rest.width === "number" ? rest.width : undefined)));

  return (
    <span className={`relative block h-full w-full overflow-hidden ${wrapperClassName}`}>
      {!loaded && !failed && (
        <span className="absolute inset-0 animate-pulse bg-muted" aria-hidden="true" />
      )}
      {failed ? (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-muted px-2 text-center">
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6 text-muted-foreground/50"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="9" cy="10" r="1.6" />
            <path d="M3.5 17.5 9 12l4 4 3-2.5 4.5 4" />
          </svg>
          <span className="line-clamp-2 text-[10px] font-medium leading-tight text-muted-foreground">
            {alt}
          </span>
        </span>
      ) : (
        <img
          key={resolvedSrc}
          ref={attach}
          src={resolvedSrc}
          srcSet={computedSrcSet}
          sizes={sizes}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding={priority ? "sync" : "async"}
          fetchPriority={priority ? "high" : "auto"}
          onLoad={() => setLoaded(true)}
          onError={handleError}
          className={`${className} ${loaded ? "opacity-100" : "opacity-0"} transition-opacity duration-500`}
          {...rest}
        />
      )}
    </span>
  );
}

function appendRetry(src: string, attempt: number) {
  const separator = src.includes("?") ? "&" : "?";
  return `${src}${separator}__retry=${attempt}`;
}
