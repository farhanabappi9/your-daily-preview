import { resolveAssetUrl } from "@/lib/asset-map";
// Auto-generated: responsive WebP variants for category images.

import ishirt_gift_combo_320 from "@/assets/cat-shirt-gift-combo-320.webp.asset.json";
import ishirt_gift_combo_480 from "@/assets/cat-shirt-gift-combo-480.webp.asset.json";
import ishirt_gift_combo_720 from "@/assets/cat-shirt-gift-combo-720.webp.asset.json";
import ishirt_gift_combo_900 from "@/assets/cat-shirt-gift-combo-900.webp.asset.json";
import ipanjabi_gift_combo_320 from "@/assets/cat-panjabi-gift-combo-320.webp.asset.json";
import ipanjabi_gift_combo_480 from "@/assets/cat-panjabi-gift-combo-480.webp.asset.json";
import ipanjabi_gift_combo_720 from "@/assets/cat-panjabi-gift-combo-720.webp.asset.json";
import ipanjabi_gift_combo_900 from "@/assets/cat-panjabi-gift-combo-900.webp.asset.json";
import isaree_320 from "@/assets/cat-saree-320.webp.asset.json";
import isaree_480 from "@/assets/cat-saree-480.webp.asset.json";
import isaree_720 from "@/assets/cat-saree-720.webp.asset.json";
import isaree_900 from "@/assets/cat-saree-900.webp.asset.json";
import ipanjabi_320 from "@/assets/cat-panjabi-320.webp.asset.json";
import ipanjabi_480 from "@/assets/cat-panjabi-480.webp.asset.json";
import ipanjabi_720 from "@/assets/cat-panjabi-720.webp.asset.json";
import ipanjabi_900 from "@/assets/cat-panjabi-900.webp.asset.json";
import ishirt_320 from "@/assets/cat-shirt-320.webp.asset.json";
import ishirt_480 from "@/assets/cat-shirt-480.webp.asset.json";
import ishirt_720 from "@/assets/cat-shirt-720.webp.asset.json";
import ishirt_900 from "@/assets/cat-shirt-900.webp.asset.json";
import icouple_set_320 from "@/assets/cat-couple-set-320.webp.asset.json";
import icouple_set_480 from "@/assets/cat-couple-set-480.webp.asset.json";
import icouple_set_720 from "@/assets/cat-couple-set-720.webp.asset.json";
import icouple_set_900 from "@/assets/cat-couple-set-900.webp.asset.json";
import iladies_collection_320 from "@/assets/cat-ladies-collection-320.webp.asset.json";
import iladies_collection_480 from "@/assets/cat-ladies-collection-480.webp.asset.json";
import iladies_collection_720 from "@/assets/cat-ladies-collection-720.webp.asset.json";
import iladies_collection_900 from "@/assets/cat-ladies-collection-900.webp.asset.json";

export type CategoryImage = { src: string; srcSet: string };

export const CATEGORY_IMAGES: Record<string, CategoryImage> = {
  "shirt-gift-combo": {
    src: ishirt_gift_combo_900.url,
    srcSet: [
      `${ishirt_gift_combo_320.url} 320w`,
      `${ishirt_gift_combo_480.url} 480w`,
      `${ishirt_gift_combo_720.url} 720w`,
      `${ishirt_gift_combo_900.url} 900w`,
    ].join(", "),
  },
  "panjabi-gift-combo": {
    src: ipanjabi_gift_combo_900.url,
    srcSet: [
      `${ipanjabi_gift_combo_320.url} 320w`,
      `${ipanjabi_gift_combo_480.url} 480w`,
      `${ipanjabi_gift_combo_720.url} 720w`,
      `${ipanjabi_gift_combo_900.url} 900w`,
    ].join(", "),
  },
  saree: {
    src: isaree_900.url,
    srcSet: [
      `${isaree_320.url} 320w`,
      `${isaree_480.url} 480w`,
      `${isaree_720.url} 720w`,
      `${isaree_900.url} 900w`,
    ].join(", "),
  },
  panjabi: {
    src: ipanjabi_900.url,
    srcSet: [
      `${ipanjabi_320.url} 320w`,
      `${ipanjabi_480.url} 480w`,
      `${ipanjabi_720.url} 720w`,
      `${ipanjabi_900.url} 900w`,
    ].join(", "),
  },
  shirt: {
    src: ishirt_900.url,
    srcSet: [
      `${ishirt_320.url} 320w`,
      `${ishirt_480.url} 480w`,
      `${ishirt_720.url} 720w`,
      `${ishirt_900.url} 900w`,
    ].join(", "),
  },
  "couple-set": {
    src: icouple_set_900.url,
    srcSet: [
      `${icouple_set_320.url} 320w`,
      `${icouple_set_480.url} 480w`,
      `${icouple_set_720.url} 720w`,
      `${icouple_set_900.url} 900w`,
    ].join(", "),
  },
  "ladies-collection": {
    src: iladies_collection_900.url,
    srcSet: [
      `${iladies_collection_320.url} 320w`,
      `${iladies_collection_480.url} 480w`,
      `${iladies_collection_720.url} 720w`,
      `${iladies_collection_900.url} 900w`,
    ].join(", "),
  },
};

export function categoryImage(slug: string, fallback: string): CategoryImage {
  return CATEGORY_IMAGES[slug] ?? { src: resolveAssetUrl(fallback), srcSet: "" };
}
