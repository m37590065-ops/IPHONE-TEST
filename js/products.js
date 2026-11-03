/* ==========================================================================
   products.js — Product data (single source of truth) for the Collection
   Phone Collection redesign — step 4
   ==========================================================================
   Plain global object, loaded with defer before main.js. No modules.
   Uses only real project colors/tokens; images follow /assets/images/{id}/{key}.webp
   with fallbacks if files are missing. Missing model name: leave empty string.
   ========================================================================= */

(function () {
  "use strict";

  var PRODUCTS = {
    "light-blue": {
      id: "light-blue",
      nameEn: "Light Blue",
      nameAr: "الأزرق الفاتح",
      hex: "#A3C9E2",
      pantone: "Pantone 2121",
      headline: "هدوء يلفت الأنظار.",
      description: "لون مستوحى من صفاء السماء وهدوء التفاصيل، يمنح الهاتف حضورًا أنيقًا وعصريًا دون مبالغة.",
      button: "اكتشف الأزرق",
      model: "",
      imageAlt: "هاتف بلون الأزرق الفاتح",
      imageWidth: 736,
      imageHeight: 736,
      images: {
        front: "assets/images/light-blue.jpeg",
        back: "assets/images/light-blue/back.webp",
        side: "assets/images/light-blue/side.webp",
        camera: "assets/images/light-blue/camera.webp",
        material: "assets/images/light-blue/material.webp",
        lifestyle: "assets/images/light-blue/lifestyle.webp"
      }
    },
    "dark-cherry": {
      id: "dark-cherry",
      nameEn: "Dark Cherry",
      nameAr: "الكرز الداكن",
      hex: "#581825",
      pantone: "Pantone 6076",
      headline: "جرأة تحمل طابعًا خاصًا.",
      description: "درجة عميقة وغنية تجمع بين الفخامة والتميّز، لمن يفضّل الألوان التي تترك انطباعًا من النظرة الأولى.",
      button: "اكتشف الكرز الداكن",
      model: "",
      imageAlt: "هاتف بلون الكرز الداكن",
      imageWidth: 736,
      imageHeight: 888,
      images: {
        front: "assets/images/dark-cherry.jpeg",
        back: "assets/images/dark-cherry/back.webp",
        side: "assets/images/dark-cherry/side.webp",
        camera: "assets/images/dark-cherry/camera.webp",
        material: "assets/images/dark-cherry/material.webp",
        lifestyle: "assets/images/dark-cherry/lifestyle.webp"
      }
    },
    "dark-gray": {
      id: "dark-gray",
      nameEn: "Dark Gray",
      nameAr: "الرمادي الداكن",
      hex: "#2D3136",
      pantone: "Pantone 426C",
      headline: "قوة في أبسط تفاصيلها.",
      description: "لون متوازن بطابع عملي وأنيق، يجمع بين المظهر العصري والهدوء الذي لا يفقد جاذبيته مع الوقت.",
      button: "اكتشف الرمادي الداكن",
      model: "",
      imageAlt: "هاتف بلون الرمادي الداكن",
      imageWidth: 736,
      imageHeight: 697,
      images: {
        front: "assets/images/dark-gray.jpeg",
        back: "assets/images/dark-gray/back.webp",
        side: "assets/images/dark-gray/side.webp",
        camera: "assets/images/dark-gray/camera.webp",
        material: "assets/images/dark-gray/material.webp",
        lifestyle: "assets/images/dark-gray/lifestyle.webp"
      }
    },
    "silver": {
      id: "silver",
      nameEn: "Silver",
      nameAr: "الفضي",
      hex: "#E2E8F0",
      pantone: "Pantone 427C",
      headline: "أناقة تتجاوز الزمن.",
      description: "لون فضي نقي يعكس البساطة والرقي، ويمنح الهاتف مظهرًا كلاسيكيًا يناسب مختلف الأذواق.",
      button: "اكتشف الفضي",
      model: "",
      imageAlt: "هاتف باللون الفضي من الأمام والخلف",
      imageWidth: 1200,
      imageHeight: 1200,
      images: {
        front: "assets/images/phone-silver.jpg",
        back: "assets/images/silver/back.webp",
        side: "assets/images/silver/side.webp",
        camera: "assets/images/silver/camera.webp",
        material: "assets/images/silver/material.webp",
        lifestyle: "assets/images/silver/lifestyle.webp"
      }
    }
  };

  var ORDER = ["light-blue", "dark-cherry", "dark-gray", "silver"];

  function getProduct(id) {
    if (!id) return null;
    return PRODUCTS[id] || null;
  }

  function listProducts() {
    return ORDER.map(function (id) {
      return PRODUCTS[id];
    }).filter(Boolean);
  }

  function getImagePath(product, key) {
    if (!product || !product.images) return null;
    if (key && product.images[key]) return product.images[key];
    // fallback to front if requested key missing
    if (product.images.front) return product.images.front;
    return null;
  }

  // Expose as plain global (no modules)
  window.PhoneSite = window.PhoneSite || {};
  window.PhoneSite.products = PRODUCTS;
  window.PhoneSite.productOrder = ORDER;
  window.PhoneSite.getProduct = getProduct;
  window.PhoneSite.listProducts = listProducts;
  window.PhoneSite.getProductImage = getImagePath;
})();
