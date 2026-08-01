import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import coverAsset from "@/assets/af-cover.jpeg.asset.json";
import { buildSrcSet, SIZES } from "@/lib/image";

export function HeroCarousel() {
  const { t } = useI18n();

  return (
    <div className="relative overflow-hidden rounded-xl shadow-elegant sm:rounded-2xl">
      <img
        src={coverAsset.url}
        srcSet={buildSrcSet(coverAsset.url, 1600)}
        sizes={SIZES.hero}
        decoding="async"
        alt="Ahsan Fashion — premium punjabi, saree, couple set collection"
        width={1600}
        height={672}
        fetchPriority="high"
        className="aspect-[16/10] w-full object-cover object-center sm:aspect-[21/9] lg:aspect-[1600/672]"
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
