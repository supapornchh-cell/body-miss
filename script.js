/* ==========================================================
   Body Scent — script.js (ใช้ร่วมกันทุกหน้า)
   - product.html : โหลดสินค้า + ปุ่มกรอง mood
   - order.html   : เติมฟอร์มจาก URL parameter + ส่งออเดอร์
   - admin.html   : ดึงออเดอร์จาก Google Sheet (CSV) มาแสดงเป็นตาราง
   สคริปต์ตรวจจากองค์ประกอบ (id) ที่มีในหน้า จึงรันเฉพาะส่วนที่เกี่ยวข้อง
   ========================================================== */

(function () {
  "use strict";

  /* ---------- ค่าคงที่ ---------- */
  var PRODUCTS_URL = "products.json";
  var ORDER_ENDPOINT =
    "https://script.google.com/macros/s/AKfycbywTj3a1oAzUNbhmIvj1_nvzfgprptO1Fncbri3vZrYjipN3_4OSRpWxt1CpGJq2ovp/exec";
  var ORDERS_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vT7edTW2086lkfcurvBb6HKYjzK7ArFRvFRKd1O9-z-fetNNA9iJagBxHUnsVZr2OwASBAbxPaWDlca/pub?gid=0&single=true&output=csv";

  var MOODS = [
    { key: "all", label: "ทั้งหมด" },
    { key: "fresh", label: "Fresh" },
    { key: "sweet", label: "Sweet" },
    { key: "confident", label: "Confident" },
    { key: "romance", label: "Romance" }
  ];

  var TYPE_LABELS = { spray: "น้ำหอมฉีดตัว", rollon: "โรลออน" };

  /* ---------- ตัวช่วย ---------- */
  function $(selector) {
    return document.querySelector(selector);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function formatPrice(value) {
    var n = Number(value);
    return isNaN(n) ? String(value) : n.toLocaleString("th-TH");
  }

  /* ==========================================================
     1) หน้า product.html
     ========================================================== */
  function initProductPage() {
    var filterBar = $("#filter-bar");
    var list = $("#product-list");
    if (!filterBar || !list) return;

    var products = [];
    var validMoods = MOODS.map(function (m) {
      return m.key;
    });

    function moodFromUrl() {
      var m = (new URLSearchParams(window.location.search).get("mood") || "")
        .trim()
        .toLowerCase();
      return validMoods.indexOf(m) !== -1 ? m : "all";
    }

    function buildFilterBar(activeMood) {
      filterBar.textContent = "";
      MOODS.forEach(function (m) {
        var btn = el("button");
        btn.type = "button";
        btn.dataset.mood = m.key;
        btn.setAttribute("aria-pressed", m.key === activeMood ? "true" : "false");
        if (m.key !== "all") btn.appendChild(el("span", "mood-dot"));
        btn.appendChild(document.createTextNode(m.label));
        filterBar.appendChild(btn);
      });
    }

    function buildOrderLink(p) {
      var itemName = p.name + (p.size ? " " + p.size : "");
      return (
        "order.html?item=" +
        encodeURIComponent(itemName) +
        "&price=" +
        encodeURIComponent(p.price)
      );
    }

    function buildCard(p) {
      var card = el("article", "product-card");
      card.dataset.mood = p.mood;

      var imgWrap = el("div", "product-card__image");
      var img = document.createElement("img");
      img.src = p.image;
      img.alt = p.name;
      img.loading = "lazy";
      imgWrap.appendChild(img);

      var body = el("div", "product-card__body");

      var moodLabel = el("span", "mood-label");
      moodLabel.appendChild(el("span", "mood-dot"));
      moodLabel.appendChild(
        document.createTextNode(TYPE_LABELS[p.type] || p.type)
      );

      var title = el("h3", "product-card__title", p.name);

      var meta = el("div", "product-card__meta");
      meta.appendChild(el("span", "", p.size ? p.size : TYPE_LABELS[p.type] || ""));
      var price = el("span", "price", "฿" + formatPrice(p.price));
      meta.appendChild(price);

      var buy = el("a", "btn btn--small btn--block", "สั่งซื้อ");
      buy.href = buildOrderLink(p);

      body.appendChild(moodLabel);
      body.appendChild(title);
      body.appendChild(el("div", "", "")).style.flex = "1";
      body.appendChild(meta);
      body.appendChild(buy);

      card.appendChild(imgWrap);
      card.appendChild(body);
      return card;
    }

    function render(mood) {
      list.textContent = "";
      var shown = products.filter(function (p) {
        return mood === "all" || p.mood === mood;
      });
      if (!shown.length) {
        list.appendChild(el("p", "", "ยังไม่มีสินค้าในหมวดนี้"));
        return;
      }
      shown.forEach(function (p) {
        list.appendChild(buildCard(p));
      });
    }

    function setActive(mood) {
      Array.prototype.forEach.call(filterBar.querySelectorAll("button"), function (b) {
        b.setAttribute("aria-pressed", b.dataset.mood === mood ? "true" : "false");
      });
      render(mood);

      // อัปเดต URL ให้แชร์/รีเฟรชแล้วยังคงตัวกรองเดิม
      if (window.history && window.history.replaceState) {
        var url = new URL(window.location.href);
        if (mood === "all") url.searchParams.delete("mood");
        else url.searchParams.set("mood", mood);
        window.history.replaceState(null, "", url);
      }
    }

    filterBar.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-mood]");
      if (btn) setActive(btn.dataset.mood);
    });

    var initialMood = moodFromUrl();
    buildFilterBar(initialMood);
    list.appendChild(el("p", "", "กำลังโหลดสินค้า..."));

    fetch(PRODUCTS_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        products = data;
        render(initialMood);
      })
      .catch(function (err) {
        console.error(err);
        list.textContent = "";
        list.appendChild(el("p", "", "ไม่สามารถโหลดสินค้าได้ กรุณารีเฟรชหน้านี้อีกครั้ง"));
      });
  }

  /* ==========================================================
     2) หน้า order.html
     ========================================================== */
  function initOrderPage() {
    var form = $("#orderForm");
    if (!form) return;

    // เติม item และ price จาก URL parameter ลงช่อง #items และ #total
    var params = new URLSearchParams(window.location.search);
    var item = params.get("item");
    var priceParam = params.get("price");

    var itemsField = $("#items");
    var totalField = $("#total");
    if (itemsField && item !== null) itemsField.value = item;
    if (totalField && priceParam !== null) totalField.value = priceParam;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;

      var payload = {
        customerName: $("#customerName").value.trim(),
        contact: $("#contact").value.trim(),
        items: $("#items").value.trim(),
        total: $("#total").value.trim(),
        note: $("#note") ? $("#note").value.trim() : ""
      };

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      fetch(ORDER_ENDPOINT, {
        method: "POST",
        body: JSON.stringify(payload)
      })
        .then(function () {
          window.location.href = "thankyou.html";
        })
        .catch(function (error) {
          console.error(error);
          alert("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  /* ==========================================================
     3) หน้า admin.html
     ========================================================== */

  // แปลงข้อความ CSV เป็น array ของแถว รองรับเครื่องหมายคำพูด, "" ซ้อน,
  // เครื่องหมายจุลภาคและขึ้นบรรทัดใหม่ภายในช่อง, และ \r\n
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;

    text = text.replace(/^\uFEFF/, "");

    for (var i = 0; i < text.length; i++) {
      var c = text.charAt(i);

      if (inQuotes) {
        if (c === '"') {
          if (text.charAt(i + 1) === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text.charAt(i + 1) === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }

    if (field !== "" || row.length) {
      row.push(field);
      rows.push(row);
    }

    // ตัดแถวว่างทิ้ง
    return rows.filter(function (r) {
      return r.some(function (cell) {
        return cell.trim() !== "";
      });
    });
  }

  function initAdminPage() {
    var tbody = $("#ordersTable tbody");
    if (!tbody) return;

    var COLS = 6;

    function showMessage(msg) {
      tbody.textContent = "";
      var tr = document.createElement("tr");
      var td = el("td", "", msg);
      td.colSpan = COLS;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    showMessage("กำลังโหลดข้อมูล...");

    // ใส่พารามิเตอร์กัน cache ของเบราว์เซอร์
    var url = ORDERS_CSV_URL + "&_=" + Date.now();

    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        var rows = parseCSV(text);
        rows.shift(); // แถวแรกคือหัวคอลัมน์

        if (!rows.length) {
          showMessage("ยังไม่มีรายการสั่งซื้อ");
          return;
        }

        // ออเดอร์ใหม่ถูกต่อท้ายชีตเสมอ จึงกลับลำดับให้ล่าสุดขึ้นก่อน
        rows.reverse();

        tbody.textContent = "";
        rows.forEach(function (r) {
          var tr = document.createElement("tr");
          for (var i = 0; i < COLS; i++) {
            var value = r[i] !== undefined ? r[i] : "";
            if (i === 4 && value !== "" && !isNaN(Number(value))) {
              value = formatPrice(value);
            }
            tr.appendChild(el("td", "", value));
          }
          tbody.appendChild(tr);
        });
      })
      .catch(function (err) {
        console.error(err);
        showMessage("ไม่สามารถโหลดข้อมูลได้ กรุณารีเฟรชหน้านี้อีกครั้ง");
      });
  }

  /* ---------- เริ่มทำงาน ---------- */
  function init() {
    initProductPage();
    initOrderPage();
    initAdminPage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
