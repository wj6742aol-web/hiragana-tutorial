/** OpenJLPT / JLPT Vocab API helpers (browser CORS OK) */
(function () {
  const OPENJLPT_CDN =
    "https://cdn.jsdelivr.net/gh/evanclan/OpenJLPT@main/data/json/vocab";
  const JLPT_API = "https://jlpt-vocab-api.vercel.app/api";
  const CACHE_PREFIX = "nihongo-openjlpt-ko-v1-";
  const memory = Object.create(null);

  function mapOpenItem(entry, level) {
    const meaningsEn = Array.isArray(entry.meanings)
      ? entry.meanings
      : entry.meaning
        ? [entry.meaning]
        : [];
    const en = meaningsEn.join("; ");
    const examples = (entry.examples || []).slice(0, 3).map((ex) => ({
      ja: ex.ja || "",
      en: ex.en || "",
      furigana: ex.furigana || "",
    }));
    return {
      id: `oj-${level}-${entry.id || entry.word}`,
      jp: entry.word || entry.expression || "",
      reading: entry.reading || entry.furigana || "",
      romaji: entry.romaji || "",
      en,
      meaningsEn,
      ko: en || "(뜻 없음)",
      tip: `JLPT ${String(level).toUpperCase()} · OpenJLPT`,
      meanings: meaningsEn,
      examples,
      source: "openjlpt",
      level: String(level).toUpperCase(),
      koMain: false,
    };
  }

  function mapApiItem(entry) {
    const en = entry.meaning || "";
    return {
      id: `jv-${entry.level}-${entry.word}-${entry.furigana}`,
      jp: entry.word,
      reading: entry.furigana || "",
      romaji: entry.romaji || "",
      en,
      meaningsEn: en ? [en] : [],
      ko: en || "(뜻 없음)",
      tip: `JLPT N${entry.level}`,
      meanings: en ? [en] : [],
      examples: [],
      source: "jlpt-api",
      level: `N${entry.level}`,
      koMain: false,
    };
  }

  async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function readLocalCache(level) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + level);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.items)) return null;
      // ~2 days
      if (Date.now() - (parsed.savedAt || 0) > 2 * 24 * 60 * 60 * 1000) {
        return null;
      }
      return parsed.items;
    } catch {
      return null;
    }
  }

  function writeLocalCache(level, items) {
    try {
      // Avoid blowing localStorage: skip if too large
      const payload = JSON.stringify({
        savedAt: Date.now(),
        items,
      });
      if (payload.length > 4_000_000) return;
      localStorage.setItem(CACHE_PREFIX + level, payload);
    } catch {
      /* quota */
    }
  }

  async function loadOpenJlptLevel(level) {
    const key = String(level).toLowerCase();
    // 정적 한국어 데이터가 이미 있으면 그걸 사용 (런타임 번역 없음)
    if (window.VOCAB_REMOTE?.[key]?.length) {
      const staticItems = window.VOCAB_REMOTE[key];
      if (staticItems[0]?.source === "openjlpt-static" || staticItems[0]?.koMain) {
        memory[key] = staticItems;
        return staticItems;
      }
    }
    if (memory[key]) return memory[key];

    const cached = readLocalCache(key);
    if (cached) {
      memory[key] = cached;
      return cached;
    }

    const data = await fetchJson(`${OPENJLPT_CDN}/${key}.json`);
    const items = (Array.isArray(data) ? data : []).map((e) =>
      mapOpenItem(e, key)
    );
    memory[key] = items;
    writeLocalCache(key, items);
    return items;
  }

  /** 정적 한국어 데이터면 그대로, 아니면(폴백) 번역 */
  async function localizeLevel(level, onProgress) {
    const key = String(level).toLowerCase();
    let items = memory[key] || (await loadOpenJlptLevel(key));
    if (items[0]?.source === "openjlpt-static" || items.every((it) => it.koMain)) {
      if (onProgress) onProgress(items.length, items.length);
      return items;
    }
    if (!window.NihongoTranslate) return items;

    const pending = items.filter((it) => !it.koMain).length;
    if (!pending) return items;

    items = await window.NihongoTranslate.ensureKoreanItems(items, onProgress, {
      examples: false,
      concurrency: 8,
    });
    memory[key] = items;
    writeLocalCache(key, items);
    return items;
  }

  async function loadJlptApiLevel(levelNum, limit = 500) {
    const key = `api-n${levelNum}`;
    if (memory[key]) return memory[key];
    const data = await fetchJson(
      `${JLPT_API}/words?level=${levelNum}&limit=${limit}`
    );
    const items = (data.words || []).map(mapApiItem);
    memory[key] = items;
    return items;
  }

  async function enrichWithOpenJlpt(item, level) {
    if (!item || !level) return item;
    try {
      const list = await loadOpenJlptLevel(level);
      const hit =
        list.find(
          (x) =>
            x.jp === item.jp ||
            (x.reading && item.reading && x.reading === item.reading)
        ) || null;
      let merged = item;
      if (hit) {
        merged = {
          ...item,
          en: hit.en || item.en,
          meaningsEn: hit.meaningsEn?.length ? hit.meaningsEn : item.meaningsEn,
          meanings: hit.meanings?.length ? hit.meanings : item.meanings,
          examples: hit.examples?.length ? hit.examples : item.examples || [],
          tip: item.tip || hit.tip,
          enriched: true,
          koMain: false,
        };
      }
      if (window.NihongoTranslate) {
        merged = await window.NihongoTranslate.ensureKoreanItem(merged);
      }
      return merged;
    } catch {
      if (window.NihongoTranslate) {
        return window.NihongoTranslate.ensureKoreanItem(item);
      }
      return item;
    }
  }

  async function randomWords(levelNum = 5, count = 5) {
    const tasks = Array.from({ length: count }, () =>
      fetchJson(`${JLPT_API}/words/random?level=${levelNum}`)
    );
    const rows = await Promise.all(tasks);
    let items = rows.map((data) => mapApiItem(data.word ? data : data));
    if (window.NihongoTranslate) {
      items = await Promise.all(
        items.map((it) => window.NihongoTranslate.ensureKoreanItem(it))
      );
    }
    return items;
  }

  window.NihongoAPI = {
    loadOpenJlptLevel,
    loadJlptApiLevel,
    localizeLevel,
    enrichWithOpenJlpt,
    randomWords,
    attribution:
      "단어·예문: OpenJLPT (CC BY-SA 4.0) · 한국어 뜻 사전 수록",
  };
})();
