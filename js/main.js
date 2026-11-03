/* ==========================================================================
   main.js — Site utilities and behaviors
   ========================================================================== */
(function () {
  "use strict";

  var PhoneSite = window.PhoneSite || {};

  /* ----------------------------------------------------------------------
     Configuration
     ---------------------------------------------------------------------- */

  /**
   * Site configuration.
   *
   * showTrustSection: set to false *before* this script runs to remove the
   * "Why Choose Us" (#trust) section and any anchors pointing to it, e.g. an
   * inline script in <head>:
   *   <script>window.PhoneSite = { config: { showTrustSection: false } };</script>
   * Defaults to true when not provided.
   * @type {{showTrustSection: boolean}}
   */
  PhoneSite.config = PhoneSite.config || { showTrustSection: true };

  /**
   * Order configuration (step 8).
   * pricing stays empty on purpose: no invented prices or delivery fees.
   * fill unitPrice / deliveryCost / currency later to reveal the price rows.
   */
  PhoneSite.config.delivery = PhoneSite.config.delivery || {};
  if (typeof PhoneSite.config.delivery.enabled !== "boolean") {
    PhoneSite.config.delivery.enabled = true;
  }

  PhoneSite.config.pricing = PhoneSite.config.pricing || {};
  if (!("unitPrice" in PhoneSite.config.pricing)) {
    PhoneSite.config.pricing.unitPrice = null;
  }
  if (!("deliveryCost" in PhoneSite.config.pricing)) {
    PhoneSite.config.pricing.deliveryCost = null;
  }
  if (typeof PhoneSite.config.pricing.currency !== "string") {
    PhoneSite.config.pricing.currency = "";
  }

  /**
   * Order endpoint (Google Apps Script web app URL ending in /exec).
   * Empty by default: the form explains that ordering is not configured yet
   * instead of pretending that an unsent order succeeded.
   * @type {string}
   */
  PhoneSite.config.orderEndpoint =
    "https://script.google.com/macros/s/AKfycbyZmgLHTRQubdaJm0Quz_7j-s0Hk3G8dDEWQy5gaKA5ew3G-J_BPDmYhIC00SmaERsc/exec";

  /**
   * Algerian mobile rule, applied to the normalised local 10-digit format:
   * 05/06/07 followed by 8 digits. Country-code input (+213 / 00213) is
   * normalised before this test. Change this one pattern to change the rule.
   * @type {RegExp}
   */
  PhoneSite.config.phonePattern = PhoneSite.config.phonePattern || /^0[567][0-9]{8}$/;

  /* ----------------------------------------------------------------------
     Helpers
     ---------------------------------------------------------------------- */
  function qs(selector, context) {
    return (context || document).querySelector(selector);
  }

  function qsa(selector, context) {
    return Array.prototype.slice.call(
      (context || document).querySelectorAll(selector)
    );
  }

  /**
   * Shared image-fallback: when a card photo is missing or fails to load,
   * show the CSS `.phone-placeholder` composition instead of the broken image.
   * Used by the Collection, Color Philosophy and Specs cards.
   * @param {Element} container Element that receives the `is-fallback` class
   * @param {?Element} [img] Photo to watch; looked up inside `container` if omitted
   */
  PhoneSite.bindImageFallback = function (container, img) {
    if (!container) return;

    var photo = img || qs("img", container);
    if (!photo) {
      container.classList.add("is-fallback");
      return;
    }

    function showFallback() {
      container.classList.add("is-fallback");
    }

    function clearFallback() {
      container.classList.remove("is-fallback");
    }

    photo.addEventListener("error", showFallback);
    photo.addEventListener("load", clearFallback);
    if (
      photo.loading !== "lazy" &&
      photo.complete &&
      photo.naturalWidth === 0
    ) {
      showFallback();
    }
  };

  /**
   * Honour PhoneSite.config: drop sections that are switched off and clean up
   * any links that pointed at them (so no dead anchors remain).
   */
  PhoneSite.applyConfig = function () {
    if (PhoneSite.config && PhoneSite.config.showTrustSection === false) {
      var trust = document.getElementById("trust");
      if (trust && trust.parentNode) trust.parentNode.removeChild(trust);

      qsa('a[href="#trust"]').forEach(function (link) {
        var li = link.closest("li");
        if (li && li.querySelectorAll("a").length === 1) {
          li.parentNode.removeChild(li);
        } else {
          link.parentNode.removeChild(link);
        }
      });
    }
  };

  /* ----------------------------------------------------------------------
     Reduced motion + scroll reveal (step 1)
     ---------------------------------------------------------------------- */

  /**
   * Whether the user prefers reduced motion.
   * @returns {boolean}
   */
  PhoneSite.prefersReducedMotion = function () {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  };

  /**
   * Reveal [data-reveal] elements as they enter the viewport.
   * With reduced motion, everything is shown immediately.
   */
  PhoneSite.createRevealObserver = function () {
    var targets = document.querySelectorAll("[data-reveal]");

    if (!targets.length) return;

    if (PhoneSite.prefersReducedMotion() || !("IntersectionObserver" in window)) {
      targets.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    targets.forEach(function (el) {
      observer.observe(el);
    });
  };

  /* ----------------------------------------------------------------------
     Hero: image fallback, staggered entrance, subtle parallax
     ---------------------------------------------------------------------- */

  /**
   * Move the hero media by at most 8px against the scroll position.
   * Skipped entirely when reduced motion is preferred.
   */
  PhoneSite.updateHeroParallax = function () {
    var hero = qs(".hero");
    var media = qs("[data-hero-media]");

    if (!hero || !media) return;

    if (PhoneSite.prefersReducedMotion()) {
      media.style.removeProperty("--hero-parallax");
      return;
    }

    var rect = hero.getBoundingClientRect();
    var progress = -rect.top / Math.max(rect.height, 1);
    progress = Math.min(Math.max(progress, 0), 1);

    media.style.setProperty("--hero-parallax", (-8 * progress).toFixed(2) + "px");
  };

  /**
   * Reveal the hero once the image has settled, and swap in the CSS
   * phone composition if the image file is missing or fails to load.
   */
  PhoneSite.initHero = function () {
    var hero = qs(".hero");
    if (!hero) return;

    var media = qs("[data-hero-media]", hero);
    var img = media ? qs(".hero__img", media) : null;
    var revealed = false;

    function reveal() {
      if (revealed) return;
      revealed = true;
      hero.classList.add("is-ready");
    }

    function showFallback() {
      if (media) media.classList.add("is-fallback");
      reveal();
    }

    if (!img) {
      reveal();
      return;
    }

    img.addEventListener("error", showFallback);
    img.addEventListener("load", reveal);

    if (img.complete) {
      // Cached (or already failed) before this script ran.
      if (img.naturalWidth === 0) showFallback();
      else reveal();
    } else {
      // Safety net: never leave the hero hidden if the image stalls.
      window.setTimeout(reveal, 900);
    }
  };

  /* ----------------------------------------------------------------------
     Header: scroll state (rAF-throttled, passive)
     ---------------------------------------------------------------------- */
  PhoneSite.initHeader = function () {
    var header = document.getElementById("site-header");
    if (!header) return;

    var ticking = false;

    function update() {
      ticking = false;
      header.classList.toggle("is-scrolled", window.scrollY > 24);
      PhoneSite.updateHeroParallax();
    }

    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          ticking = true;
          window.requestAnimationFrame(update);
        }
      },
      { passive: true }
    );

    update();
  };

  /* ----------------------------------------------------------------------
     Mobile menu: open/close, Escape, overlay, focus trap, scroll lock
     ---------------------------------------------------------------------- */
  PhoneSite.initMobileMenu = function () {
    var header = document.getElementById("site-header");
    if (!header) return;

    var toggle = qs(".site-header__toggle", header);
    var nav = document.getElementById("site-nav");
    var overlay = qs(".site-nav__overlay", header);

    if (!toggle || !nav || !overlay) return;

    var closeButton = qs(".site-nav__close", nav);
    var desktopQuery = window.matchMedia("(min-width: 900px)");
    var root = document.documentElement;
    var isOpen = false;

    function panelFocusables() {
      return qsa("a[href], button:not([disabled])", nav).filter(function (el) {
        return el.offsetParent !== null;
      });
    }

    function focusIntoPanel() {
      var target =
        closeButton && closeButton.offsetParent !== null
          ? closeButton
          : panelFocusables()[0];
      if (target) target.focus({ preventScroll: true });
    }

    // The root uses `scrollbar-gutter: stable`, so hiding the scrollbar does
    // not change the content width or shift the header.
    function lockScroll() {
      root.classList.add("is-menu-open");
    }

    function unlockScroll() {
      root.classList.remove("is-menu-open");
    }

    function setToggleState(open) {
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "إغلاق القائمة" : "فتح القائمة");
    }

    function openMenu() {
      if (isOpen) return;
      isOpen = true;
      header.classList.add("is-menu-open");
      setToggleState(true);
      lockScroll();

      // Wait for a style pass so the panel is visible before moving focus.
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(focusIntoPanel);
      });
    }

    function closeMenu(returnFocus) {
      if (!isOpen) return;
      isOpen = false;
      header.classList.remove("is-menu-open");
      setToggleState(false);
      unlockScroll();
      if (returnFocus) toggle.focus({ preventScroll: true });
    }

    toggle.addEventListener("click", function () {
      if (isOpen) closeMenu(true);
      else openMenu();
    });

    if (closeButton) {
      closeButton.addEventListener("click", function () {
        closeMenu(true);
      });
    }

    overlay.addEventListener("click", function () {
      closeMenu(true);
    });

    nav.addEventListener("click", function (event) {
      var link = event.target.closest && event.target.closest("a[href]");
      if (link) closeMenu(true);
    });

    document.addEventListener("keydown", function (event) {
      if (!isOpen) return;

      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
        return;
      }

      if (event.key !== "Tab") return;

      var focusables = panelFocusables();
      if (!focusables.length) {
        event.preventDefault();
        return;
      }

      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      var active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || focusables.indexOf(active) === -1) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || focusables.indexOf(active) === -1) {
        event.preventDefault();
        first.focus();
      }
    });

    function onDesktopChange(event) {
      if (event.matches) closeMenu(false);
    }

    if (typeof desktopQuery.addEventListener === "function") {
      desktopQuery.addEventListener("change", onDesktopChange);
    } else if (typeof desktopQuery.addListener === "function") {
      desktopQuery.addListener(onDesktopChange);
    }
  };

  /* ----------------------------------------------------------------------
     Active nav link: highlights the section currently in view
     (only for anchors whose target ids already exist in the page)
     ---------------------------------------------------------------------- */
  PhoneSite.initActiveNav = function () {
    var links = qsa(".site-nav__link");
    if (!links.length || !("IntersectionObserver" in window)) return;

    var pairs = [];
    links.forEach(function (link) {
      var id = (link.getAttribute("href") || "").replace(/^#/, "");
      var section = id ? document.getElementById(id) : null;
      if (section) pairs.push({ link: link, section: section });
    });
    if (!pairs.length) return;

    var visible = Object.create(null);
    var current = qs('.site-nav__link[aria-current="true"]');

    function applyActive() {
      var activeId = "";

      if (current) {
        var currentId = (current.getAttribute("href") || "").replace(/^#/, "");
        if (visible[currentId]) activeId = currentId;
      }

      if (!activeId) {
        for (var id in visible) {
          if (visible[id]) {
            activeId = id;
            break;
          }
        }
      }

      links.forEach(function (link) {
        var href = link.getAttribute("href") || "";
        if (activeId && href === "#" + activeId) {
          link.setAttribute("aria-current", "true");
          current = link;
        } else {
          link.removeAttribute("aria-current");
        }
      });
      if (!activeId) current = null;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) visible[entry.target.id] = true;
          else delete visible[entry.target.id];
        });
        applyActive();
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );

    pairs.forEach(function (item) {
      observer.observe(item.section);
    });
  };

  /* ----------------------------------------------------------------------
     Collection: product data, image fallback, mobile dots, highlight
     ---------------------------------------------------------------------- */
  /* Palette per phone colour. These are the exact theme tokens used by
     css/base.css; names, Pantone and HEX display values stay untouched. */
  var COLOR_THEMES = {
    "light-blue": {
      base: "#A3C9E2",
      snow: "#EAF4FA",
      mist: "#DCEBF5",
      calm: "#C5DDEB",
      "cool-white": "#F7FBFD",
      ink: "#29465C"
    },
    "dark-cherry": {
      base: "#581825",
      soft: "#8B4654",
      "rose-earth": "#EAD9DD",
      "rose-gray": "#F2E9EB",
      "warm-white": "#FCF8F8",
      deep: "#35121A"
    },
    "dark-gray": {
      base: "#2D3136",
      steel: "#555E68",
      light: "#DCE0E5",
      mist: "#ECEFF2",
      "metal-white": "#F7F8FA",
      charcoal: "#171B20"
    },
    "silver": {
      base: "#E2E8F0",
      light: "#F1F4F7",
      metal: "#D4DCE5",
      cool: "#E8EDF2",
      pure: "#FFFFFF",
      "metal-dark": "#687583"
    }
  };

  PhoneSite.colors =
    typeof PhoneSite.listProducts === "function"
      ? PhoneSite.listProducts().map(function (product) {
          return {
            key: product.id,
            nameEn: product.nameEn,
            nameAr: product.nameAr,
            pantone: product.pantone,
            hex: product.hex,
            model: product.model,
            theme: COLOR_THEMES[product.id] || null
          };
        })
      : [];

  PhoneSite.gallerySlots = [
    { key: "front", label: "المنظر الأمامي" },
    { key: "back", label: "المنظر الخلفي" },
    { key: "side", label: "المنظر الجانبي" },
    { key: "camera", label: "الكاميرا" },
    { key: "edges", label: "الحواف" },
    { key: "ad", label: "الصورة الإعلانية" },
    { key: "design", label: "التصميم" }
  ];

  PhoneSite.galleryExtensions = ["webp", "jpg", "jpeg", "png"];

  var GALLERY_IMAGES = {
    "light-blue": {
      front: { src: "assets/images/gallery/light-blue/front.jpeg" }
    },
    "dark-cherry": {
      front: { src: "assets/images/gallery/dark-cherry/front.jpeg" }
    },
    "dark-gray": {
      front: { src: "assets/images/gallery/dark-gray/front.jpeg" }
    },
    "silver": {
      ad: {
        src: "assets/images/gallery/silver/ad.jpg",
        fallback: "assets/images/phone-silver.jpg"
      }
    }
  };

  PhoneSite.images = PhoneSite.images || {};

  PhoneSite.colors.forEach(function (color) {
    var colorImages = PhoneSite.images[color.key];

    if (!colorImages || typeof colorImages !== "object") {
      colorImages = PhoneSite.images[color.key] = {};
    }

    PhoneSite.gallerySlots.forEach(function (slot) {
      var entry = colorImages[slot.key];
      var known = GALLERY_IMAGES[color.key] && GALLERY_IMAGES[color.key][slot.key];

      if (!entry || typeof entry !== "object") {
        entry = colorImages[slot.key] = {};
      }

      if (known) {
        Object.keys(known).forEach(function (property) {
          entry[property] = known[property];
        });
      }

      if (!entry.path) {
        entry.path = "assets/images/gallery/" + color.key + "/" + slot.key;
      }

      if (!Array.isArray(entry.extensions) || !entry.extensions.length) {
        entry.extensions = PhoneSite.galleryExtensions.slice();
      }

      if (!entry.label) entry.label = slot.label;

      if (!entry.alt) {
        entry.alt = "هاتف " + color.nameAr + " - " + slot.label;
      }
    });

    if (color.key === "silver" && colorImages.ad && !colorImages.ad.fallback) {
      colorImages.ad.fallback = "assets/images/phone-silver.jpg";
    }
  });

  function createCollectionCard(product) {
    var card = document.createElement("article");
    card.className = "card card--product phone-card";
    card.setAttribute("data-color", product.id);

    var media = document.createElement("div");
    media.className = "phone-card__media";

    var picture = document.createElement("picture");
    picture.className = "phone-card__picture";

    var frontImage = PhoneSite.getProductImage(product, "front");

    var source = document.createElement("source");
    source.type = /\.jpe?g(?:$|[?#])/i.test(frontImage)
      ? "image/jpeg"
      : "image/webp";
    source.setAttribute("srcset", frontImage);

    var image = document.createElement("img");
    image.className = "phone-card__img";
    image.width = product.imageWidth || 800;
    image.height = product.imageHeight || 1000;
    image.loading = "lazy";
    image.decoding = "async";
    image.setAttribute("src", frontImage);
    image.setAttribute(
      "alt",
      product.imageAlt || "هاتف بلون " + product.nameAr + " " + product.nameEn
    );

    picture.appendChild(source);
    picture.appendChild(image);

    var fallback = document.createElement("div");
    fallback.className = "phone-card__fallback";
    fallback.setAttribute("aria-hidden", "true");

    if (product.id === "silver") {
      var placeholder = document.createElement("span");
      placeholder.className = "phone-placeholder phone-placeholder--silver";
      fallback.appendChild(placeholder);
    } else if (
      product.id !== "dark-cherry" &&
      product.id !== "light-blue" &&
      product.id !== "dark-gray"
    ) {
      var swatch = document.createElement("span");
      swatch.className = "phone-card__swatch";
      swatch.style.backgroundColor = product.hex;

      var fallbackText = document.createElement("span");
      fallbackText.className = "phone-card__fallback-text";
      fallbackText.textContent = "صورة اللون قيد الإضافة";

      fallback.appendChild(swatch);
      fallback.appendChild(fallbackText);
    }

    media.appendChild(picture);

    if (
      product.id !== "dark-cherry" &&
      product.id !== "light-blue" &&
      product.id !== "dark-gray"
    ) {
      media.appendChild(fallback);
    }

    var body = document.createElement("div");
    body.className = "phone-card__body";

    var meta = document.createElement("div");
    meta.className = "phone-card__meta";

    var names = document.createElement("span");
    names.className = "phone-card__name";

    var nameAr = document.createElement("span");
    nameAr.className = "phone-card__name-ar";
    nameAr.textContent = product.nameAr;

    var nameEn = document.createElement("span");
    nameEn.className = "phone-card__name-en en";
    nameEn.lang = "en";
    nameEn.textContent = product.nameEn;

    var dot = document.createElement("span");
    dot.className = "phone-card__dot phone-card__dot--" + product.id;
    dot.setAttribute("aria-hidden", "true");

    var pantone = document.createElement("span");
    pantone.className = "phone-card__pantone en caption";
    pantone.textContent = product.pantone;

    var title = document.createElement("h3");
    title.className = "phone-card__title";
    title.textContent = product.headline;

    var description = document.createElement("p");
    description.className = "phone-card__desc";
    description.textContent = product.description;

    var link = document.createElement("a");
    link.className = "btn btn--secondary phone-card__btn";
    link.href = "#style";
    link.setAttribute("data-color", product.id);
    link.setAttribute(
      "aria-label",
      "اكتشف " + product.nameAr + " " + product.nameEn
    );
    link.textContent = product.button;

    link.addEventListener("click", function () {
      var event;

      if (PhoneSite.theme) PhoneSite.theme.set(product.id);

      if (typeof window.CustomEvent === "function") {
        event = new CustomEvent("phone:select", {
          bubbles: true,
          detail: { id: product.id }
        });
      } else {
        event = document.createEvent("CustomEvent");
        event.initCustomEvent("phone:select", true, false, { id: product.id });
      }

      card.dispatchEvent(event);
    });

    names.appendChild(nameAr);
    names.appendChild(nameEn);
    meta.appendChild(dot);
    meta.appendChild(names);
    body.appendChild(meta);
    body.appendChild(pantone);
    body.appendChild(title);
    body.appendChild(description);
    body.appendChild(link);

    card.appendChild(media);
    card.appendChild(body);

    if (
      product.id !== "silver" &&
      product.id !== "dark-cherry" &&
      product.id !== "light-blue" &&
      product.id !== "dark-gray"
    ) {
      card.classList.add("is-fallback");
    }

    return card;
  }

  /**
   * Render the four products from products.js, then wire image fallback
   * and the mobile strip dots to the nearest card.
   */
  PhoneSite.initCollection = function () {
    var grid = qs("[data-collection-grid]");
    if (!grid) return;

    var products =
      typeof PhoneSite.listProducts === "function"
        ? PhoneSite.listProducts()
        : [];

    if (!products.length) return;

    grid.innerHTML = "";

    var fragment = document.createDocumentFragment();

    products.forEach(function (product) {
      var item = document.createElement("li");
      item.className = "collection__item";
      item.setAttribute("data-collection-item", "");
      item.setAttribute("data-reveal", "");

      var card = createCollectionCard(product);
      var image = qs(".phone-card__img", card);

      PhoneSite.bindImageFallback(card, image);
      if (image && image.complete && image.naturalWidth > 0) {
        card.classList.remove("is-fallback");
      }

      item.appendChild(card);
      fragment.appendChild(item);
    });

    grid.appendChild(fragment);

    var strip = qs("[data-collection-strip]");
    var dotsWrap = qs("[data-collection-dots]");
    if (!strip || !dotsWrap) return;

    dotsWrap.innerHTML = "";

    var items = qsa("[data-collection-item]", strip);

    var dots = items.map(function (item, index) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "collection__dot";
      dot.setAttribute("aria-label", "الانتقال إلى البطاقة " + (index + 1));

      var inner = document.createElement("span");
      inner.className = "collection__dot-inner";
      inner.setAttribute("aria-hidden", "true");
      dot.appendChild(inner);

      dot.addEventListener("click", function () {
        setActive(index);
        scrollToItem(item);
      });

      dotsWrap.appendChild(dot);
      return dot;
    });

    var ticking = false;

    function scrollToItem(item) {
      var behavior = PhoneSite.prefersReducedMotion() ? "auto" : "smooth";
      item.scrollIntoView({ behavior: behavior, inline: "center", block: "nearest" });
    }

    function setActive(index) {
      dots.forEach(function (dot, i) {
        dot.classList.toggle("is-active", i === index);
        if (i === index) dot.setAttribute("aria-current", "true");
        else dot.removeAttribute("aria-current");
      });
    }

    function updateActive() {
      ticking = false;

      var stripRect = strip.getBoundingClientRect();
      if (!stripRect.width) return;

      var center = stripRect.left + stripRect.width / 2;
      var bestIndex = 0;
      var bestDistance = Infinity;

      items.forEach(function (item, index) {
        var rect = item.getBoundingClientRect();
        var itemCenter = rect.left + rect.width / 2;
        var distance = Math.abs(itemCenter - center);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });

      setActive(bestIndex);
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateActive);
    }

    strip.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    updateActive();
  };

  /**
   * Briefly outline a card and bring it into view.
   * @param {string} colorKey One of PhoneSite.colors[].key
   */
  PhoneSite.highlightCard = function (colorKey) {
    var validColors = Array.isArray(PhoneSite.colors) ? PhoneSite.colors : [];
    var isValid = validColors.some(function (color) {
      return color.key === colorKey;
    });
    if (!isValid && typeof PhoneSite.getProduct === "function") {
      isValid = !!PhoneSite.getProduct(colorKey);
    }
    if (!isValid) return;

    var card = qs('.phone-card[data-color="' + colorKey + '"]');
    if (!card) return;

    var item = card.closest("[data-collection-item]") || card;
    var behavior = PhoneSite.prefersReducedMotion() ? "auto" : "smooth";

    item.scrollIntoView({ behavior: behavior, inline: "center", block: "center" });

    card.classList.remove("is-highlighted");
    // Force a style flush so repeated calls restart the highlight.
    void card.offsetWidth;
    card.classList.add("is-highlighted");

    var btn = qs(".phone-card__btn", card);
    if (btn) btn.focus({ preventScroll: true });

    window.setTimeout(function () {
      card.classList.remove("is-highlighted");
    }, 1800);
  };

  /* ----------------------------------------------------------------------
     Color Philosophy + Find Your Style (step 4)
     ---------------------------------------------------------------------- */

  /* Suggested headline per color. Names, Pantone and hex come from
     PhoneSite.colors so there is a single source of truth. */
  PhoneSite.styleHeadlines = {
    "light-blue": "هدوء يلفت الأنظار.",
    "dark-cherry": "جرأة تحمل طابعًا خاصًا.",
    "dark-gray": "قوة في أبسط تفاصيلها.",
    "silver": "أناقة تتجاوز الزمن."
  };

  /**
   * Look up a color record by key.
   * @param {string} key
   * @returns {?Object}
   */
  PhoneSite.getColor = function (key) {
    return (
      PhoneSite.colors.filter(function (color) {
        return color.key === key;
      })[0] || null
    );
  };

  /* ----------------------------------------------------------------------
     Theme engine: neutral by default, one palette per phone colour.
     The CSS side lives in css/base.css ([data-theme] on <html>).
     ---------------------------------------------------------------------- */
  PhoneSite.theme = (function () {
    var STORAGE_KEY = "phonesite:theme";
    var root = document.documentElement;
    var current = null;

    /* Registered custom properties interpolate by themselves. Only browsers
       without them need the solid background transitions used as a fallback. */
    if (window.CSS && typeof window.CSS.registerProperty === "function") {
      root.classList.add("has-registered-props");
    }

    function isValid(key) {
      return PhoneSite.colors.some(function (color) {
        return color.key === key;
      });
    }

    function save(key) {
      try {
        if (key) {
          window.sessionStorage.setItem(STORAGE_KEY, key);
        } else {
          window.sessionStorage.removeItem(STORAGE_KEY);
        }
      } catch (error) {
        /* Storage can be blocked; the theme still works for this page view. */
      }
    }

    function read() {
      try {
        var key = window.sessionStorage.getItem(STORAGE_KEY);
        return key && isValid(key) ? key : null;
      } catch (error) {
        return null;
      }
    }

    /**
     * Keep the visible colour controls in step with the active theme.
     * Never dispatches change events, so it cannot loop back into set().
     */
    function syncControls(key) {
      qsa(".phone-card[data-color]").forEach(function (card) {
        if (key && card.getAttribute("data-color") === key) {
          card.setAttribute("aria-current", "true");
        } else {
          card.removeAttribute("aria-current");
        }
      });

      qsa('input[name="style"]').forEach(function (input) {
        var checked = !!key && input.value === key;
        if (input.checked !== checked) input.checked = checked;
      });

      if (key && typeof PhoneSite.renderStyle === "function") {
        PhoneSite.renderStyle(key);
      }

      var orderInputs = qsa('input[name="order-color"]');
      if (orderInputs.length) {
        if (key && typeof PhoneSite.selectColor === "function") {
          PhoneSite.selectColor(key);
        } else if (!key) {
          orderInputs.forEach(function (input) {
            input.checked = false;
          });
          PhoneSite.order.color = null;
          if (typeof PhoneSite.updateSummary === "function") {
            PhoneSite.updateSummary();
          }
        }
      } else if (key && PhoneSite.order) {
        PhoneSite.order.color = key;
      }
    }

    function emit(key) {
      var event;
      if (typeof window.CustomEvent === "function") {
        event = new CustomEvent("phonesite:themechange", {
          bubbles: true,
          detail: { colorKey: key }
        });
      } else {
        event = document.createEvent("CustomEvent");
        event.initCustomEvent("phonesite:themechange", true, false, {
          colorKey: key
        });
      }
      document.dispatchEvent(event);
    }

    function apply(key) {
      if (key) {
        root.setAttribute("data-theme", key);
      } else {
        root.removeAttribute("data-theme");
      }
      current = key;
      PhoneSite.theme.current = key;
      save(key);
      syncControls(key);
      emit(key);
    }

    function set(key) {
      if (!key || !isValid(key)) return false;
      if (key === current) {
        syncControls(key);
        return true;
      }
      apply(key);
      return true;
    }

    function reset() {
      if (current === null) {
        syncControls(null);
        return true;
      }
      apply(null);
      return true;
    }

    var saved = read();
    if (saved) {
      root.setAttribute("data-theme", saved);
      current = saved;
    }

    return {
      current: current,
      set: set,
      get: function () {
        return current;
      },
      reset: reset,
      sync: function () {
        syncControls(current);
      }
    };
  })();

  PhoneSite.gallery = (function () {
    var state = {
      colorKey: null,
      items: [],
      index: 0
    };

    var els = {};
    var cache = {};
    var requestToken = 0;
    var fadeTimer = null;
    var initialized = false;

    function colorFor(key) {
      var found = null;

      PhoneSite.colors.forEach(function (color) {
        if (color.key === key) found = color;
      });

      return found;
    }

    function entryFor(colorKey, slotKey) {
      return PhoneSite.images[colorKey] && PhoneSite.images[colorKey][slotKey];
    }

    function hasKnownImage(key) {
      var images = PhoneSite.images[key] || {};
      var known = false;

      PhoneSite.gallerySlots.forEach(function (slot) {
        var entry = images[slot.key];

        if (entry && (entry.src || entry.fallback)) known = true;
      });

      return known;
    }

    function initialColorKey() {
      var current = PhoneSite.theme ? PhoneSite.theme.get() : null;

      if (current && PhoneSite.images[current] && hasKnownImage(current)) {
        return current;
      }

      var known = null;

      PhoneSite.colors.forEach(function (color) {
        if (!known && hasKnownImage(color.key)) known = color.key;
      });

      if (known) return known;

      return PhoneSite.colors.length ? PhoneSite.colors[0].key : null;
    }

    function toUrl(path) {
      return String(path)
        .replace(/\\/g, "/")
        .split("/")
        .map(function (part) {
          return encodeURIComponent(part);
        })
        .join("/");
    }

    function candidatesFor(entry) {
      var list = [];
      var path = entry.path;
      var extensions = entry.extensions || PhoneSite.galleryExtensions;

      if (entry.src) {
        var src = toUrl(entry.src);

        if (list.indexOf(src) === -1) list.push(src);
      }

      if (path) {
        extensions.forEach(function (extension) {
          var candidate = toUrl(path + "." + extension);

          if (list.indexOf(candidate) === -1) list.push(candidate);
        });
      }

      if (entry.fallback) {
        var fallback = toUrl(entry.fallback);

        if (list.indexOf(fallback) === -1) list.push(fallback);
      }

      return list;
    }

    function resolveSlot(colorKey, slotKey, callback) {
      var key = colorKey + ":" + slotKey;
      var cached = cache[key];

      if (cached) {
        if (cached.done) callback(cached.url);
        else cached.waiters.push(callback);
        return;
      }

      cached = cache[key] = {
        done: false,
        url: null,
        waiters: [callback]
      };

      var candidates = candidatesFor(entryFor(colorKey, slotKey) || {});
      var index = 0;

      function finish(url) {
        if (cached.done) return;

        cached.done = true;
        cached.url = url;

        var waiters = cached.waiters;
        cached.waiters = [];

        waiters.forEach(function (waiter) {
          waiter(url);
        });
      }

      function next() {
        if (index >= candidates.length) {
          finish(null);
          return;
        }

        var url = candidates[index];
        index += 1;

        var probe = new Image();

        probe.onload = function () {
          if (probe.naturalWidth > 0) finish(url);
          else next();
        };

        probe.onerror = function () {
          next();
        };

        probe.src = url;
      }

      next();
    }

    function setSwitcherState() {
      qsa("[data-gallery-color]", els.switcher).forEach(function (button) {
        var active =
          button.getAttribute("data-gallery-color") === state.colorKey;

        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }

    function buildSwitcher() {
      els.switcher.innerHTML = "";

      PhoneSite.colors.forEach(function (color) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "gallery__color";
        button.setAttribute("data-gallery-color", color.key);
        button.setAttribute("aria-label", "عرض صور " + color.nameAr);
        button.setAttribute("aria-pressed", "false");

        var dot = document.createElement("span");
        dot.className = "gallery__color-dot gallery__color-dot--" + color.key;
        dot.setAttribute("aria-hidden", "true");

        var name = document.createElement("span");
        name.className = "gallery__color-name";
        name.textContent = color.nameAr;

        button.appendChild(dot);
        button.appendChild(name);

        button.addEventListener("click", function () {
          if (PhoneSite.theme) PhoneSite.theme.set(color.key);
          else selectColor(color.key);
        });

        els.switcher.appendChild(button);
      });
    }

    function updateMeta() {
      var item = state.items[state.index];
      var color = colorFor(state.colorKey);

      if (!item || !color) {
        els.caption.textContent = "";
        els.counter.textContent = "";
        return;
      }

      els.caption.textContent = item.label;
      els.counter.textContent = state.index + 1 + " / " + state.items.length;
      els.stage.setAttribute(
        "aria-label",
        "فتح معرض صور " + color.nameAr + " - " + item.label
      );
    }

    function updateThumbs() {
      qsa("[data-gallery-index]", els.thumbs).forEach(function (button, index) {
        button.setAttribute(
          "aria-current",
          index === state.index ? "true" : "false"
        );
      });
    }

    function buildThumbs() {
      els.thumbs.innerHTML = "";

      var color = colorFor(state.colorKey);

      state.items.forEach(function (item, index) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "gallery__thumb";
        button.setAttribute("data-gallery-index", String(index));
        button.setAttribute(
          "aria-label",
          "عرض " + (color ? color.nameAr + " - " : "") + item.label
        );
        button.setAttribute(
          "aria-current",
          index === state.index ? "true" : "false"
        );

        var image = document.createElement("img");
        image.src = item.url;
        image.alt = item.alt;
        image.width = 160;
        image.height = 160;
        image.loading = "lazy";
        image.decoding = "async";
        image.draggable = false;

        button.appendChild(image);

        button.addEventListener("click", function () {
          showItem(index, false);
        });

        els.thumbs.appendChild(button);
      });
    }

    function swapMain(item) {
      els.main.onload = function () {
        els.main.classList.remove("is-fading");
        els.main.onload = null;
      };

      els.main.onerror = function () {
        els.main.onerror = null;
        els.main.classList.remove("is-fading");
        els.main.removeAttribute("src");
        els.main.alt = "";
      };

      els.main.src = item.url;
      els.main.alt = item.alt;

      if (els.main.complete && els.main.naturalWidth > 0) {
        els.main.classList.remove("is-fading");
      }
    }

    function showItem(index, crossfade) {
      if (!state.items.length) return;

      if (index < 0) index = state.items.length - 1;
      if (index >= state.items.length) index = 0;

      state.index = index;

      var item = state.items[index];

      updateThumbs();
      updateMeta();

      window.clearTimeout(fadeTimer);

      if (
        crossfade &&
        els.main.getAttribute("src") &&
        !PhoneSite.prefersReducedMotion()
      ) {
        els.main.classList.add("is-fading");
        fadeTimer = window.setTimeout(function () {
          swapMain(item);
        }, 150);
      } else {
        els.main.classList.remove("is-fading");
        swapMain(item);
      }
    }

    function finishColor(key, results, token) {
      if (token !== requestToken || key !== state.colorKey) return;

      results.sort(function (a, b) {
        return a.order - b.order;
      });

      state.items = results;
      state.index = 0;

      var hadImage = !!els.main.getAttribute("src");
      var hasItems = results.length > 0;

      els.stage.hidden = !hasItems;
      els.placeholder.hidden = hasItems;
      els.meta.hidden = !hasItems;
      els.thumbsWrap.hidden = !hasItems;

      if (!hasItems) {
        window.clearTimeout(fadeTimer);
        els.main.classList.remove("is-fading");
        els.main.removeAttribute("src");
        els.main.alt = "";
        els.caption.textContent = "";
        els.counter.textContent = "";
        els.thumbs.innerHTML = "";
        return;
      }

      buildThumbs();
      showItem(0, hadImage);
    }

    function selectColor(key) {
      if (!key || !PhoneSite.images[key]) return;

      state.colorKey = key;
      setSwitcherState();

      var token = ++requestToken;
      var results = [];
      var remaining = PhoneSite.gallerySlots.length;

      if (!remaining) {
        finishColor(key, results, token);
        return;
      }

      PhoneSite.gallerySlots.forEach(function (slot, order) {
        resolveSlot(key, slot.key, function (url) {
          if (token !== requestToken) return;

          if (url) {
            var entry = entryFor(key, slot.key);

            results.push({
              slot: slot.key,
              label: slot.label,
              alt: entry && entry.alt ? entry.alt : slot.label,
              url: url,
              order: order
            });
          }

          remaining -= 1;

          if (remaining === 0) {
            finishColor(key, results, token);
          }
        });
      });
    }

    function openLightbox() {
      if (!state.items.length) return;
      PhoneSite.lightbox.open(state.items, state.index, els.stage);
    }

    function onThemeChange(event) {
      var key = event.detail && event.detail.colorKey;
      selectColor(key && PhoneSite.images[key] ? key : initialColorKey());
    }

    function init() {
      if (initialized) return;
      initialized = true;

      els.root = qs("[data-gallery]");
      if (!els.root) return;

      els.switcher = qs("[data-gallery-switcher]", els.root);
      els.stage = qs("[data-gallery-open]", els.root);
      els.main = qs("[data-gallery-main]", els.root);
      els.caption = qs("[data-gallery-caption]", els.root);
      els.counter = qs("[data-gallery-counter]", els.root);
      els.placeholder = qs("[data-gallery-placeholder]", els.root);
      els.meta = qs("[data-gallery-meta]", els.root);
      els.thumbsWrap = qs("[data-gallery-thumbs-wrap]", els.root);
      els.thumbs = qs("[data-gallery-thumbs]", els.root);

      buildSwitcher();
      els.stage.addEventListener("click", openLightbox);
      document.addEventListener("phonesite:themechange", onThemeChange);
      selectColor(initialColorKey());
    }

    return {
      init: init,
      selectColor: selectColor,
      getItems: function () {
        return state.items.slice();
      },
      getIndex: function () {
        return state.index;
      }
    };
  })();

  PhoneSite.lightbox = (function () {
    var state = {
      items: [],
      index: 0,
      opener: null,
      isOpen: false
    };

    var els = {};
    var page = [];
    var closeTimer = null;
    var touchStartX = 0;
    var touchStartY = 0;

    function preloadAround() {
      var length = state.items.length;
      if (length < 2) return;

      [state.index + 1, state.index - 1].forEach(function (index) {
        var target = ((index % length) + length) % length;
        var preload = new Image();
        preload.decoding = "async";
        preload.src = state.items[target].url;
      });
    }

    function render() {
      var item = state.items[state.index];
      if (!item) return;

      els.img.src = item.url;
      els.img.alt = item.alt;
      els.caption.textContent = item.label;
      els.counter.textContent = state.index + 1 + " / " + state.items.length;
      els.live.textContent =
        "صورة " +
        (state.index + 1) +
        " من " +
        state.items.length +
        ": " +
        item.label;

      var single = state.items.length < 2;
      els.prev.hidden = single;
      els.next.hidden = single;

      preloadAround();
    }

    function getFocusable() {
      return [els.close, els.prev, els.next].filter(function (element) {
        return element && !element.hidden;
      });
    }

    function setPageInert(value) {
      page.forEach(function (element) {
        if (value) {
          element.setAttribute("inert", "");
          element.setAttribute("aria-hidden", "true");
        } else {
          element.removeAttribute("inert");
          element.removeAttribute("aria-hidden");
        }
      });
    }

    function go(step) {
      if (state.items.length < 2) return;

      state.index =
        (state.index + step + state.items.length) % state.items.length;

      render();
    }

    function open(items, index, opener) {
      if (!items || !items.length) return;

      state.items = items.slice();
      state.index = Math.min(Math.max(index || 0, 0), state.items.length - 1);
      state.opener = opener || document.activeElement;
      state.isOpen = true;

      window.clearTimeout(closeTimer);

      els.root.hidden = false;
      els.root.setAttribute("aria-hidden", "false");
      document.documentElement.classList.add("is-lightbox-open");

      setPageInert(true);
      render();

      void els.root.offsetWidth;
      els.root.classList.add("is-open");

      window.setTimeout(
        function () {
          els.dialog.focus();
        },
        PhoneSite.prefersReducedMotion() ? 0 : 30
      );
    }

    function close() {
      if (!state.isOpen) return;

      state.isOpen = false;

      els.root.classList.remove("is-open");
      document.documentElement.classList.remove("is-lightbox-open");
      setPageInert(false);

      window.clearTimeout(closeTimer);

      closeTimer = window.setTimeout(
        function () {
          if (state.isOpen) return;

          els.root.hidden = true;
          els.root.setAttribute("aria-hidden", "true");

          if (state.opener && typeof state.opener.focus === "function") {
            state.opener.focus();
          }

          state.opener = null;
        },
        PhoneSite.prefersReducedMotion() ? 0 : 230
      );
    }

    function onKeydown(event) {
      if (!state.isOpen) return;

      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(1);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        go(-1);
        return;
      }

      if (event.key !== "Tab") return;

      var focusable = getFocusable();

      if (!focusable.length) {
        event.preventDefault();
        els.dialog.focus();
        return;
      }

      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      var active = document.activeElement;

      if (event.shiftKey && (active === first || active === els.dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function onTouchStart(event) {
      if (!event.touches || event.touches.length !== 1) return;
      touchStartX = event.touches[0].clientX;
      touchStartY = event.touches[0].clientY;
    }

    function onTouchEnd(event) {
      if (!state.isOpen || !event.changedTouches || event.changedTouches.length !== 1) {
        return;
      }

      var deltaX = event.changedTouches[0].clientX - touchStartX;
      var deltaY = event.changedTouches[0].clientY - touchStartY;

      if (
        Math.abs(deltaX) < 50 ||
        Math.abs(deltaX) < Math.abs(deltaY) * 1.2
      ) {
        return;
      }

      go(deltaX < 0 ? 1 : -1);
    }

    function init() {
      els.root = qs("[data-lightbox]");
      if (!els.root) return;

      els.dialog = qs("[data-lightbox-dialog]", els.root);
      els.img = qs("[data-lightbox-img]", els.root);
      els.caption = qs("[data-lightbox-caption]", els.root);
      els.counter = qs("[data-lightbox-counter]", els.root);
      els.close = qs("[data-lightbox-close]", els.root);
      els.prev = qs("[data-lightbox-prev]", els.root);
      els.next = qs("[data-lightbox-next]", els.root);
      els.backdrop = qs("[data-lightbox-backdrop]", els.root);
      els.live = qs("[data-lightbox-live]", els.root);

      page = [
        qs(".skip-link"),
        qs("#site-header"),
        qs("#main"),
        qs("#site-footer"),
        qs(".back-to-top")
      ].filter(Boolean);

      els.root.setAttribute("aria-hidden", "true");

      els.close.addEventListener("click", close);
      els.prev.addEventListener("click", function () {
        go(-1);
      });
      els.next.addEventListener("click", function () {
        go(1);
      });
      els.backdrop.addEventListener("click", close);
      els.dialog.addEventListener("click", function (event) {
        if (event.target === els.dialog) close();
      });
      els.dialog.addEventListener("touchstart", onTouchStart, {
        passive: true
      });
      els.dialog.addEventListener("touchend", onTouchEnd, { passive: true });
      document.addEventListener("keydown", onKeydown);
    }

    return {
      init: init,
      open: open,
      close: close
    };
  })();

  /**
   * Philosophy close-up: image fallback + a gentle one-off scroll motion.
   */
  PhoneSite.initPhilosophyMotion = function () {
    var media = qs("[data-philosophy-media]");
    if (!media) return;

    var img = qs(".philosophy__img", media);
    PhoneSite.bindImageFallback(media, img);

    if (PhoneSite.prefersReducedMotion() || !("IntersectionObserver" in window)) {
      media.classList.add("is-inview");
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            media.classList.add("is-inview");
            observer.unobserve(media);
          }
        });
      },
      { threshold: 0.25 }
    );

    observer.observe(media);
  };

  /**
   * Find Your Style: native radios drive a live, announced result panel.
   */
  PhoneSite.initStyleFinder = function () {
    var inputs = qsa('input[name="style"]');
    var panel = qs("[data-style-result]");
    if (!inputs.length || !panel) return;

    var img = qs("[data-style-img]", panel);
    var source = qs("[data-style-source]", panel);
    var placeholder = qs("[data-style-placeholder]", panel);
    var nameEn = qs("[data-style-name-en]", panel);
    var nameAr = qs("[data-style-name-ar]", panel);
    var pantone = qs("[data-style-pantone]", panel);
    var headline = qs("[data-style-headline]", panel);
    var btn = qs("[data-style-btn]", panel);
    var selectedKey = null;

    function showFallback() {
      panel.classList.add("is-fallback");
    }

    if (img) {
      img.addEventListener("error", showFallback);
      img.addEventListener("load", function () {
        panel.classList.remove("is-fallback");
      });
    }

    function render(key) {
      var color = PhoneSite.getColor(key);
      if (!color) return;

      selectedKey = key;
      panel.setAttribute("data-color", key);
      panel.classList.add("is-selected");

      if (nameEn) nameEn.textContent = color.nameEn;
      if (nameAr) nameAr.textContent = color.nameAr;
      if (pantone) pantone.textContent = color.pantone;
      if (headline) headline.textContent = PhoneSite.styleHeadlines[key] || "";

      if (placeholder) {
        placeholder.className = "phone-placeholder phone-placeholder--" + key;
      }

      if (img) {
        var url = "assets/images/phone-" + key + ".webp";
        img.alt = "هاتف بلون " + color.nameAr + " " + color.nameEn;
        showFallback();
        if (source) source.setAttribute("srcset", url);
        img.setAttribute("src", url);
        if (img.complete && img.naturalWidth === 0) showFallback();
      }

      if (btn) {
        btn.hidden = false;
        btn.setAttribute("data-color", key);
      }
    }

    inputs.forEach(function (input) {
      input.addEventListener("change", function () {
        if (!input.checked) return;
        if (PhoneSite.theme) {
          PhoneSite.theme.set(input.value);
        } else {
          render(input.value);
        }
      });
      // Honour a restored/default selection, if the browser made one.
      if (input.checked) render(input.value);
    });

    if (btn) {
      btn.addEventListener("click", function () {
        if (!selectedKey) return;
        var target = document.getElementById("collection");
        var behavior = PhoneSite.prefersReducedMotion() ? "auto" : "smooth";
        if (target) target.scrollIntoView({ behavior: behavior, block: "start" });
        PhoneSite.highlightCard(selectedKey);
      });
    }

    PhoneSite.renderStyle = render;
  };

  /**
   * Programmatically choose a style (used by tests and future deep links).
   * Unknown keys are ignored safely.
   * @param {string} colorKey One of PhoneSite.colors[].key
   */
  PhoneSite.selectStyle = function (colorKey) {
    if (!PhoneSite.getColor(colorKey)) return;

    var input = qs('input[name="style"][value="' + colorKey + '"]');
    if (!input) return;

    input.checked = true;
    if (typeof PhoneSite.renderStyle === "function") PhoneSite.renderStyle(colorKey);
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };

  /* ----------------------------------------------------------------------
     Order (step 8): shared colour/quantity state + live summary
     ---------------------------------------------------------------------- */

  /** Single source of truth for the order form. */
  PhoneSite.order = PhoneSite.order || { color: null, quantity: 1 };
  if (typeof PhoneSite.order.submitting !== "boolean") {
    PhoneSite.order.submitting = false;
  }

  var ORDER_SUBMIT_TIMEOUT = 15000;
  var ORDER_FIELD_ORDER = [
    "color",
    "fullname",
    "phone",
    "wilaya",
    "commune",
    "delivery",
    "quantity",
    "notes"
  ];
  var ORDER_SERVER_FIELD_MAP = {
    color_key: "color",
    quantity: "quantity",
    full_name: "fullname",
    phone: "phone",
    wilaya: "wilaya",
    commune: "commune",
    address: "delivery",
    notes: "notes"
  };
  var ORDER_GENERIC_ERROR =
    "تعذّر إرسال الطلب. تحقق من اتصالك بالإنترنت وحاول مرة أخرى.";
  var ORDER_ENDPOINT_ERROR =
    "نظام الطلبات غير مُفعّل بعد. يرجى التواصل معنا هاتفيًا لإتمام طلبك.";

  /** Trim and strip control characters without touching the visible fields. */
  function cleanOrderText(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function orderDeliveryEnabled() {
    return !PhoneSite.config.delivery ||
      PhoneSite.config.delivery.enabled !== false;
  }

  /** Normalise +213 / 00213 / local forms to 05/06/07 + 8 digits. */
  function normalizeOrderPhone(value) {
    var phone = cleanOrderText(value).replace(/[^\d+]/g, "");

    if (phone.indexOf("+213") === 0) {
      var plusRest = phone.slice(4);
      if (plusRest.charAt(0) === "0") plusRest = plusRest.slice(1);
      phone = "0" + plusRest;
    } else if (phone.indexOf("00213") === 0) {
      var zeroRest = phone.slice(5);
      if (zeroRest.charAt(0) === "0") zeroRest = zeroRest.slice(1);
      phone = "0" + zeroRest;
    }

    return phone;
  }

  function getOrderPhonePattern() {
    var pattern = PhoneSite.config.phonePattern;
    if (typeof pattern === "string") {
      try {
        pattern = new RegExp(pattern);
      } catch (error) {
        pattern = /^0[567][0-9]{8}$/;
      }
    }
    if (!(pattern instanceof RegExp)) pattern = /^0[567][0-9]{8}$/;
    pattern.lastIndex = 0;
    return pattern;
  }

  function getOrderForm() {
    return qs("[data-order-form]");
  }

  function getOrderErrorElement(field) {
    return qs('[data-error-for="' + field + '"]', getOrderForm());
  }

  function getOrderControl(field) {
    var form = getOrderForm();
    if (!form) return null;

    if (field === "color") return qs(".order-fieldset", form);
    if (field === "delivery") return qs('[name="address"]', form);
    return qs('[name="' + field + '"]', form);
  }

  function setOrderFieldError(field, message) {
    var errorElement = getOrderErrorElement(field);
    if (errorElement) errorElement.textContent = message || "";

    var control = getOrderControl(field);
    if (!control) return;

    if (message) {
      control.setAttribute("aria-invalid", "true");
    } else {
      control.removeAttribute("aria-invalid");
    }
  }

  PhoneSite.clearOrderFieldError = function (field) {
    setOrderFieldError(field, "");
  };

  function clearOrderErrors() {
    var form = getOrderForm();
    if (!form) return;

    qsa("[data-error-for]", form).forEach(function (element) {
      element.textContent = "";
    });
    qsa("[aria-invalid]", form).forEach(function (element) {
      element.removeAttribute("aria-invalid");
    });
  }

  function focusOrderField(field) {
    var form = getOrderForm();
    if (!form) return;

    var control =
      field === "color"
        ? qs('input[name="order-color"]', form)
        : getOrderControl(field);

    if (control && typeof control.focus === "function") control.focus();
  }

  function showOrderBanner(message) {
    var banner = qs("[data-order-banner]", getOrderForm());
    if (!banner) return;
    banner.textContent = message;
    banner.hidden = false;
  }

  function hideOrderBanner() {
    var banner = qs("[data-order-banner]", getOrderForm());
    if (!banner) return;
    banner.textContent = "";
    banner.hidden = true;
  }

  /**
   * idle | loading | retry. Keeps the button label and spinner in sync.
   * @param {string} state
   */
  function setOrderSubmitState(state) {
    var form = getOrderForm();
    if (!form) return;

    var button = qs("[data-order-submit]", form);
    var label = qs("[data-order-submit-label]", form);
    var spinner = qs("[data-order-spinner]", form);
    var loading = state === "loading";

    form.setAttribute("aria-busy", loading ? "true" : "false");

    if (button) {
      button.disabled = loading;
      button.setAttribute("aria-busy", loading ? "true" : "false");
    }

    if (label) {
      label.textContent = loading
        ? "جارٍ إرسال الطلب..."
        : state === "retry"
          ? "إعادة المحاولة"
          : "إرسال الطلب";
    }

    if (spinner) spinner.hidden = !loading;
  }

  function orderConfirmationVisible() {
    var confirmation = qs("[data-order-confirmation]");
    return !!confirmation && !confirmation.hidden;
  }

  function showOrderConfirmation(orderId) {
    var form = getOrderForm();
    var confirmation = qs("[data-order-confirmation]");
    if (!form || !confirmation) return;

    var reference = qs("[data-order-reference]", confirmation);
    if (reference) reference.textContent = orderId;

    form.hidden = true;
    confirmation.hidden = false;
    setOrderSubmitState("idle");

    var heading = qs("[data-order-confirmation-title]", confirmation);
    if (heading && typeof heading.focus === "function") heading.focus();
  }

  /**
   * Reset the form and in-memory state. Used by the confirmation screen's
   * button and by order CTAs after a successful order.
   * @param {{focus?: boolean}=} options
   */
  PhoneSite.resetOrderForm = function (options) {
    var form = getOrderForm();
    var confirmation = qs("[data-order-confirmation]");
    if (!form) return;

    form.reset();
    PhoneSite.order.color = null;
    PhoneSite.order.quantity = 1;
    PhoneSite.order.submitting = false;

    qsa('input[name="order-color"]', form).forEach(function (input) {
      input.checked = false;
    });

    var quantityInput = qs('[name="quantity"]', form);
    if (quantityInput) quantityInput.value = "1";

    clearOrderErrors();
    hideOrderBanner();
    setOrderSubmitState("idle");
    if (confirmation) confirmation.hidden = true;
    form.hidden = false;
    PhoneSite.updateSummary();

    if (options && options.focus) focusOrderField("color");
  };

  /** Collect visible values without mutating the customer's input. */
  function collectOrderValues() {
    var form = getOrderForm();
    if (!form) return null;

    var checkedColor = qs('input[name="order-color"]:checked', form);
    var quantityInput = qs('[name="quantity"]', form);

    return {
      colorKey: checkedColor ? checkedColor.value : PhoneSite.order.color || "",
      quantityRaw: quantityInput ? quantityInput.value : "",
      fullName: cleanOrderText(qs('[name="fullname"]', form).value),
      phoneRaw: cleanOrderText(qs('[name="phone"]', form).value),
      phone: normalizeOrderPhone(qs('[name="phone"]', form).value),
      wilaya: cleanOrderText(qs('[name="wilaya"]', form).value),
      commune: cleanOrderText(qs('[name="commune"]', form).value),
      address: cleanOrderText(qs('[name="address"]', form).value),
      notes: cleanOrderText(qs('[name="notes"]', form).value)
    };
  }

  /**
   * Validate every field and return both cleaned values and field errors.
   * @param {Object} values
   * @return {{values: Object, errors: Object<string, string>}}
   */
  function validateOrderValues(values) {
    var errors = {};
    var phonePattern = getOrderPhonePattern();
    var quantity = Number(values.quantityRaw);

    if (!values.colorKey) {
      errors.color = "يرجى اختيار لون الهاتف.";
    } else if (!PhoneSite.getColor(values.colorKey)) {
      errors.color = "اللون المحدد غير صالح.";
    }

    if (!values.fullName) {
      errors.fullname = "الاسم الكامل مطلوب.";
    } else if (values.fullName.length < 3 || values.fullName.length > 80) {
      errors.fullname = "الاسم الكامل يجب أن يكون بين 3 و80 حرفًا.";
    }

    if (!values.phoneRaw) {
      errors.phone = "رقم الهاتف مطلوب.";
    } else if (!phonePattern.test(values.phone)) {
      errors.phone =
        "أدخل رقم هاتف جزائري صحيحًا: 05/06/07 مع 8 أرقام، أو +213/00213.";
    }

    if (!values.wilaya) {
      errors.wilaya = "الولاية مطلوبة.";
    } else if (values.wilaya.length < 2 || values.wilaya.length > 60) {
      errors.wilaya = "الولاية يجب أن تكون بين حرفين و60 حرفًا.";
    }

    if (!values.commune) {
      errors.commune = "البلدية مطلوبة.";
    } else if (values.commune.length < 2 || values.commune.length > 60) {
      errors.commune = "البلدية يجب أن تكون بين حرفين و60 حرفًا.";
    }

    if (orderDeliveryEnabled() && !values.address) {
      errors.delivery = "عنوان التوصيل مطلوب.";
    } else if (values.address.length > 300) {
      errors.delivery = "عنوان التوصيل يجب ألا يتجاوز 300 حرف.";
    }

    if (!values.quantityRaw) {
      errors.quantity = "الكمية مطلوبة.";
    } else if (
      !isFinite(quantity) ||
      Math.floor(quantity) !== quantity ||
      quantity < 1 ||
      quantity > 10
    ) {
      errors.quantity = "الكمية يجب أن تكون عددًا صحيحًا بين 1 و10.";
    }

    if (values.notes.length > 500) {
      errors.notes = "الملاحظات يجب ألا تتجاوز 500 حرف.";
    }

    values.quantity = quantity;
    return { values: values, errors: errors };
  }

  function showOrderErrors(errors) {
    ORDER_FIELD_ORDER.forEach(function (field) {
      if (errors[field]) setOrderFieldError(field, errors[field]);
    });

    for (var index = 0; index < ORDER_FIELD_ORDER.length; index += 1) {
      if (errors[ORDER_FIELD_ORDER[index]]) {
        focusOrderField(ORDER_FIELD_ORDER[index]);
        break;
      }
    }
  }

  function hasOrderErrors(errors) {
    for (var field in errors) {
      if (Object.prototype.hasOwnProperty.call(errors, field)) return true;
    }
    return false;
  }

  function buildOrderPayload(values) {
    var pricing = PhoneSite.config.pricing || {};
    var unitPrice = PhoneSite.hasPrice(pricing.unitPrice)
      ? Number(pricing.unitPrice)
      : null;
    var deliveryCost = PhoneSite.hasPrice(pricing.deliveryCost)
      ? Number(pricing.deliveryCost)
      : null;
    var total =
      unitPrice === null || deliveryCost === null
        ? null
        : unitPrice * values.quantity + deliveryCost;
    var honeypot = qs('[name="website"]', getOrderForm());

    return {
      color_key: values.colorKey,
      quantity: values.quantity,
      full_name: values.fullName,
      phone: values.phone,
      wilaya: values.wilaya,
      commune: values.commune,
      address: values.address,
      notes: values.notes,
      unit_price: unitPrice,
      delivery_cost: deliveryCost,
      total: total,
      delivery: orderDeliveryEnabled(),
      website: honeypot ? honeypot.value : ""
    };
  }

  function showOrderFailure(message, data) {
    PhoneSite.order.submitting = false;
    setOrderSubmitState("retry");

    var text = message || ORDER_GENERIC_ERROR;
    showOrderBanner(text);

    var field = data && data.error ? ORDER_SERVER_FIELD_MAP[data.error] : null;
    if (field) {
      setOrderFieldError(field, text);
      focusOrderField(field);
    }
  }

  function submitOrder(values) {
    var endpoint = String(PhoneSite.config.orderEndpoint || "").trim();

    if (!endpoint) {
      showOrderBanner(ORDER_ENDPOINT_ERROR);
      setOrderSubmitState("idle");
      return;
    }

    hideOrderBanner();
    setOrderSubmitState("loading");
    PhoneSite.order.submitting = true;

    var controller =
      typeof window.AbortController === "function"
        ? new window.AbortController()
        : null;
    var timeoutId = null;
    var finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    }

    function fail(message, data) {
      finish();
      showOrderFailure(message, data);
    }

    if (controller) {
      timeoutId = window.setTimeout(function () {
        if (typeof controller.abort === "function") controller.abort();
      }, ORDER_SUBMIT_TIMEOUT);
    }

    var request;
    try {
      request = window.fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(buildOrderPayload(values)),
        signal: controller ? controller.signal : undefined
      });
    } catch (error) {
      fail(ORDER_GENERIC_ERROR, null);
      return;
    }

    request
      .then(function (response) {
        return response.text().then(function (text) {
          var data = null;
          try {
            data = JSON.parse(text);
          } catch (error) {
            data = null;
          }
          return { response: response, data: data };
        });
      })
      .then(function (result) {
        finish();

        if (
          result.response &&
          result.response.ok &&
          result.data &&
          result.data.ok === true &&
          typeof result.data.orderId === "string" &&
          result.data.orderId.trim() !== "" &&
          result.data.orderId.trim().indexOf("PH-") === 0
        ) {
          PhoneSite.order.submitting = false;
          showOrderConfirmation(String(result.data.orderId.trim()));
          return;
        }

        var message =
          result.data &&
          typeof result.data.message === "string" &&
          result.data.message
            ? result.data.message
            : "";
        fail(message, result.data);
      })
      .catch(function (error) {
        var message =
          error && error.name === "AbortError"
            ? "انتهت مهلة إرسال الطلب. تحقق من اتصالك وحاول مرة أخرى."
            : ORDER_GENERIC_ERROR;
        fail(message, null);
      });
  }

  PhoneSite.hasPrice = function (value) {
    if (value === null || value === undefined || value === "") return false;
    return isFinite(Number(value));
  };

  PhoneSite.formatPrice = function (value) {
    var number = Number(value);
    if (!isFinite(number)) return "";

    var formatted;
    try {
      formatted = new Intl.NumberFormat("ar-DZ", {
        maximumFractionDigits: 2
      }).format(number);
    } catch (error) {
      formatted = String(number);
    }

    var currency =
      (PhoneSite.config.pricing && PhoneSite.config.pricing.currency) || "";
    return currency ? formatted + " " + currency : formatted;
  };

  /** Scroll every order CTA to the form with the project's motion rules. */
  PhoneSite.scrollToOrder = function () {
    var target = document.getElementById("order");
    if (!target) return;

    target.scrollIntoView({
      behavior: PhoneSite.prefersReducedMotion() ? "auto" : "smooth",
      block: "start"
    });
  };

  /**
   * Select a colour, sync the radio group and refresh the summary.
   * Unknown keys are ignored safely.
   * @param {string} key One of PhoneSite.colors[].key
   */
  PhoneSite.selectColor = function (key) {
    if (!PhoneSite.getColor(key)) return;

    PhoneSite.order.color = key;
    if (typeof PhoneSite.clearOrderFieldError === "function") {
      PhoneSite.clearOrderFieldError("color");
    }

    qsa('input[name="order-color"]').forEach(function (input) {
      input.checked = input.value === key;
    });

    PhoneSite.updateSummary();
  };

  /** Clamp the quantity to 1..10, sync the input and refresh the summary. */
  PhoneSite.setQuantity = function (value) {
    var quantity = parseInt(value, 10);
    if (isNaN(quantity)) quantity = PhoneSite.order.quantity || 1;
    quantity = Math.min(10, Math.max(1, quantity));

    PhoneSite.order.quantity = quantity;
    if (typeof PhoneSite.clearOrderFieldError === "function") {
      PhoneSite.clearOrderFieldError("quantity");
    }

    var input = document.getElementById("order-quantity");
    if (input && input.value !== String(quantity)) {
      input.value = String(quantity);
    }

    PhoneSite.updateSummary();
  };

  /** Show a price row only when a real value is configured. */
  PhoneSite.setSummaryPriceRow = function (panel, name, value) {
    var row = qs("[data-summary-" + name + "]", panel);
    if (!row) return;

    if (value === null) {
      row.hidden = true;
      return;
    }

    var valueEl = qs("[data-summary-" + name + "-value]", panel);
    if (valueEl) valueEl.textContent = PhoneSite.formatPrice(value);
    row.hidden = false;
  };

  /**
   * Live order summary: colour and quantity always, price lines only when
   * PhoneSite.config.pricing holds real values.
   */
  PhoneSite.updateSummary = function () {
    var panel = qs("[data-order-summary]");
    if (!panel) return;

    var state = PhoneSite.order;
    var color = state.color ? PhoneSite.getColor(state.color) : null;

    var nameEl = qs("[data-summary-color-name]", panel);
    if (nameEl) {
      nameEl.textContent = color ? color.nameAr : "لم يتم اختيار لون بعد";
    }

    var swatchEl = qs("[data-summary-swatch]", panel);
    if (swatchEl) {
      if (color) {
        swatchEl.hidden = false;
        swatchEl.style.backgroundColor = color.hex;
      } else {
        swatchEl.hidden = true;
        swatchEl.style.removeProperty("background-color");
      }
    }

    var quantityEl = qs("[data-summary-quantity]", panel);
    if (quantityEl) quantityEl.textContent = String(state.quantity);

    var pricing = PhoneSite.config.pricing || {};
    var unitPrice = PhoneSite.hasPrice(pricing.unitPrice)
      ? Number(pricing.unitPrice)
      : null;
    var deliveryCost = PhoneSite.hasPrice(pricing.deliveryCost)
      ? Number(pricing.deliveryCost)
      : null;
    var subtotal = unitPrice === null ? null : unitPrice * state.quantity;
    var total =
      unitPrice === null || deliveryCost === null
        ? null
        : subtotal + deliveryCost;

    PhoneSite.setSummaryPriceRow(panel, "unit", unitPrice);
    PhoneSite.setSummaryPriceRow(panel, "subtotal", subtotal);
    PhoneSite.setSummaryPriceRow(panel, "delivery", deliveryCost);
    PhoneSite.setSummaryPriceRow(panel, "total", total);
  };

  /**
   * Build the real radio inputs from PhoneSite.colors (single source of
   * colour names and HEX values), styled as swatch cards.
   */
  PhoneSite.buildOrderColors = function () {
    var wrap = qs("[data-order-colors]");
    if (!wrap) return;

    wrap.innerHTML = "";

    PhoneSite.colors.forEach(function (color) {
      var label = document.createElement("label");
      label.className = "order-color";
      label.setAttribute("data-color", color.key);

      var input = document.createElement("input");
      input.type = "radio";
      input.name = "order-color";
      input.value = color.key;
      input.required = true;
      input.className = "order-color__input visually-hidden";
      input.setAttribute("aria-label", color.nameAr + " " + color.nameEn);

      var inner = document.createElement("span");
      inner.className = "order-color__inner";

      var swatch = document.createElement("span");
      swatch.className = "order-color__swatch";
      swatch.setAttribute("aria-hidden", "true");
      swatch.style.backgroundColor = color.hex;

      var name = document.createElement("span");
      name.className = "order-color__name";
      name.textContent = color.nameAr;

      var nameEn = document.createElement("span");
      nameEn.className = "order-color__en en";
      nameEn.setAttribute("lang", "en");
      nameEn.textContent = color.nameEn;

      var check = document.createElement("span");
      check.className = "order-color__check";
      check.setAttribute("aria-hidden", "true");

      inner.appendChild(swatch);
      inner.appendChild(name);
      inner.appendChild(nameEn);
      inner.appendChild(check);

      label.appendChild(input);
      label.appendChild(inner);

      input.addEventListener("change", function () {
        if (!input.checked) return;
        if (PhoneSite.theme) {
          PhoneSite.theme.set(color.key);
        } else {
          PhoneSite.selectColor(color.key);
        }
      });

      wrap.appendChild(label);
    });
  };

  /**
   * Wire the order form UI: colour options, generic CTAs, per-card buttons,
   * quantity stepper, delivery config, live summary, validation and sending.
   */
  PhoneSite.initOrder = function () {
    var section = document.getElementById("order");
    var form = qs("[data-order-form]");
    if (!section || !form) return;

    PhoneSite.buildOrderColors();

    // Every generic «اطلب هاتفك الآن» keeps the current colour selection.
    // After a successful order it starts a fresh form instead of leaving the
    // confirmation screen as the destination.
    qsa("[data-order-cta]").forEach(function (link) {
      link.addEventListener("click", function (event) {
        event.preventDefault();
        if (orderConfirmationVisible()) PhoneSite.resetOrderForm();
        PhoneSite.scrollToOrder();
      });
    });

    // Card buttons preselect their colour, then jump to the form.
    qsa("[data-order-color]").forEach(function (button) {
      button.addEventListener("click", function () {
        var colorKey = button.getAttribute("data-order-color");
        if (orderConfirmationVisible()) PhoneSite.resetOrderForm();
        if (PhoneSite.theme) {
          PhoneSite.theme.set(colorKey);
        } else {
          PhoneSite.selectColor(colorKey);
        }
        PhoneSite.scrollToOrder();
      });
    });

    var decrease = qs("[data-qty-decrease]", form);
    var increase = qs("[data-qty-increase]", form);
    var quantityInput = document.getElementById("order-quantity");

    if (decrease) {
      decrease.addEventListener("click", function () {
        PhoneSite.setQuantity(PhoneSite.order.quantity - 1);
      });
    }

    if (increase) {
      increase.addEventListener("click", function () {
        PhoneSite.setQuantity(PhoneSite.order.quantity + 1);
      });
    }

    if (quantityInput) {
      // Live summary while typing; clamping happens on commit/blur.
      quantityInput.addEventListener("input", function () {
        var value = parseInt(quantityInput.value, 10);
        if (!isNaN(value)) {
          PhoneSite.order.quantity = Math.min(10, Math.max(1, value));
          PhoneSite.updateSummary();
        }
      });

      quantityInput.addEventListener("change", function () {
        PhoneSite.setQuantity(quantityInput.value);
      });

      quantityInput.addEventListener("blur", function () {
        PhoneSite.setQuantity(quantityInput.value);
      });
    }

    // Clear a field's error as soon as the customer edits it.
    form.addEventListener("input", function (event) {
      var target = event.target;
      var field =
        target.name === "order-color"
          ? "color"
          : target.name === "address"
            ? "delivery"
            : target.name;

      if (ORDER_FIELD_ORDER.indexOf(field) !== -1) {
        setOrderFieldError(field, "");
      }
    });

    // Optional delivery field: required by default, optional when configured.
    var deliveryField = document.getElementById("order-delivery");
    var deliveryOptional = qs("[data-delivery-optional]", form);
    var deliveryEnabled = orderDeliveryEnabled();

    if (deliveryField) deliveryField.required = deliveryEnabled;
    if (deliveryOptional) deliveryOptional.hidden = deliveryEnabled;

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      // Ignore clicks and Enter presses while a request is already in flight.
      if (PhoneSite.order.submitting) return;

      hideOrderBanner();
      clearOrderErrors();

      var collected = collectOrderValues();
      if (!collected) return;

      var validation = validateOrderValues(collected);
      if (hasOrderErrors(validation.errors)) {
        showOrderErrors(validation.errors);
        return;
      }

      PhoneSite.order.color = validation.values.colorKey;
      PhoneSite.order.quantity = validation.values.quantity;
      submitOrder(validation.values);
    });

    var resetButton = qs("[data-order-reset]", section);
    if (resetButton) {
      resetButton.addEventListener("click", function () {
        PhoneSite.resetOrderForm({ focus: true });
        PhoneSite.scrollToOrder();
      });
    }

    setOrderSubmitState("idle");

    if (quantityInput) quantityInput.value = String(PhoneSite.order.quantity);
    if (PhoneSite.order.color) {
      PhoneSite.selectColor(PhoneSite.order.color);
    } else {
      PhoneSite.updateSummary();
    }
  };

  /* ----------------------------------------------------------------------
     Specs (step 5)
     ---------------------------------------------------------------------- */

  /**
   * Optional spec values, keyed by the six `.spec-item[data-spec]` keys.
   *
   * CONTENT RULE: the exact phone model is NOT confirmed yet, so every value
   * is an empty string and no technical numbers live in the markup. Once the
   * real model is confirmed, type a value here (for example
   * PhoneSite.specs.display = "6.1 inch") and it will automatically appear
   * inside the matching card.
   * @type {Object<string, string>}
   */
  PhoneSite.specs = {
    display: "",
    cameras: "",
    performance: "",
    battery: "",
    storage: "",
    build: ""
  };

  /**
   * Show or hide each card's optional value slot from PhoneSite.specs.
   * Empty values leave `.spec-item__value` hidden, so no space is left behind.
   */
  PhoneSite.renderSpecValues = function () {
    qsa(".spec-item[data-spec]").forEach(function (item) {
      var valueEl = qs(".spec-item__value", item);
      if (!valueEl) return;

      var key = item.getAttribute("data-spec");
      var value = PhoneSite.specs ? PhoneSite.specs[key] : "";

      if (typeof value === "string" && value.trim() !== "") {
        valueEl.textContent = value;
        valueEl.hidden = false;
      } else {
        valueEl.textContent = "";
        valueEl.hidden = true;
      }
    });
  };

  /**
   * Render the optional spec values. The center image is a static <img>.
   */
  PhoneSite.initSpecs = function () {
    PhoneSite.renderSpecValues();
  };

  /* ----------------------------------------------------------------------
     FAQ, Final CTA, Footer, Back to top (step 7)
     ---------------------------------------------------------------------- */

  /**
   * Optional footer destinations. Every value is EMPTY by default so no link
   * ever points to a page that does not exist: add a URL only when the real
   * page (or account) is live.
   *
   * social: [{ label: "Instagram", url: "https://…", icon: "instagram" }]
   * Icons: link | instagram | x | youtube | facebook | tiktok.
   */
  PhoneSite.config.footerLinks = PhoneSite.config.footerLinks || {};

  (function () {
    var links = PhoneSite.config.footerLinks;
    ["warranty", "returns", "privacy", "terms"].forEach(function (key) {
      if (typeof links[key] !== "string") links[key] = "";
    });
    if (!Array.isArray(links.social)) links.social = [];
  })();

  /* Simple inline line icons for the social row (static strings, no user input). */
  var socialIconPaths = {
    link:
      '<path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5l-1 1"></path>' +
      '<path d="M13.5 10.5a3.5 3.5 0 0 0-5 0L6 13a3.5 3.5 0 0 0 5 5l1-1"></path>',
    instagram:
      '<rect x="4" y="4" width="16" height="16" rx="4.5"></rect>' +
      '<circle cx="12" cy="12" r="3.6"></circle>' +
      '<circle cx="17" cy="7" r="0.9" fill="currentColor" stroke="none"></circle>',
    x: '<path d="M5 4l14 16"></path><path d="M19 4 5 20"></path>',
    youtube:
      '<rect x="3" y="6" width="18" height="12" rx="3.5"></rect>' +
      '<path d="m10.5 9.5 4.5 2.5-4.5 2.5z"></path>',
    facebook:
      '<path d="M14.5 8.5h2.5V5h-2.5A3.5 3.5 0 0 0 11 8.5V11H8.5v3.5H11V21h3.5v-6.5h2.6l.4-3.5h-3v-2a1 1 0 0 1 1-1z"></path>',
    tiktok:
      '<path d="M14 4v9.5a3.5 3.5 0 1 1-3-3.46"></path>' +
      '<path d="M14 4c.5 2.5 2 4 4.5 4.2"></path>'
  };

  /**
   * Build one social icon link (opens in a new tab, labelled by platform).
   * @param {{label: string, url: string, icon: string}} entry
   * @returns {HTMLAnchorElement}
   */
  function createSocialLink(entry) {
    var anchor = document.createElement("a");
    anchor.className = "site-footer__social-link";
    anchor.href = entry.url.trim();
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.setAttribute("aria-label", entry.label || "رابط خارجي");

    var icon = socialIconPaths[entry.icon] ? entry.icon : "link";
    anchor.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      socialIconPaths[icon] +
      "</svg>";

    return anchor;
  }

  /**
   * Accessible accordion: one open item at a time, aria-expanded in sync,
   * ArrowUp/ArrowDown + Home/End move focus between the triggers.
   */
  PhoneSite.initFaq = function () {
    var items = qsa(".faq-item");
    if (!items.length) return;

    var triggers = items
      .map(function (item) {
        return qs(".faq-item__trigger", item);
      })
      .filter(Boolean);

    function setOpen(item, open) {
      var trigger = qs(".faq-item__trigger", item);
      item.classList.toggle("is-open", open);
      if (trigger) {
        trigger.setAttribute("aria-expanded", open ? "true" : "false");
      }
    }

    function toggle(item) {
      var willOpen = !item.classList.contains("is-open");
      items.forEach(function (other) {
        setOpen(other, other === item ? willOpen : false);
      });
    }

    items.forEach(function (item) {
      var trigger = qs(".faq-item__trigger", item);
      if (!trigger) return;

      trigger.addEventListener("click", function () {
        toggle(item);
      });

      trigger.addEventListener("keydown", function (event) {
        var index = triggers.indexOf(trigger);
        var target = null;

        if (event.key === "ArrowDown") {
          target = triggers[(index + 1) % triggers.length];
        } else if (event.key === "ArrowUp") {
          target = triggers[(index - 1 + triggers.length) % triggers.length];
        } else if (event.key === "Home") {
          target = triggers[0];
        } else if (event.key === "End") {
          target = triggers[triggers.length - 1];
        }

        if (target) {
          event.preventDefault();
          target.focus();
        }
      });
    });
  };

  /**
   * Footer: reveal and point optional links only when a real URL is set,
   * hide columns that end up empty, and build the social row on demand.
   */
  PhoneSite.initFooter = function () {
    var footer = document.getElementById("site-footer");
    if (!footer) return;

    var links = PhoneSite.config.footerLinks || {};

    ["warranty", "returns", "privacy", "terms"].forEach(function (key) {
      var anchor = qs('[data-footer-link="' + key + '"]', footer);
      if (!anchor) return;

      var item = anchor.closest("li");
      var url = typeof links[key] === "string" ? links[key].trim() : "";

      if (url) {
        anchor.setAttribute("href", url);
        if (item) item.hidden = false;
      } else {
        anchor.removeAttribute("href");
        if (item) item.hidden = true;
      }
    });

    // A column with nothing to show loses its heading too.
    qsa(".site-footer__col", footer).forEach(function (col) {
      var list = qs(".site-footer__list", col);
      if (!list) return;
      col.hidden = !list.querySelector("li:not([hidden])");
    });

    var socialWrap = qs("[data-footer-social]", footer);
    if (socialWrap && Array.isArray(links.social) && links.social.length) {
      links.social.forEach(function (entry) {
        if (!entry || typeof entry.url !== "string" || !entry.url.trim()) return;
        socialWrap.appendChild(createSocialLink(entry));
      });
      socialWrap.hidden = socialWrap.childElementCount === 0;
    }
  };

  /**
   * Back to top: appears after ~800px, hides as the footer enters the
   * viewport so it never covers footer links. rAF-throttled, passive.
   */
  PhoneSite.initBackToTop = function () {
    var button = qs(".back-to-top");
    if (!button) return;

    var footer = document.getElementById("site-footer");
    var ticking = false;

    function update() {
      ticking = false;

      var pastThreshold = window.scrollY > 800;
      var footerTop = footer ? footer.getBoundingClientRect().top : Infinity;
      var nearFooter = footerTop < window.innerHeight - 24;

      button.classList.toggle("is-visible", pastThreshold && !nearFooter);
    }

    function requestUpdate() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate, { passive: true });

    button.addEventListener("click", function () {
      window.scrollTo({
        top: 0,
        behavior: PhoneSite.prefersReducedMotion() ? "auto" : "smooth"
      });
    });

    update();
  };

  /* ----------------------------------------------------------------------
     Init
     ---------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", function () {
    PhoneSite.applyConfig();
    PhoneSite.initHeader();
    PhoneSite.initMobileMenu();
    PhoneSite.initActiveNav();
    PhoneSite.initHero();
    PhoneSite.initCollection();
    PhoneSite.gallery.init();
    PhoneSite.lightbox.init();
    PhoneSite.createRevealObserver();
    PhoneSite.initPhilosophyMotion();
    PhoneSite.initStyleFinder();
    PhoneSite.initSpecs();
    PhoneSite.initOrder();
    PhoneSite.initFaq();
    PhoneSite.initFooter();
    PhoneSite.initBackToTop();
    PhoneSite.theme.sync();
  });

  window.PhoneSite = PhoneSite;
})();
