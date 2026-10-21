// Замер: качаем файлы разного размера и смотрим, дошли ли они целиком.
// Весь вывод через textContent — никакого innerHTML.
(function () {
  "use strict";

  var FILES = [
    { label: "1 КБ", url: "p/1kb.bin", bytes: 1024 },
    { label: "20 КБ", url: "p/20kb.bin", bytes: 20 * 1024 },
    { label: "100 КБ", url: "p/100kb.bin", bytes: 100 * 1024 },
    { label: "1 МБ", url: "p/1mb.bin", bytes: 1024 * 1024 }
  ];
  var RUNS = 3;          // попыток на каждый файл
  var TIMEOUT_MS = 15000;

  var $ = function (id) { return document.getElementById(id); };
  var runBtn = $("run"), copyBtn = $("copy"), rows = $("rows"), out = $("out"), verdict = $("verdict");

  function cell(tr, text, cls) {
    var td = document.createElement("td");
    td.textContent = text;
    if (cls) td.className = cls;
    tr.appendChild(td);
  }

  // Качает файл потоком, чтобы было видно, сколько байт реально дошло до обрыва.
  async function fetchOnce(file) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
    var started = performance.now();
    var received = 0;
    try {
      var url = file.url + "?r=" + Date.now() + "-" + Math.random().toString(36).slice(2);
      var res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
      if (!res.ok) {
        return { ok: false, received: 0, ms: performance.now() - started, error: "HTTP " + res.status };
      }
      var reader = res.body.getReader();
      for (;;) {
        var chunk = await reader.read();
        if (chunk.done) break;
        received += chunk.value.length;
      }
      var full = received === file.bytes;
      return { ok: full, received: received, ms: performance.now() - started, error: full ? "" : "обрыв" };
    } catch (e) {
      var name;
      if (e && e.name === "AbortError") name = "таймаут " + TIMEOUT_MS / 1000 + " с";
      else if (e && e.name === "TypeError") name = "соединение оборвано";
      else name = (e && e.name) || "ошибка";
      return { ok: false, received: received, ms: performance.now() - started, error: name };
    } finally {
      clearTimeout(timer);
    }
  }

  function fmtMs(ms) { return Math.round(ms) + " мс"; }
  function fmtKb(b) { return b >= 1048576 ? (b / 1048576).toFixed(2) + " МБ" : Math.round(b / 1024 * 10) / 10 + " КБ"; }

  function conclude(results) {
    var small = results[0].every(function (r) { return r.ok; });
    var bigOk = [1, 2, 3].map(function (i) { return results[i].filter(function (r) { return r.ok; }).length; });
    var bigTotal = RUNS * 3;
    var bigOkSum = bigOk[0] + bigOk[1] + bigOk[2];
    if (small && bigOkSum === bigTotal) {
      return { cls: "ok", text: "Всё скачалось целиком." };
    }
    if (small && bigOkSum < bigTotal) {
      return { cls: "warn", text: "Маленький файл дошёл, а крупные обрываются или идут с ошибками. Похоже на ограничение трафика." };
    }
    if (!small && bigOkSum === 0) {
      return { cls: "warn", text: "Не скачалось ничего. Либо сайт недоступен с вашего интернета, либо пропало соединение." };
    }
    return { cls: "warn", text: "Результат нестабильный: часть файлов дошла, часть нет." };
  }

  function buildReport(results, conclusion) {
    var lines = [];
    var nav = navigator.connection || {};
    lines.push("хост: " + location.host);
    lines.push("провайдер: " + ($("isp").value.trim() || "не указан"));
    lines.push("подключение: " + ($("net").value.trim() || "не указано"));
    lines.push("время: " + new Date().toISOString());
    lines.push("браузер: " + navigator.userAgent);
    if (nav.effectiveType) lines.push("тип сети (по данным браузера): " + nav.effectiveType);
    lines.push("вывод: " + conclusion.text);
    FILES.forEach(function (f, i) {
      var parts = results[i].map(function (r) {
        return (r.ok ? "ок " : "ОШИБКА(" + r.error + ", дошло " + fmtKb(r.received) + ") ") + fmtMs(r.ms);
      });
      lines.push(f.label + ": " + parts.join(" | "));
    });
    return lines.join("\n");
  }

  async function run() {
    runBtn.disabled = true;
    copyBtn.disabled = true;
    rows.textContent = "";
    out.value = "";
    verdict.style.display = "none";
    runBtn.textContent = "Идёт замер…";

    var results = FILES.map(function () { return []; });
    for (var i = 0; i < FILES.length; i++) {
      for (var n = 1; n <= RUNS; n++) {
        var r = await fetchOnce(FILES[i]);
        results[i].push(r);
        var tr = document.createElement("tr");
        cell(tr, FILES[i].label);
        cell(tr, String(n));
        cell(tr, r.ok ? "дошёл" : "не дошёл (" + r.error + ")", r.ok ? "ok" : "bad");
        cell(tr, fmtKb(r.received));
        cell(tr, fmtMs(r.ms));
        rows.appendChild(tr);
      }
    }

    var conclusion = conclude(results);
    verdict.textContent = conclusion.text;
    verdict.className = conclusion.cls;
    verdict.style.display = "block";
    out.value = buildReport(results, conclusion);
    copyBtn.disabled = false;
    runBtn.disabled = false;
    runBtn.textContent = "Повторить замер";
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(out.value);
    } catch (e) {
      out.removeAttribute("readonly");
      out.select();
      document.execCommand("copy");
      out.setAttribute("readonly", "");
    }
    copyBtn.textContent = "Скопировано";
    setTimeout(function () { copyBtn.textContent = "Скопировать результат"; }, 2000);
  }

  runBtn.addEventListener("click", run);
  copyBtn.addEventListener("click", copy);
})();
