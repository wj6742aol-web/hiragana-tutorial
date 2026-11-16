/** EN→KO 번역 (캐시) — 한국어 뜻을 메인으로 */
(function () {
  const CACHE_KEY = "nihongo-tr-en-ko-v1";
  const memory = Object.create(null);
  let store = null;

  function loadStore() {
    if (store) return store;
    try {
      store = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") || {};
    } catch {
      store = {};
    }
    return store;
  }

  function saveStore() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(store));
    } catch {
      /* quota */
    }
  }

  function normKey(text) {
    return String(text || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function looksKorean(text) {
    return /[가-힣]/.test(String(text || ""));
  }

  async function translateEnToKo(text) {
    const raw = String(text || "").trim();
    if (!raw) return "";
    if (looksKorean(raw)) return raw;

    const key = normKey(raw);
    if (memory[key]) return memory[key];
    const db = loadStore();
    if (db[key]) {
      memory[key] = db[key];
      return db[key];
    }

    let translated = "";
    try {
      const url =
        "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=" +
        encodeURIComponent(raw);
      const res = await fetch(url);
      if (!res.ok) throw new Error("gtx " + res.status);
      const data = await res.json();
      translated = (data?.[0] || []).map((row) => row?.[0] || "").join("").trim();
    } catch {
      try {
        const url =
          "https://api.mymemory.translated.net/get?q=" +
          encodeURIComponent(raw.slice(0, 450)) +
          "&langpair=en|ko";
        const res = await fetch(url);
        const data = await res.json();
        translated = (data?.responseData?.translatedText || "").trim();
        if (/^\*?\s*PLEASE SELECT/i.test(translated)) translated = "";
      } catch {
        translated = "";
      }
    }

    if (!translated) translated = raw;
    memory[key] = translated;
    db[key] = translated;
    saveStore();
    return translated;
  }

  async function translateMany(texts, { concurrency = 4 } = {}) {
    const list = [...new Set((texts || []).map((t) => String(t || "").trim()).filter(Boolean))];
    const out = Object.create(null);
    let i = 0;
    async function worker() {
      while (i < list.length) {
        const idx = i++;
        const t = list[idx];
        out[t] = await translateEnToKo(t);
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(concurrency, list.length) }, () => worker())
    );
    return out;
  }

  /** API 단어 객체의 뜻을 한국어 메인으로 맞춤 */
  async function ensureKoreanItem(item, { examples = true } = {}) {
    if (!item) return item;
    if (item.koMain && looksKorean(item.ko) && (!examples || item.examplesOk)) {
      return item;
    }

    const enParts =
      item.meaningsEn?.length
        ? item.meaningsEn
        : item.meanings?.length && !looksKorean(item.meanings.join(" "))
          ? item.meanings
          : item.en
            ? [item.en]
            : !looksKorean(item.ko)
              ? String(item.ko)
                  .split(/\s*;\s*|\s*\/\s*/)
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [];

    let ko = item.ko;
    let en = item.en;
    if (enParts.length) {
      const joined = enParts.join("; ");
      en = item.en || joined;
      if (!(item.koMain && looksKorean(item.ko))) {
        ko = await translateEnToKo(joined);
      }
    }

    let nextExamples = item.examples;
    let examplesOk = item.examplesOk;
    if (examples && item.examples?.length) {
      nextExamples = await Promise.all(
        item.examples.map(async (ex) => {
          if (!ex?.en || ex.ko) return ex;
          const koEx = await translateEnToKo(ex.en);
          return { ...ex, ko: koEx };
        })
      );
      examplesOk = true;
    }

    return {
      ...item,
      en,
      meaningsEn: enParts.length ? enParts : item.meaningsEn,
      ko: ko || item.ko || "(뜻 없음)",
      examples: nextExamples,
      examplesOk: examples ? examplesOk : item.examplesOk,
      koMain: true,
      tip:
        (item.tip || "").replace(/\(영문 뜻\)/g, "").replace(/\s·\s*$/, "") ||
        `JLPT ${item.level || ""}`.trim(),
    };
  }

  async function ensureKoreanItems(items, onProgress, { examples = false, concurrency = 6 } = {}) {
    const result = items.slice();
    let cursor = 0;
    async function worker() {
      while (cursor < result.length) {
        const i = cursor++;
        if (!result[i].koMain || (examples && !result[i].examplesOk)) {
          result[i] = await ensureKoreanItem(result[i], { examples });
        }
        if (onProgress && (i % 12 === 0 || i === result.length - 1)) {
          onProgress(Math.min(i + 1, result.length), result.length);
        }
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(concurrency, result.length || 1) }, () =>
        worker()
      )
    );
    return result;
  }

  window.NihongoTranslate = {
    translateEnToKo,
    translateMany,
    ensureKoreanItem,
    ensureKoreanItems,
    looksKorean,
  };
})();
