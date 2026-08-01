import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import coverAsset from "@/assets/af-cover.jpeg.asset.json";
import { buildSrcSet, SIZES } from "@/lib/image";

export function HeroCarousel() {
  const { t } = useI18n();

  return (
    <div className="relative overflow-hidden rounded-xl shadow-elegant sm:rounded-2xl">
      {/*
        The banner is 1600x672 (~2.38:1). The previous version forced
        `aspect-[16/10]` on mobile with `object-cover`, which cropped roughly a
        third of the image off both sides — the couple on the left and the model
        on the right disappeared entirely on phones.

        `h-auto` lets the intrinsic 1600x672 ratio govern at every breakpoint, so
        the whole banner is always visible. The width/height attributes still
        reserve the correct space, so there is no layout shift while it loads.
      */}
      <img
        src={coverAsset.url}
        srcSet={buildSrcSet(coverAsset.url, 1600)}
        sizes={SIZES.hero}
        decoding="async"
        alt="Ahsan Fashion — premium punjabi, saree, couple set collection"
        width={1600}
        height={672}
        fetchPriority="high"
        className="block h-auto w-full object-contain"
      />
      <div className="flex flex-col gap-2.5 bg-gradient-hero px-3 py-3.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-start sm:gap-3 sm:px-8 sm:py-4">
        <Link
          to="/shop"
          className="flex min-h-11 items-center justify-center rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant transition hover:brightness-110 sm:min-h-0"
        >
          {t("home.hero.shop")}
        </Link>
        <Link
          to="/shop"
          className="flex min-h-11 items-center justify-center rounded-full border border-white/40 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 sm:min-h-0"
        >
          {t("home.hero.explore")}
        </Link>
      </div>
    </div>
  );
}
