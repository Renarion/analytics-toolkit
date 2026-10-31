(() => {
  "use strict";

  const STORAGE_KEY = "analytics_toolkit_list_v1";
  const QUOTES = { none: "", single: "'", double: '"' };
  const WRAPS = { none: ["", ""], round: ["(", ")"], square: ["[", "]"] };

  const els = {
    input: document.getElementById("input"),
    output: document.getElementById("output"),
    count: document.getElementById("count"),
    dedupe: document.getElementById("dedupe"),
    copy: document.getElementById("copy-btn"),
    clear: document.getElementById("clear-btn"),
    toast: document.getElementById("toast"),
  };

  let toastTimer = 0;

  function radioValue(name) {
    return document.querySelector(`input[name="${name}"]:checked`)?.value;
  }

  function setRadio(name, value) {
    const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (radio) radio.checked = true;
  }

  function stripQuotes(value) {
    const match = value.match(/^(['"`])(.*)\1$/s);
    return match ? match[2] : value;
  }

  function splitValues(text, mode) {
    // "lines" keeps spaces inside a value (e.g. a column of city names).
    const parts = mode === "lines" ? text.split(/\r?\n/) : text.split(/[\s,;]+/);
    return parts
      .map((part) => stripQuotes(part.trim().replace(/[,;]+$/, "").trim()))
      .filter(Boolean);
  }

  // Single quotes follow SQL escaping, double quotes follow Python/JSON escaping.
  function quote(value, style) {
    if (style === "single") return `'${value.replace(/'/g, "''")}'`;
    if (style === "double") return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    return value;
  }

  function format() {
    let values = splitValues(els.input.value, radioValue("split"));
    if (els.dedupe.checked) values = [...new Set(values)];

    const [open, close] = WRAPS[radioValue("wrap")] || WRAPS.none;
    const style = radioValue("quotes");
    const body = values.map((value) => quote(value, style)).join(", ");

    els.output.value = values.length ? `${open}${body}${close}` : "";
    els.count.textContent = `${values.length} ${values.length === 1 ? "value" : "values"}`;
    save();
  }

  function save() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          input: els.input.value,
          quotes: radioValue("quotes"),
          wrap: radioValue("wrap"),
          split: radioValue("split"),
          dedupe: els.dedupe.checked,
        })
      );
    } catch (_) {
      /* storage unavailable: the tool still works, it just won't remember */
    }
  }

  function restore() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!data) return;
      els.input.value = typeof data.input === "string" ? data.input : "";
      if (data.quotes in QUOTES) setRadio("quotes", data.quotes);
      if (data.wrap in WRAPS) setRadio("wrap", data.wrap);
      if (data.split === "any" || data.split === "lines") setRadio("split", data.split);
      els.dedupe.checked = Boolean(data.dedupe);
    } catch (_) {
      /* ignore broken saved state */
    }
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.hidden = false;
    toastTimer = window.setTimeout(() => {
      els.toast.hidden = true;
    }, 1600);
  }

  async function copyOutput() {
    if (!els.output.value) {
      showToast("Nothing to copy yet");
      return;
    }
    try {
      await navigator.clipboard.writeText(els.output.value);
      showToast("Copied");
    } catch (_) {
      els.output.select();
      document.execCommand("copy");
      showToast("Copied");
    }
  }

  function init() {
    restore();
    els.input.addEventListener("input", format);
    document.querySelectorAll(".options input").forEach((input) => {
      input.addEventListener("change", format);
    });
    els.copy.addEventListener("click", () => copyOutput());
    els.clear.addEventListener("click", () => {
      els.input.value = "";
      format();
      els.input.focus();
    });
    els.output.addEventListener("focus", () => els.output.select());
    format();
  }

  init();
})();
