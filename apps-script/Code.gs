/**
 * Phone orders — Google Apps Script web app backend.
 *
 * Setup and deployment steps live in SETUP.md. This file intentionally holds
 * no secrets: the web app URL is public, and every order is validated here.
 */

// Spreadsheet ID found in the Google Sheet URL between /d/ and /edit
var SPREADSHEET_ID = "1mBHYLKVhhzrPBzT7KiL_TXjtvJHh6G-iCtzvW27Bv0U";

var SHEET_NAME = "Orders";

var HEADERS = [
  "order_id",
  "created_at",
  "status",
  "color_key",
  "color_name",
  "quantity",
  "full_name",
  "phone",
  "wilaya",
  "commune",
  "address",
  "notes",
  "unit_price",
  "delivery_cost",
  "total",
  "admin_notes"
];

var COLOR_NAMES = {
  "light-blue": "الأزرق الفاتح",
  "dark-cherry": "الكرز الداكن",
  "dark-gray": "الرمادي الداكن",
  "silver": "الفضي"
};

var RATE_LIMIT_SECONDS = 60;
var FORMULA_PREFIX = /^[=+\-@]/;

/**
 * Health check only. Never return order data here.
 * @return {ContentService.TextOutput}
 */
function doGet() {
  var sheetReady = false;
  try {
    if (SPREADSHEET_ID && SPREADSHEET_ID !== "PASTE_SPREADSHEET_ID_HERE") {
      var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
      if (spreadsheet) {
        var sheet = spreadsheet.getSheetByName(SHEET_NAME);
        if (sheet) {
          sheetReady = true;
        }
      }
    }
  } catch (error) {
    sheetReady = false;
  }
  return jsonResponse({ ok: true, service: "orders", sheetReady: sheetReady });
}

/**
 * Receive one order as a text/plain JSON request.
 * @param {Object} e Apps Script event
 * @return {ContentService.TextOutput}
 */
function doPost(e) {
  try {
    var payload = parsePayload(e);
    if (!payload) {
      return errorResponse("invalid_json", "تعذّر قراءة بيانات الطلب.");
    }

    // Honeypot: real customers never see this field. Pretend success so bots
    // do not learn that they were rejected, but write nothing.
    if (cleanText(payload.website)) {
      return jsonResponse({ ok: true, orderId: makeOrderId() });
    }

    var order = validateOrder(payload);
    if (order.errorCode) {
      return errorResponse(order.errorCode, order.message);
    }

    var lock = LockService.getScriptLock();
    var locked = false;
    try {
      lock.waitLock(10000);
      locked = true;
    } catch (lockError) {
      return errorResponse(
        "server_error",
        "الخادم مشغول حاليًا. يرجى المحاولة مرة أخرى."
      );
    }

    try {
      if (!SPREADSHEET_ID || SPREADSHEET_ID === "PASTE_SPREADSHEET_ID_HERE") {
        return errorResponse("config", "نظام الطلبات غير مهيأ بعد");
      }

      var cache = CacheService.getScriptCache();
      var cacheKey = "order-phone-" + order.phone;

      // Basic duplicate protection: same phone within 60 seconds.
      if (cache.get(cacheKey)) {
        return errorResponse(
          "rate_limited",
          "تم استلام طلب بهذا الرقم قبل قليل. يرجى المحاولة بعد دقيقة."
        );
      }

      var sheet;
      try {
        sheet = getOrdersSheet();
      } catch (configError) {
        return errorResponse("config", "نظام الطلبات غير مهيأ بعد");
      }

      var orderId = makeUniqueOrderId(sheet);
      var createdAt = new Date().toISOString();

      var row = [
        safeText(orderId),
        safeText(createdAt),
        safeText("جديد"),
        safeText(order.colorKey),
        safeText(order.colorName),
        order.quantity,
        safeText(order.fullName),
        safeText(order.phone),
        safeText(order.wilaya),
        safeText(order.commune),
        safeText(order.address),
        safeText(order.notes),
        order.unitPrice,
        order.deliveryCost,
        order.total,
        ""
      ];

      try {
        sheet.appendRow(row);
        SpreadsheetApp.flush();
      } catch (appendError) {
        return errorResponse("save_failed", "تعذّر حفظ الطلب، حاول مرة أخرى");
      }

      try {
        var lastRow = sheet.getLastRow();
        if (lastRow >= 2) {
          var lastOrderId = sheet.getRange(lastRow, 1).getValue();
          if (String(lastOrderId) !== String(orderId)) {
            return errorResponse("save_failed", "تعذّر حفظ الطلب، حاول مرة أخرى");
          }
        } else {
          return errorResponse("save_failed", "تعذّر حفظ الطلب، حاول مرة أخرى");
        }
      } catch (verifyError) {
        return errorResponse("save_failed", "تعذّر حفظ الطلب، حاول مرة أخرى");
      }

      // If caching fails, the order is already saved; do not report failure.
      try {
        cache.put(cacheKey, "1", RATE_LIMIT_SECONDS);
      } catch (cacheError) {
        console.warn("Rate-limit cache could not be written.");
      }

      return jsonResponse({ ok: true, orderId: orderId });
    } finally {
      if (locked) lock.releaseLock();
    }
  } catch (error) {
    // Keep implementation details out of the public response.
    console.error("doPost failed: " + (error && error.message ? error.message : error));
    return errorResponse(
      "server_error",
      "تعذّر حفظ الطلب. يرجى المحاولة مرة أخرى."
    );
  }
}

/**
 * Read the raw JSON body. The client sends text/plain to avoid a CORS
 * preflight, so JSON.parse is always used instead of relying on e.parameters.
 * @param {Object} e
 * @return {?Object}
 */
function parsePayload(e) {
  if (!e || !e.postData || typeof e.postData.contents !== "string") {
    return null;
  }

  try {
    var parsed = JSON.parse(e.postData.contents);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch (error) {
    return null;
  }
}

/**
 * Validate and normalise every field server-side. Client values are never
 * trusted, including the colour name (only the key is accepted).
 * @param {Object} payload
 * @return {Object}
 */
function validateOrder(payload) {
  var colorKey = cleanText(payload.color_key);
  if (!COLOR_NAMES.hasOwnProperty(colorKey)) {
    return validationError("color_key", "يرجى اختيار لون صحيح.");
  }

  var quantity = Number(payload.quantity);
  if (!isFinite(quantity) || quantity % 1 !== 0 || quantity < 1 || quantity > 10) {
    return validationError(
      "quantity",
      "الكمية يجب أن تكون عددًا صحيحًا بين 1 و10."
    );
  }

  var fullName = cleanText(payload.full_name);
  if (fullName.length < 3 || fullName.length > 80) {
    return validationError(
      "full_name",
      "الاسم الكامل يجب أن يكون بين 3 و80 حرفًا."
    );
  }

  var phone = normalizePhone(payload.phone);
  if (!phone) {
    return validationError(
      "phone",
      "رقم الهاتف غير صحيح. استخدم 05/06/07 أو +213/00213."
    );
  }

  var wilaya = cleanText(payload.wilaya);
  if (wilaya.length < 2 || wilaya.length > 60) {
    return validationError(
      "wilaya",
      "الولاية يجب أن تكون بين حرفين و60 حرفًا."
    );
  }

  var commune = cleanText(payload.commune);
  if (commune.length < 2 || commune.length > 60) {
    return validationError(
      "commune",
      "البلدية يجب أن تكون بين حرفين و60 حرفًا."
    );
  }

  var deliveryEnabled = payload.delivery !== false;
  var address = cleanText(payload.address);
  if (deliveryEnabled && !address) {
    return validationError("address", "عنوان التوصيل مطلوب.");
  }
  if (address.length > 300) {
    return validationError(
      "address",
      "عنوان التوصيل يجب ألا يتجاوز 300 حرف."
    );
  }

  var notes = cleanText(payload.notes);
  if (notes.length > 500) {
    return validationError(
      "notes",
      "الملاحظات يجب ألا تتجاوز 500 حرف."
    );
  }

  return {
    colorKey: colorKey,
    colorName: COLOR_NAMES[colorKey],
    quantity: quantity,
    fullName: fullName,
    phone: phone,
    wilaya: wilaya,
    commune: commune,
    address: address,
    notes: notes,
    unitPrice: optionalNumber(payload.unit_price),
    deliveryCost: optionalNumber(payload.delivery_cost),
    total: optionalNumber(payload.total)
  };
}

function validationError(errorCode, message) {
  return { errorCode: errorCode, message: message };
}

/**
 * Normalise Algerian mobile numbers to the local 10-digit form.
 * Accepted: 05/06/07 + 8 digits, +213 + 9 digits, 00213 + 9 digits.
 * @param {*} value
 * @return {string} Local number, or "" when invalid.
 */
function normalizePhone(value) {
  var phone = cleanText(value).replace(/[^\d+]/g, "");

  if (phone.indexOf("+213") === 0) {
    var plusRest = phone.slice(4);
    if (plusRest.charAt(0) === "0") plusRest = plusRest.slice(1);
    phone = "0" + plusRest;
  } else if (phone.indexOf("00213") === 0) {
    var zeroRest = phone.slice(5);
    if (zeroRest.charAt(0) === "0") zeroRest = zeroRest.slice(1);
    phone = "0" + zeroRest;
  }

  return /^0[567][0-9]{8}$/.test(phone) ? phone : "";
}

/**
 * Trim, collapse whitespace and remove control characters.
 * @param {*} value
 * @return {string}
 */
function cleanText(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Empty prices stay empty. Only real finite, non-negative numbers are written.
 * @param {*} value
 * @return {number|string}
 */
function optionalNumber(value) {
  if (value === null || value === undefined || value === "") return "";
  var number = Number(value);
  if (!isFinite(number) || number < 0) return "";
  return number;
}

/**
 * Spreadsheet formula-injection guard: force suspicious text to be text.
 * @param {*} value
 * @return {string}
 */
function safeText(value) {
  var text = cleanText(value);
  return FORMULA_PREFIX.test(text) ? "'" + text : text;
}

/**
 * Return the Orders sheet, creating it and its header when needed.
 * @return {Sheet}
 */
function getOrdersSheet() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === "PASTE_SPREADSHEET_ID_HERE") {
    throw new Error("Spreadsheet ID not configured.");
  }

  var spreadsheet;
  try {
    spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (error) {
    throw error;
  }

  if (!spreadsheet) throw new Error("Could not open spreadsheet.");

  var sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet
      .getRange(1, 1, 1, HEADERS.length)
      .setValues([HEADERS]);
  } else {
    // Ensure headers match exactly if header row exists
    var headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    var currentHeaders = headerRange.getValues()[0];
    var needsUpdate = false;
    for (var i = 0; i < HEADERS.length; i += 1) {
      if (String(currentHeaders[i]) !== String(HEADERS[i])) {
        needsUpdate = true;
        break;
      }
    }
    if (needsUpdate && sheet.getLastRow() === 1) {
      headerRange.setValues([HEADERS]);
    } else if (needsUpdate && sheet.getLastRow() > 1) {
      // If headers don't match but data exists, still ensure correct headers
      headerRange.setValues([HEADERS]);
    }
  }

  sheet.setFrozenRows(1);

  // Keep leading zeroes in 05/06/07 phone numbers.
  sheet.getRange("H:H").setNumberFormat("@");

  return sheet;
}

/**
 * Generate an order reference such as PH-260612-7KQ2.
 * @return {string}
 */
function makeOrderId() {
  var datePart = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyMMdd"
  );
  var alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  var suffix = "";
  for (var index = 0; index < 4; index += 1) {
    suffix += alphabet.charAt(
      Math.floor(Math.random() * alphabet.length)
    );
  }
  return "PH-" + datePart + "-" + suffix;
}

/**
 * Retry generation until the reference is not already in column A.
 * @param {Sheet} sheet
 * @return {string}
 */
function makeUniqueOrderId(sheet) {
  var existing = {};
  var lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var row = 0; row < ids.length; row += 1) {
      existing[String(ids[row][0])] = true;
    }
  }

  for (var attempt = 0; attempt < 50; attempt += 1) {
    var candidate = makeOrderId();
    if (!existing[candidate]) return candidate;
  }

  // Extremely unlikely fallback. Keep incrementing until the ID is unique so
  // the "unique in the sheet" guarantee is never weakened.
  var base = makeOrderId();
  for (var counter = 0; counter < 10000; counter += 1) {
    var fallback = base + counter;
    if (!existing[fallback]) return fallback;
  }

  throw new Error("Could not generate a unique order ID.");
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function errorResponse(errorCode, message) {
  return jsonResponse({
    ok: false,
    error: errorCode,
    message: message
  });
}
