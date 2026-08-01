import { useCallback, useState } from "react";
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
 * Image with built-in lazy loading, async decoding, skeleton placeholder
 * and a graceful fallback if the asset fails to load.
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

  // Images restored from cache can finish before React attaches onLoad.
  const attach = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete) {
      if (node.naturalWidth === 0) setFailed(true);
      else setLoaded(true);
    }
  }, []);

  const computedSrcSet =
    srcSet ??
    buildSrcSet(src, intrinsicWidth ?? (typeof rest.width === "number" ? rest.width : undefined));

  return (
    <span className={`relative block h-full w-full overflow-hidden ${wrapperClassName}`}>
      {!loaded && !failed && (
        <span className="absolute inset-0 animate-pulse bg-muted" aria-hidden="true" />
      )}
      {failed ? (
        <span className="absolute inset-0 flex items-center justify-center bg-muted px-2 text-center text-[10px] font-medium text-muted-foreground">
          {alt}
        </span>
      ) : (
        <img
          ref={attach}
          src={src}
          srcSet={computedSrcSet}
          sizes={sizes}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding={priority ? "sync" : "async"}
          fetchPriority={priority ? "high" : "auto"}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`${className} ${loaded ? "opacity-100" : "opacity-0"} transition-opacity duration-500`}
          {...rest}
        />
      )}
    </span>
  );
}
