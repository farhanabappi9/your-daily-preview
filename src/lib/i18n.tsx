import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "bn" | "en";

type Dict = Record<string, { bn: string; en: string }>;

export const dict: Dict = {
  // Header / nav
  "nav.home": { bn: "হোম", en: "Home" },
  "nav.about": { bn: "আমাদের সম্পর্কে", en: "About Us" },
  "nav.shop": { bn: "শপ", en: "Shop" },
  "nav.contact": { bn: "যোগাযোগ", en: "Contact Us" },
  "nav.categories": { bn: "সব ক্যাটাগরি দেখুন", en: "Browse All Categories" },
  "nav.login": { bn: "লগইন", en: "Login" },
  "nav.search": { bn: "পণ্য খুঁজুন", en: "Search product" },
  "nav.support": { bn: "সাপোর্ট সেন্টার", en: "Support Center" },
  "nav.cart": { bn: "কার্ট", en: "Cart" },
  "nav.menu": { bn: "মেনু", en: "Menu" },

  // Home
  "home.featured": { bn: "ফিচারড ক্যাটাগরি", en: "Featured Categories" },
  "home.recent": { bn: "সাম্প্রতিক পণ্য", en: "Recent Products" },
  "home.items": { bn: "টি পণ্য", en: "items" },
  "home.hero.shop": { bn: "এখনই কিনুন", en: "Shop Now" },
  "home.hero.explore": { bn: "কালেকশন দেখুন", en: "Explore Collection" },
  "home.slide1.kicker": { bn: "নতুন কালেকশন", en: "New Collection" },
  "home.slide1.title": { bn: "প্রিমিয়াম কাপল সেট", en: "Premium Couple Sets" },
  "home.slide1.sub": {
    bn: "ভালোবাসার সেরা উপহার — শাড়ি ও পাঞ্জাবি একসাথে",
    en: "The finest match — saree and panjabi together",
  },
  "home.slide2.kicker": { bn: "বিশেষ অফার", en: "Special Offer" },
  "home.slide2.title": { bn: "৫০% পর্যন্ত ছাড়", en: "Up to 50% OFF" },
  "home.slide2.sub": {
    bn: "প্রিমিয়াম শাড়ির উপর সীমিত সময়ের অফার",
    en: "Limited time offer on premium sarees",
  },
  "home.slide3.kicker": { bn: "ট্রেন্ডিং", en: "Trending" },
  "home.slide3.title": { bn: "লাক্সারি থ্রি পিস", en: "Luxury Three Piece" },
  "home.slide3.sub": {
    bn: "এমব্রয়ডারি সেট — যেকোনো অনুষ্ঠানে অনন্য",
    en: "Embroidered sets — unique for every occasion",
  },
  // Product / cart
  "btn.order": { bn: "অর্ডার করুন", en: "Order Now" },
  "btn.addCart": { bn: "কার্টে যোগ করুন", en: "Add to Cart" },
  "btn.buyNow": { bn: "এখনই কিনুন", en: "Buy Now" },
  "btn.checkout": { bn: "চেকআউট করুন", en: "Proceed to Checkout" },
  "btn.continue": { bn: "শপিং চালিয়ে যান", en: "Continue Shopping" },
  "cart.title": { bn: "শপিং কার্ট", en: "Shopping Cart" },
  "cart.empty": { bn: "আপনার কার্ট এখনো খালি।", en: "Your cart is empty." },
  "cart.summary": { bn: "অর্ডার সামারি", en: "Order Summary" },
  "cart.subtotal": { bn: "সাবটোটাল", en: "Subtotal" },
  "cart.shipping": { bn: "শিপিং", en: "Shipping" },
  "cart.shippingCalc": { bn: "চেকআউটে হিসাব হবে", en: "Calculated at checkout" },
  "cart.total": { bn: "মোট", en: "Total" },
  "product.size": { bn: "সাইজ", en: "Size" },
  "product.qty": { bn: "পরিমাণ", en: "Quantity" },
  "product.inStock": { bn: "স্টকে আছে", en: "In stock" },
  "product.oos": { bn: "স্টক নেই", en: "Out of stock" },
  "product.related": { bn: "সম্পর্কিত পণ্য", en: "Related Products" },
  "product.save": { bn: "সাশ্রয়", en: "Save" },
  "product.cod": { bn: "ক্যাশ অন ডেলিভারি আছে", en: "Cash on Delivery available" },
  "product.ship": {
    bn: "ঢাকার ভিতরে ৳ ৮০, বাইরে ৳ ১৫০ ডেলিভারি চার্জ",
    en: "Inside Dhaka ৳ 80, Outside Dhaka ৳ 150 delivery charge",
  },
  "product.return": { bn: "৭ দিনের রিটার্ন গ্যারান্টি", en: "7-day return guarantee" },
  // Checkout
  "co.title": { bn: "চেকআউট", en: "Checkout" },
  "co.billing": { bn: "বিলিং তথ্য", en: "Billing Details" },
  "co.name": { bn: "নাম", en: "Name" },
  "co.phone": { bn: "মোবাইল নম্বর", en: "Mobile Number" },
  "co.address": { bn: "সম্পূর্ণ ঠিকানা", en: "Full Address" },
  "co.area": { bn: "ডেলিভারি এরিয়া", en: "Delivery Area" },
  "co.inside": { bn: "ঢাকার ভিতরে", en: "Inside Dhaka" },
  "co.outside": { bn: "ঢাকার বাইরে", en: "Outside Dhaka" },
  "co.payment": { bn: "পেমেন্ট পদ্ধতি", en: "Payment Method" },
  "co.cod": {
    bn: "ক্যাশ অন ডেলিভারি — পণ্য হাতে পেয়ে টাকা পরিশোধ করুন।",
    en: "Cash on Delivery — Pay when you receive the product.",
  },
  "co.order": { bn: "আপনার অর্ডার", en: "Your Order" },
  "co.confirm": { bn: "অর্ডার কনফার্ম করুন", en: "Confirm Order" },
  // Thank you
  "ty.title": {
    bn: "ধন্যবাদ! আপনার অর্ডার সফল হয়েছে",
    en: "Thank you! Your order was successful",
  },
  "ty.body": {
    bn: "আপনার অর্ডারটি সফলভাবে গৃহীত হয়েছে। শীঘ্রই আমাদের প্রতিনিধি যোগাযোগ করবেন।",
    en: "Your order has been received. Our representative will contact you shortly.",
  },
  "ty.orderId": { bn: "অর্ডার আইডি", en: "Order ID" },
  "ty.home": { bn: "হোমে ফিরুন", en: "Back to Home" },
  // Footer
  "footer.tagline": {
    bn: "আপনার পছন্দের ফ্যাশন এখন হাতের নাগালে। প্রিমিয়াম কোয়ালিটির থ্রি পিস, শাড়ি, কাপল সেট ও আরও অনেক কিছু।",
    en: "Your favourite fashion, now within reach. Premium three piece, saree, couple sets and much more.",
  },
  "footer.quick": { bn: "কুইক লিংকস", en: "Quick Links" },
  "footer.cs": { bn: "কাস্টমার সার্ভিস", en: "Customer Service" },
  "footer.contact": { bn: "যোগাযোগ", en: "Contact" },
  "footer.return": { bn: "রিটার্ন ও রিফান্ড পলিসি", en: "Return & Refund Policy" },
  "footer.shipping": { bn: "শিপিং পলিসি", en: "Shipping Policy" },
  "footer.terms": { bn: "টার্মস অ্যান্ড কন্ডিশনস", en: "Terms & Conditions" },
  "footer.privacy": { bn: "প্রাইভেসি পলিসি", en: "Privacy Policy" },
  "footer.rights": {
    bn: "সর্বস্বত্ব সংরক্ষিত। Developed by Md Atikur Rahman",
    en: "All rights reserved. Developed by Md Atikur Rahman",
  },
  // Shop
  "shop.title": { bn: "সব পণ্য", en: "Shop All Products" },
  "shop.searchPh": { bn: "পণ্য খুঁজুন...", en: "Search products..." },
  "shop.allCat": { bn: "সব ক্যাটাগরি", en: "All Categories" },
  "shop.newest": { bn: "নতুন", en: "Newest" },
  "shop.priceAsc": { bn: "দাম: কম থেকে বেশি", en: "Price: Low to High" },
  "shop.priceDesc": { bn: "দাম: বেশি থেকে কম", en: "Price: High to Low" },
  "shop.found": { bn: "পণ্য পাওয়া গেছে", en: "products found" },
  "shop.none": { bn: "কোন পণ্য পাওয়া যায়নি।", en: "No products found." },
  // About
  "about.title": { bn: "আমাদের সম্পর্কে", en: "About Ahsan Fashion" },
  "about.p1": {
    bn: "Ahsan Fashion বাংলাদেশের একটি অন্যতম অনলাইন ফ্যাশন স্টোর। আমরা প্রিমিয়াম কোয়ালিটির থ্রি পিস, শাড়ি, কাপল সেট, টু পিস ও মেন্স ফ্যাশন সহ বিভিন্ন ধরনের পণ্য বিক্রি করি।",
    en: "Ahsan Fashion is a leading online fashion store in Bangladesh. We sell premium quality three piece, saree, couple sets, two piece, men's fashion and much more.",
  },
  "about.p2": {
    bn: "আমাদের লক্ষ্য সাশ্রয়ী মূল্যে সেরা কোয়ালিটির পোশাক পৌঁছে দেওয়া। আমরা সারা বাংলাদেশে হোম ডেলিভারি সার্ভিস প্রদান করি।",
    en: "Our mission is to deliver the best quality clothing at affordable prices. We provide nationwide home delivery service across Bangladesh.",
  },
  "about.p3": {
    bn: "আমাদের সকল পণ্য ১০০% কোয়ালিটি চেক করে পাঠানো হয়। এছাড়া ৭ দিনের রিটার্ন গ্যারান্টি রয়েছে।",
    en: "All products are 100% quality checked before dispatch, with a 7-day return guarantee.",
  },
  "about.happy": { bn: "সন্তুষ্ট গ্রাহক", en: "Happy Customers" },
  "about.products": { bn: "পণ্য", en: "Products" },
  "about.districts": { bn: "জেলায় ডেলিভারি", en: "Districts Delivery" },
  // Contact
  "contact.title": { bn: "যোগাযোগ করুন", en: "Contact Us" },
  "contact.phone": { bn: "ফোন", en: "Phone" },
  "contact.email": { bn: "ইমেইল", en: "Email" },
  "contact.address": { bn: "ঠিকানা", en: "Address" },
  "contact.name": { bn: "আপনার নাম", en: "Your Name" },
  "contact.emailPh": { bn: "আপনার ইমেইল", en: "Your Email" },
  "contact.msg": { bn: "আপনার বার্তা", en: "Your Message" },
  "contact.send": { bn: "বার্তা পাঠান", en: "Send Message" },
  "contact.sent": { bn: "বার্তা পাঠানো হয়েছে!", en: "Message sent!" },
  "contact.sentSub": { bn: "আমরা শীঘ্রই যোগাযোগ করব।", en: "We will contact you shortly." },
  // Policies
  "policy.privacy": { bn: "প্রাইভেসি পলিসি", en: "Privacy Policy" },
  "policy.terms": { bn: "টার্মস অ্যান্ড কন্ডিশনস", en: "Terms & Conditions" },
  "policy.return": { bn: "রিটার্ন পলিসি", en: "Return Policy" },
  // Shop — advanced
  "shop.kicker": { bn: "কালেকশন", en: "Collection" },
  "shop.subtitle": {
    bn: "হাতে বাছাই করা প্রিমিয়াম পোশাক — সারা বাংলাদেশে ক্যাশ অন ডেলিভারি সুবিধায়।",
    en: "Hand-picked premium clothing — cash on delivery all across Bangladesh.",
  },
  "shop.filters": { bn: "ফিল্টার", en: "Filters" },
  "shop.reset": { bn: "রিসেট করুন", en: "Reset" },
  "shop.sortBy": { bn: "সাজান", en: "Sort by" },
  "shop.category": { bn: "ক্যাটাগরি", en: "Category" },
  "shop.priceRange": { bn: "সর্বোচ্চ দাম", en: "Max price" },
  "shop.inStockOnly": { bn: "শুধু স্টকে আছে এমন পণ্য", en: "In-stock items only" },
  "shop.discountFirst": { bn: "সর্বোচ্চ ছাড়", en: "Biggest discount" },
  "shop.showing": { bn: "দেখানো হচ্ছে", en: "Showing" },
  "shop.of": { bn: "টির মধ্যে", en: "of" },
  "shop.grid": { bn: "গ্রিড ভিউ", en: "Grid view" },
  "shop.list": { bn: "লিস্ট ভিউ", en: "List view" },
  "shop.stat1": { bn: "পণ্য", en: "Products" },
  "shop.stat2": { bn: "ক্যাটাগরি", en: "Categories" },
  "shop.stat3": { bn: "গড় ছাড়", en: "Avg. discount" },
  // Product — advanced
  "product.desc": { bn: "পণ্যের বিবরণ", en: "Description" },
  "product.specs": { bn: "স্পেসিফিকেশন", en: "Specification" },
  "product.delivery": { bn: "ডেলিভারি ও রিটার্ন", en: "Delivery & Return" },
  "product.sku": { bn: "প্রোডাক্ট কোড", en: "Product code" },
  "product.fabric": { bn: "ফেব্রিক", en: "Fabric" },
  "product.fabricVal": { bn: "প্রিমিয়াম কটন / সফ্ট ব্লেন্ড", en: "Premium cotton / soft blend" },
  "product.wash": { bn: "ওয়াশ কেয়ার", en: "Wash care" },
  "product.washVal": { bn: "হ্যান্ড ওয়াশ, ঠান্ডা পানিতে", en: "Hand wash in cold water" },
  "product.deliveryTime": { bn: "ডেলিভারি সময়", en: "Delivery time" },
  "product.deliveryTimeVal": { bn: "২–৪ কর্মদিবস", en: "2–4 working days" },
  "product.lowStock": { bn: "মাত্র কয়েকটি বাকি!", en: "Only a few left!" },
  "product.youSave": { bn: "আপনি সাশ্রয় করছেন", en: "You save" },
  "product.share": { bn: "শেয়ার করুন", en: "Share" },
  "product.copied": { bn: "লিংক কপি হয়েছে", en: "Link copied" },
  "product.added": { bn: "কার্টে যোগ হয়েছে", en: "Added to cart" },
  "product.total": { bn: "মোট দাম", en: "Total price" },
  // Cart — advanced
  "cart.items": { bn: "টি পণ্য", en: "items" },
  "cart.item": { bn: "পণ্য", en: "Item" },
  "cart.price": { bn: "দাম", en: "Price" },
  "cart.qty": { bn: "পরিমাণ", en: "Qty" },
  "cart.lineTotal": { bn: "সর্বমোট", en: "Total" },
  "cart.remove": { bn: "সরান", en: "Remove" },
  "cart.saved": { bn: "আপনি সাশ্রয় করছেন", en: "You are saving" },
  "cart.emptySub": {
    bn: "পছন্দের পোশাক যোগ করে অর্ডার সম্পন্ন করুন।",
    en: "Add your favourite outfits and complete the order.",
  },
  "cart.secure": { bn: "১০০% নিরাপদ ক্যাশ অন ডেলিভারি", en: "100% safe cash on delivery" },
  // Checkout — advanced
  "co.step1": { bn: "কার্ট", en: "Cart" },
  "co.step2": { bn: "তথ্য ও পেমেন্ট", en: "Details & Payment" },
  "co.step3": { bn: "কনফার্ম", en: "Confirmed" },
  "co.subtitle": {
    bn: "নিচের তথ্যগুলো পূরণ করুন — অর্ডার কনফার্ম করার পর আমরা কল দিয়ে নিশ্চিত করব।",
    en: "Fill in the details below — we will call you to confirm the order.",
  },
  "co.namePh": { bn: "যেমন: মোহাম্মদ রহিম", en: "e.g. Mohammad Rahim" },
  "co.phonePh": { bn: "০১XXXXXXXXX", en: "01XXXXXXXXX" },
  "co.addressPh": { bn: "বাসা/রোড, এলাকা, থানা, জেলা", en: "House/Road, Area, Thana, District" },
  "co.note": { bn: "অতিরিক্ত নোট (ঐচ্ছিক)", en: "Order note (optional)" },
  "co.notePh": { bn: "ডেলিভারি সংক্রান্ত নির্দেশনা", en: "Any delivery instruction" },
  "co.days1": { bn: "১–২ দিনে ডেলিভারি", en: "Delivery in 1–2 days" },
  "co.days2": { bn: "৩–৫ দিনে ডেলিভারি", en: "Delivery in 3–5 days" },
  "co.safe": {
    bn: "আপনার তথ্য সম্পূর্ণ গোপন রাখা হয়।",
    en: "Your information is kept fully confidential.",
  },
  // Thank you — advanced
  "ty.kicker": { bn: "অর্ডার কনফার্মড", en: "Order confirmed" },
  "ty.summary": { bn: "অর্ডার সামারি", en: "Order Summary" },
  "ty.deliverTo": { bn: "ডেলিভারি ঠিকানা", en: "Delivery address" },
  "ty.payable": { bn: "ডেলিভারিতে পরিশোধযোগ্য", en: "Payable on delivery" },
  "ty.next": { bn: "এরপর কী হবে?", en: "What happens next?" },
  "ty.next1": {
    bn: "আমাদের প্রতিনিধি ফোনে অর্ডার নিশ্চিত করবেন।",
    en: "Our representative will confirm your order by phone.",
  },
  "ty.next2": {
    bn: "প্যাকেজিং শেষে কুরিয়ারে পাঠানো হবে।",
    en: "After packaging it is handed to the courier.",
  },
  "ty.next3": {
    bn: "পণ্য হাতে পেয়ে টাকা পরিশোধ করবেন।",
    en: "You pay in cash when the parcel arrives.",
  },
  "ty.print": { bn: "রসিদ প্রিন্ট করুন", en: "Print receipt" },
};

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: keyof typeof dict) => string };
const C = createContext<Ctx | null>(null);
const KEY = "nm_lang_v1";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("bn");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) as Lang | null;
      if (saved === "en" || saved === "bn") setLangState(saved);
    } catch {}
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {}
    if (typeof document !== "undefined") document.documentElement.lang = l;
  };

  const t = (k: keyof typeof dict) => dict[k]?.[lang] ?? String(k);

  return <C.Provider value={{ lang, setLang, t }}>{children}</C.Provider>;
}

export function useI18n() {
  const c = useContext(C);
  if (!c) throw new Error("useI18n must be used within I18nProvider");
  return c;
}
