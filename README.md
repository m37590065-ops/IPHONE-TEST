# مجموعة الهواتف — موقع تعريفي

موقع تعريفي (Landing Page) عربي بواجهة RTL لعرض مجموعة من أربعة هواتف بألوان مختارة، مع تجربة بصرية هادئة وتفاعلية تساعد الزائر على استكشاف الألوان ومقارنتها واختيار ما يناسبه.

مبني بصفحة واحدة (`index.html`) باستخدام HTML وCSS وJavaScript خالصة، دون أي أدوات بناء أو مكتبات خارجية.

---

## المميزات

- **تصميم عربي RTL** بخط IBM Plex Sans Arabic مع تسلسل طباعي سائل (Fluid Typography).
- **أربعة ألوان هواتف**: أزرق فاتح، كرز داكن، رمادي داكن، فضي — مع أكواد Pantone وHEX.
- **أقسام الصفحة**:
  - Hero مع حركة Parallax لطيفة.
  - مجموعة الهواتف (شريط أفقي قابل للتمرير مع نقاط تنقّل).
  - معرض صور تفاعلي لكل لون مع عارض بالحجم الكامل.
  - فلسفة الألوان.
  - محدّد الأسلوب (Find Your Style) بنتيجة مباشرة ومعلنة لقارئات الشاشة.
  - المواصفات التقنية.
  - لماذا تختارنا (قابل للإخفاء).
  - الأسئلة الشائعة (Accordion).
  - نموذج طلب كامل مع ملخص مباشر.
  - دعوة أخيرة للتواصل.
  - تذييل مع روابط اختيارية.
- **نموذج طلب متكامل**: تحقق عربي لكل الحقول، إرسال إلى Google Sheets عبر Apps Script، حالات تحميل ونجاح وفشل، ومنع تكرار الطلب بالرقم نفسه خلال دقيقة. لا تظهر رسالة نجاح إلا بعد تأكيد الخادم.
- **تفاعلات JS**: قائمة جوال، تظليل الرابط النشط أثناء التمرير، ظهور العناصر عند التمرير، زر العودة للأعلى، واحترام `prefers-reduced-motion`.
- **بدائل صور تلقائية**: عند غياب صورة أو فشل تحميلها يظهر بديل مبني بـ CSS بدل الصورة المكسورة.
- **إتاحة (Accessibility)**: رابط تجاوز، تسميات ARIA، إدارة تركيز القائمة، حالات `aria-expanded` و`aria-live`، وأهداف لمس مناسبة.
- **متجاوب بالكامل** من شاشات الجوال إلى سطح المكتب.

---

## التقنيات

| التقنية | الاستخدام |
| --- | --- |
| HTML5 | بنية الصفحة الدلالية |
| CSS3 | التصميم، المتغيرات (Design Tokens)، الشبكات، الاستجابة |
| JavaScript (ES5-style IIFE) | التفاعلات والأداء |
| Google Apps Script | استقبال الطلبات وحفظها في Google Sheets |
| Google Fonts | IBM Plex Sans Arabic + Inter |

---

## بنية المشروع

```text
iphone test/
├── index.html            # الصفحة الوحيدة (كل الأقسام)
├── css/
│   ├── base.css          # إعادة الضبط، المتغيرات، الخطوط، الأزرار
│   ├── layout.css        # الحاويات، تباعد الأقسام، الشبكات
│   └── components.css    # مكوّنات الواجهة
├── js/
│   └── main.js           # كل سلوكيات الموقع عبر كائن PhoneSite
├── assets/
│   ├── icons/            # أيقونات إضافية (فارغ حاليًا)
│   └── images/           # صور الهواتف (فارغ حاليًا — يعمل البديل CSS)
├── apps-script/
│   ├── Code.gs           # خادم الطلبات: تحقق، منع تكرار، حفظ في Google Sheets
│   └── SETUP.md          # خطوات النشر وربط orderEndpoint
├── server.py             # خادم محلي يمنع أخطاء 404 عند فتح مسار خاطئ
├── start-site.bat        # تشغيل الخادم وفتح الموقع بنقرة مزدوجة (Windows)
└── README.md
```

---

## التشغيل محليًا

لا يحتاج المشروع إلى تثبيت أو بناء. شغّل الخادم المرفق من مجلد المشروع:

```powershell
# Windows: انقر نقرًا مزدوجًا على start-site.bat
# أو من الطرفية:
python server.py
```

يفتح الخادم المتصفح تلقائيًا على `http://127.0.0.1:8000/`، ويعيد توجيه أي مسار صفحة خاطئ (مثل `/index` أو `/iphone test/`) إلى `index.html` بدلًا من صفحة الخطأ.

> **إذا ظهرت صفحة `Error response / 404 - File not found`:** فهذا خطأ في مسار الخادم وليس في الصفحة. تأكد أنك تشغّل `server.py` من مجلد المشروع وافتح الجذر `http://127.0.0.1:8000/` وليس مسارًا فرعيًا. تجنّب `python -m http.server` من مجلد أعلى، لأنه لا يعيد توجيه المسارات الخاطئة.
>
> ملفات الصور غير موجودة بعد، لذلك يعرض الموقع البديل CSS تلقائيًا، وقد تظهر طلبات الصور المفقودة في أدوات المطوّر فقط.

---

## الألوان

| المفتاح | الاسم | HEX | Pantone |
| --- | --- | --- | --- |
| `light-blue` | الأزرق الفاتح | `#A3C9E2` | 2121 |
| `dark-cherry` | الكرز الداكن | `#581825` | 6076 |
| `dark-gray` | الرمادي الداكن | `#2D3136` | 426C |
| `silver` | الفضي | `#E2E8F0` | 427C |

المصدر الوحيد لبيانات الألوان هو `PhoneSite.colors` داخل `js/main.js`، وتُستخدم تلقائيًا في بطاقات المجموعة ومحدّد الأسلوب والثيمات ونموذج الطلب.

### نظام الثيمات

لكل لون ثيم فاتح خاص به يُطبَّق عبر `PhoneSite.theme.set("light-blue" | "dark-cherry" | "dark-gray" | "silver")` ويُحفظ في `sessionStorage`. استخدم `PhoneSite.theme.get()` لمعرفة الثيم الحالي و`PhoneSite.theme.reset()` للعودة إلى الوضع المحايد، ويُطلق كل تغيير الحدث `phonesite:themechange` على `document`.

---

## التخصيص والإعدادات

كل الإعدادات تمر عبر الكائن `window.PhoneSite` في `js/main.js`:

| الإعداد | الوصف |
| --- | --- |
| `PhoneSite.config.showTrustSection` | إخفاء قسم «لماذا تختارنا» تلقائيًا عند ضبطه على `false` |
| `PhoneSite.config.orderEndpoint` | رابط Google Apps Script Web App المنشور (`/exec`) لاستقبال الطلبات. فارغ افتراضيًا، ولن يظهر نجاح قبل ضبطه |
| `PhoneSite.config.phonePattern` | نمط رقم الهاتف الجزائري المحلي (`05/06/07` + 8 أرقام)؛ تُطبّع الصيغ `+213` و`00213` قبله |
| `PhoneSite.config.pricing` | سعر الوحدة وكلفة التوصيل والعملة — القيم `null` افتراضيًا ولا تُخترع أسعار |
| `PhoneSite.config.delivery` | تفعيل التوصيل؛ عند `enabled: false` يصبح العنوان اختياريًا ويُرسل `delivery: false` |
| `PhoneSite.specs` | قيم المواصفات الست (شاشة، كاميرات، أداء، بطارية، تخزين، تصنيع) — فارغة افتراضيًا |
| `PhoneSite.config.footerLinks` | روابط الضمان، الإرجاع، الخصوصية، الشروط، وحسابات التواصل الاجتماعي |

### ربط نموذج الطلب

لا يُرسل النموذج أي بيانات حتى تضبط `PhoneSite.config.orderEndpoint` برابط Web App منشور. اتبع الخطوات الكاملة في `apps-script/SETUP.md`، وبعد أي تعديل على `Code.gs` انشر إصدارًا جديدًا. راجع أيضًا `apps-script/Code.gs` لترتيب أعمدة ورقة `Orders`.

مثال لضبط الإعدادات قبل تحميل السكربت في `<head>`:

```html
<script>
  window.PhoneSite = {
    config: {
      showTrustSection: false,
      footerLinks: {
        warranty: "https://example.com/warranty",
        social: [{ label: "Instagram", url: "https://instagram.com/...", icon: "instagram" }]
      }
    }
  };
</script>
```

### الصور المتوقعة

تستخدم الصفحة المسارات التالية داخل `assets/images/` (ويظهر البديل CSS إن لم تكن موجودة):

```text
hero-phones.webp
phone-light-blue.webp
phone-dark-cherry.webp
phone-dark-gray.webp
phone-silver.webp
specs-phone.webp
cta-phones.webp
```

### صور المعرض

يعرض قسم «معرض الصور» الصور الحقيقية المتوفرة للّون النشط فقط، بهذا الترتيب:

```text
assets/images/gallery/<color-key>/front.(webp|jpg|jpeg|png)
assets/images/gallery/<color-key>/back.(webp|jpg|jpeg|png)
assets/images/gallery/<color-key>/side.(webp|jpg|jpeg|png)
assets/images/gallery/<color-key>/camera.(webp|jpg|jpeg|png)
assets/images/gallery/<color-key>/edges.(webp|jpg|jpeg|png)
assets/images/gallery/<color-key>/ad.(webp|jpg|jpeg|png)
assets/images/gallery/<color-key>/design.(webp|jpg|jpeg|png)
```

- `color-key`: `light-blue` أو `dark-cherry` أو `dark-gray` أو `silver`.
- تُجرّب الامتدادات بالترتيب: `webp` ثم `jpg` ثم `jpeg` ثم `png`.
- لا تُعرض أي صورة إلا إذا كان ملفها موجودًا فعلًا؛ الفتحات الناقصة تُخفى تلقائيًا.
- إذا لم توجد صورة واحدة للّون النشط تظهر رسالة «صور هذا اللون قيد الإضافة».
- اللون الفضي: عند غياب `gallery/silver/ad.*` تُستخدم `assets/images/phone-silver.jpg` كصورة إعلانية.
- لا تُستخدم `hero-phones.png` داخل المعرض.

التسجيل الكامل موجود في `PhoneSite.images` داخل `js/main.js`، ويمكن تعديل المسارات أو التسميات من هناك دون تغيير بنية HTML.

---

## ملاحظات قبل النشر

- استبدل إجابات الأسئلة الشائعة بالسياسات والأسعار وشروط الضمان الفعلية.
- أدخل قيم `PhoneSite.specs` بعد تأكيد الطراز التقني.
- اضبط `PhoneSite.config.orderEndpoint` بعد نشر `apps-script/Code.gs`، وانشر إصدارًا جديدًا بعد أي تعديل عليه.
- أدخل الأسعار الحقيقية في `PhoneSite.config.pricing` إن توفرت؛ القيم `null` تعني أن حقول السعر تبقى فارغة في الطلب.
- أضف روابط التواصل والروابط القانونية الحقيقية في `footerLinks` قبل إظهارها.
- راجع نصوص الأسعار والتوفر إن تحوّل الموقع إلى متجر إلكتروني، وأضف إشعار خصوصية مناسبًا لأن النموذج يجمع الاسم والهاتف والعنوان.

---

## التوافق

يدعم المتصفحات الحديثة (Chrome، Edge، Firefox، Safari) مع تدرّج آمن للميزات عند غياب `IntersectionObserver` أو تفضيل تقليل الحركة.
#   I P H O N E - T E S T  
 #   I P H O N E - T E S T  
 #   I P H O N E - T E S T  
 #   I P H O N E - T E S T  
 