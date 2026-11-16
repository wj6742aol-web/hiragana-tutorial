(() => {
  const STORAGE_KEY = "nihongo-tutorial-progress";
  const app = document.getElementById("app");
  const progressChip = document.getElementById("progressChip");
  const navLearn = document.querySelector('.nav [data-nav="learn"]');
  const navQuiz = document.querySelector('.nav [data-nav="quiz"]');

  let progress = loadProgress();
  let view = { name: "home" };
  window.VOCAB_REMOTE = window.VOCAB_REMOTE || {};

  async function ensureRemote(t) {
    if (!t?.remoteLevel) return { ok: true, remote: false };
    const level = t.remoteLevel;
    // 정적 한국어 파일이 있으면 즉시 사용
    if (
      window.VOCAB_REMOTE[level]?.length &&
      (window.VOCAB_REMOTE[level][0]?.source === "openjlpt-static" ||
        window.VOCAB_REMOTE[level].every((it) => it.koMain))
    ) {
      return { ok: true, remote: true, count: window.VOCAB_REMOTE[level].length };
    }
    if (!window.NihongoAPI) {
      return { ok: false, remote: false, error: "API 모듈 없음" };
    }
    try {
      showLoading(`${t.title} 불러오는 중`, "단어 목록을 준비하는 중이에요…");
      const items = await window.NihongoAPI.localizeLevel(
        level,
        (done, total) => {
          showLoading(
            `${t.title} · 한국어 뜻 준비`,
            `${done} / ${total} … (정적 데이터가 없으면 최초 1회만)`
          );
        }
      );
      window.VOCAB_REMOTE[level] = items;
      return { ok: true, remote: true, count: items.length };
    } catch (err) {
      console.warn("OpenJLPT load failed", err);
      return {
        ok: false,
        remote: false,
        error: err?.message || "네트워크 오류",
      };
    }
  }

  function showLoading(title, detail) {
    app.innerHTML = `
      <section class="section">
        <div class="loading-panel">
          <div class="loading-spinner" aria-hidden="true"></div>
          <h2>${title}</h2>
          <p>${detail}</p>
        </div>
      </section>`;
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
      const legacy = localStorage.getItem("hiragana-tutorial-known");
      if (legacy) {
        const migrated = { hiragana: JSON.parse(legacy) };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
      return {};
    } catch {
      return {};
    }
  }

  function saveProgress() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    updateProgress();
  }

  function knownSet(tutorialId) {
    return new Set(progress[tutorialId] || []);
  }

  function markKnown(tutorialId, id) {
    const set = knownSet(tutorialId);
    set.add(id);
    progress[tutorialId] = [...set];
    saveProgress();
  }

  function toggleKnown(tutorialId, id) {
    const set = knownSet(tutorialId);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    progress[tutorialId] = [...set];
    saveProgress();
  }

  function tutorial() {
    return window.getTutorial(view.tutorialId);
  }

  function totalCount(t) {
    if (!t) return 0;
    if (t.kind === "kana") return t.getAll().length;
    return t.getItems().length;
  }

  function knownCount(t) {
    if (!t) return 0;
    return knownSet(t.id).size;
  }

  function updateProgress() {
    const t = tutorial();
    if (t) {
      progressChip.textContent = `${t.title} ${knownCount(t)} / ${totalCount(t)}`;
      return;
    }
    if (view.name === "group" && view.groupId) {
      const items = window.tutorialsInGroup(view.groupId);
      const done = items.reduce((n, x) => n + knownCount(x), 0);
      const all = items.reduce((n, x) => n + totalCount(x), 0);
      const g = window.getTutorialGroup(view.groupId);
      progressChip.textContent = `${g?.title || "분류"} ${done} / ${all}`;
      return;
    }
    const done = window.TUTORIALS.reduce((n, x) => n + knownCount(x), 0);
    const all = window.TUTORIALS.reduce((n, x) => n + totalCount(x), 0);
    progressChip.textContent = `전체 ${done} / ${all}`;
  }

  function setNav(active) {
    navLearn.hidden = !view.tutorialId;
    navQuiz.hidden = !view.tutorialId;
    document.querySelectorAll(".nav button").forEach((btn) => {
      btn.setAttribute(
        "aria-current",
        btn.dataset.nav === active ? "page" : "false"
      );
    });
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  let activeRec = null;
  let listenGen = 0;

  function go(next) {
    stopListen();
    view = next;
    render();
  }

  function escHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    u.rate = 0.85;
    const voices = window.speechSynthesis.getVoices();
    const ja = voices.find((v) => v.lang.startsWith("ja"));
    if (ja) u.voice = ja;
    window.speechSynthesis.speak(u);
  }

  function stopListen() {
    listenGen += 1;
    const rec = activeRec;
    activeRec = null;
    if (!rec) return;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    try {
      rec.abort();
    } catch (err) {
      try {
        rec.stop();
      } catch (err2) {
        /* already stopped */
      }
    }
  }

  function kataToHira(s) {
    return String(s || "").replace(/[\u30A1-\u30F6]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0x60)
    );
  }

  function normalizeJa(s) {
    return kataToHira(s)
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[\s\u3000]/g, "")
      .replace(/[、。！？!?.,'"「」『』（）()・~〜]/g, "");
  }

  function pronunciationHit(targets, heard) {
    const raw = String(heard || "").trim();
    if (!raw) return false;
    const h = normalizeJa(raw);
    const latin = !/[\u3040-\u30ff\u4e00-\u9fff]/.test(raw);
    return targets.some((t) => {
      if (!t) return false;
      const n = normalizeJa(t);
      if (!n || !h) return false;
      if (h === n) return true;
      if (n.length >= 2 && h.length >= 2 && (h.includes(n) || n.includes(h))) return true;
      if (latin && normalizeRomaji(t) && normalizeRomaji(t) === normalizeRomaji(raw)) return true;
      return false;
    });
  }

  function startPronounce(targets) {
    stopListen();
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      view.pron = {
        status: "unsupported",
        heard: "",
        note: "이 브라우저는 음성 인식을 지원하지 않아요. Chrome 또는 Edge에서 열어 주세요.",
      };
      render();
      return;
    }
    const gen = listenGen;
    const rec = new Ctor();
    activeRec = rec;
    rec.lang = "ja-JP";
    rec.interimResults = false;
    rec.maxAlternatives = 5;
    rec.continuous = false;
    let settled = false;
    const finish = (status, heard, note) => {
      if (settled || gen !== listenGen) return;
      settled = true;
      if (activeRec === rec) activeRec = null;
      view.pron = { status, heard, note };
      render();
    };
    rec.onresult = (ev) => {
      const alts = [];
      const res = ev.results && ev.results[0];
      if (res) {
        for (let i = 0; i < res.length; i += 1) alts.push(res[i].transcript);
      }
      const heard = alts[0] || "";
      const ok = alts.some((a) => pronunciationHit(targets, a));
      finish(
        ok ? "ok" : "miss",
        heard,
        ok ? "발음이 맞아요." : "조금 달랐어요. 다시 따라 말해 보세요."
      );
    };
    rec.onerror = (ev) => {
      const code = ev.error || "";
      if (code === "aborted") return;
      if (code === "not-allowed" || code === "service-not-allowed") {
        finish("error", "", "마이크 권한이 필요해요. 브라우저에서 허용해 주세요.");
        return;
      }
      if (code === "no-speech") {
        finish("miss", "", "소리가 들리지 않았어요. 다시 말해 보세요.");
        return;
      }
      if (code === "network") {
        finish(
          "error",
          "",
          "음성 인식 서버에 연결하지 못했어요. 인터넷이 되는 Chrome 또는 Edge에서 다시 시도해 주세요."
        );
        return;
      }
      finish("error", "", "음성 인식을 시작하지 못했어요. 다시 시도해 주세요.");
    };
    rec.onend = () => {
      if (!settled && gen === listenGen && view.pron?.status === "listening") {
        finish("miss", "", "인식이 끝났어요. 다시 말해 보세요.");
      }
    };
    view.pron = {
      status: "listening",
      heard: "",
      note: "지금 소리 내어 읽어 보세요.",
    };
    try {
      rec.start();
    } catch (err) {
      finish("error", "", "음성 인식을 시작하지 못했어요. 다시 시도해 주세요.");
      return;
    }
    render();
  }

  function pronouncePanel(hint) {
    const pron = view.pron || {
      status: "idle",
      heard: "",
      note: "모범 발음을 들은 뒤, 같은 소리로 따라 말해 보세요.",
    };
    const live = pron.status === "listening";
    const cls =
      pron.status === "ok"
        ? "ok"
        : pron.status === "miss" || pron.status === "error" || pron.status === "unsupported"
          ? "bad"
          : "";
    const heard = pron.heard
      ? `<p class="pron-heard">인식: ${escHtml(pron.heard)}</p>`
      : "";
    return `
      <div class="activity-panel">
        <p class="activity-prompt">화면에 나온 일본어를 소리 내어 읽어 보세요.</p>
        <p class="pron-target">목표: ${escHtml(hint)}</p>
        <div class="lesson-controls">
          <button type="button" class="btn btn-ghost" data-action="speak">모범 발음</button>
          <button type="button" class="btn btn-primary pron-mic${live ? " is-live" : ""}" data-action="pronounce"${
            pron.status === "unsupported" ? " disabled" : ""
          }>${live ? "듣는 중…" : "따라 말하기"}</button>
        </div>
        ${heard}
        <p class="recall-feedback ${cls}" id="pronFeedback">${escHtml(pron.note)}</p>
      </div>`;
  }

  function bindPronounce(targets) {
    const btn = app.querySelector('[data-action="pronounce"]');
    if (!btn) return;
    btn.onclick = () => {
      if (view.pron?.status === "listening") {
        stopListen();
        view.pron = {
          status: "idle",
          heard: "",
          note: "멈췄어요. 준비되면 다시 말해 보세요.",
        };
        render();
        return;
      }
      startPronounce(targets);
    };
  }

  function normalizeRomaji(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
  }

  async function render() {
    updateProgress();
    const name = view.name;
    if (name === "home") {
      setNav("home");
      await renderHome();
      return;
    }
    if (name === "group") {
      setNav("home");
      await renderGroup();
      return;
    }
    if (!tutorial()) {
      go({ name: "home" });
      return;
    }

    const t = tutorial();
    if (
      t.remoteLevel &&
      (name === "learn" || name === "quiz" || name === "phrase-lesson") &&
      !view.spotItem
    ) {
      const ready =
        window.VOCAB_REMOTE[t.remoteLevel]?.length &&
        window.VOCAB_REMOTE[t.remoteLevel].every((it) => it.koMain);
      if (!ready) {
        const result = await ensureRemote(t);
        if (!result.ok) {
          app.innerHTML = `
            <section class="section">
              <div class="result-panel">
                <h2>온라인 데이터를 못 불러왔어요</h2>
                <p>${result.error}. 로컬(한국어) 단어 세트로 이어갈게요.</p>
                <div class="cta-row" style="justify-content:center;">
                  <button type="button" class="btn btn-primary" data-action="cont">로컬로 계속</button>
                  <button type="button" class="btn btn-ghost" data-action="hub">홈</button>
                </div>
              </div>
            </section>`;
          app.querySelector('[data-action="cont"]').onclick = () => {
            view.forceLocal = true;
            renderLearnOrQuiz(name);
          };
          app.querySelector('[data-action="hub"]').onclick = () =>
            go({ name: "home" });
          return;
        }
        updateProgress();
      }
    }

    renderLearnOrQuiz(name);
  }

  function renderLearnOrQuiz(name) {
    setNav(name === "quiz" ? "quiz" : name === "home" ? "home" : "learn");
    if (name === "learn") renderLearn();
    else if (name === "lesson") renderLesson();
    else if (name === "row-drill") renderRowDrill();
    else if (name === "phrase-lesson") renderPhraseLesson();
    else if (name === "quiz") renderQuiz();
  }

  function tutorialCardHtml(t) {
    const known = knownCount(t);
    const total = totalCount(t);
    const pct = total ? Math.round((known / total) * 100) : 0;
    const remoteBadge = t.remoteLevel
      ? `<span class="api-badge">KO</span>`
      : "";
    return `
      <button type="button" class="tutorial-card" data-tutorial="${escHtml(t.id)}">
        <span class="tutorial-accent" aria-hidden="true">${escHtml(t.accent)}</span>
        <strong>${escHtml(t.title)}${remoteBadge}</strong>
        <span class="tutorial-blurb">${escHtml(t.blurb)}</span>
        <span class="tutorial-meta">${known} / ${total} · ${pct}%</span>
      </button>`;
  }

  function bindTutorialCards(root) {
    root.querySelectorAll("[data-tutorial]").forEach((btn) => {
      btn.onclick = () =>
        go({
          name: "learn",
          tutorialId: btn.dataset.tutorial,
          filter: "",
        });
    });
  }

  /* —— Home: large categories only —— */
  async function renderHome() {
    const cards = window.TUTORIAL_GROUPS.map((g) => {
      const items = window.tutorialsInGroup(g.id);
      const done = items.reduce((n, x) => n + knownCount(x), 0);
      const all = items.reduce((n, x) => n + totalCount(x), 0);
      const pct = all ? Math.round((done / all) * 100) : 0;
      return `
        <button type="button" class="category-card" data-group="${escHtml(g.id)}">
          <span class="tutorial-accent" aria-hidden="true">${escHtml(g.accent)}</span>
          <strong>${escHtml(g.title)}</strong>
          <span class="tutorial-blurb">${escHtml(g.blurb)}</span>
          <span class="tutorial-meta">${items.length}개 코스 · ${done} / ${all} · ${pct}%</span>
        </button>`;
    }).join("");

    app.innerHTML = `
      <section class="hero hub-hero">
        <div class="hero-art" aria-hidden="true">
          <span class="float-kana">あ</span>
          <span class="float-kana">ア</span>
          <span class="float-kana">語</span>
        </div>
        <div class="hero-copy hub-copy">
          <p class="hero-brand">일본어 튜토리얼</p>
          <h1>먼저 큰 주제를 고르세요</h1>
          <p>문자 · 기초 · 실생활 · JLPT 중 하나를 고른 뒤, 세부 코스로 들어갑니다.</p>
          <div class="category-grid hub-categories">${cards}</div>
          <p class="api-credit">${escHtml(window.NihongoAPI?.attribution || "")}</p>
        </div>
      </section>
    `;

    app.querySelectorAll("[data-group]").forEach((btn) => {
      btn.onclick = () => go({ name: "group", groupId: btn.dataset.group });
    });
  }

  /* —— Group: detailed tutorials —— */
  async function renderGroup() {
    const g = window.getTutorialGroup(view.groupId);
    if (!g) {
      go({ name: "home" });
      return;
    }
    const items = window.tutorialsInGroup(g.id);
    const showDaily = g.id === "daily" || g.id === "jlpt";

    app.innerHTML = `
      <section class="section group-section">
        <button type="button" class="back-link" data-action="back-home">← 학습 범위</button>
        <div class="section-head group-head">
          <p class="group-kicker" aria-hidden="true">${escHtml(g.accent)}</p>
          <h2>${escHtml(g.title)}</h2>
          <p>${escHtml(g.blurb)}</p>
        </div>
        ${
          showDaily
            ? `<div class="section-head">
                <h3 class="hub-group-title">오늘의 랜덤 단어</h3>
                <p id="dailyApiStatus">불러오는 중…</p>
              </div>
              <div class="daily-api-row" id="dailyApiRow"></div>`
            : ""
        }
        <div class="section-head" style="${showDaily ? "margin-top:1.75rem;" : ""}">
          <h3 class="hub-group-title">세부 코스</h3>
          <p>하나를 골라 배우기·퀴즈로 이어가 보세요.</p>
        </div>
        <div class="tutorial-grid">${items.map(tutorialCardHtml).join("")}</div>
      </section>
    `;

    app.querySelector('[data-action="back-home"]').onclick = () =>
      go({ name: "home" });
    bindTutorialCards(app);

    if (!showDaily) return;

    const row = app.querySelector("#dailyApiRow");
    const status = app.querySelector("#dailyApiStatus");
    try {
      if (!window.NihongoAPI) throw new Error("API 모듈 없음");
      const words = await window.NihongoAPI.randomWords(5, 6);
      status.textContent = "N5 랜덤 단어 · 탭하면 바로 학습";
      view._daily = words;
      paintDaily(row, words);
    } catch (err) {
      const pool = window.VOCAB_REMOTE?.n5 || [];
      if (pool.length) {
        const words = shuffle(pool).slice(0, 6);
        status.textContent = "N5 랜덤 단어 (로컬) · 탭하면 바로 학습";
        view._daily = words;
        paintDaily(row, words);
      } else {
        status.textContent = "랜덤 단어를 준비하지 못했어요.";
        row.innerHTML = "";
      }
    }
  }

  function paintDaily(row, words) {
    row.innerHTML = words
      .map(
        (w, i) => `
        <button type="button" class="daily-chip" data-daily="${i}">
          <strong>${w.jp}</strong>
          <span>${w.reading}</span>
          <em>${w.ko}</em>
        </button>`
      )
      .join("");
    row.querySelectorAll("[data-daily]").forEach((btn) => {
      btn.onclick = () => {
        const item = view._daily[Number(btn.dataset.daily)];
        if (!item) return;
        go({
          name: "phrase-lesson",
          tutorialId: "vocab-n5",
          index: 0,
          activity: "look",
          spotItem: item,
        });
      };
    });
  }

  /* —— Learn lists —— */
  function renderLearn() {
    const t = tutorial();
    if (t.kind === "kana") renderKanaLearn(t);
    else renderPhraseLearn(t);
  }

  function renderKanaLearn(t) {
    const rows = t.getRows();
    const known = knownSet(t.id);
    const cards = rows
      .map((row) => {
        const done = row.chars.every((c) => known.has(c.kana));
        const preview = row.chars.map((c) => c.kana).join("");
        return `
          <button type="button" class="row-btn${done ? " done" : ""}" data-row="${row.id}">
            <div class="kana-preview">${preview}</div>
            <strong>${row.title}</strong>
            <span>${row.chars.length}글자${done ? " · 완료" : ""}</span>
          </button>`;
      })
      .join("");

    app.innerHTML = `
      <section class="section">
        <div class="lesson-top">
          <button type="button" class="back-link" data-action="hub">← 튜토리얼 목록</button>
          <h2 style="margin:0;font-family:var(--font-display);">${t.title}</h2>
        </div>
        <div class="section-head">
          <h2>행 고르기</h2>
          <p>${t.blurb} 듣고·맞춰 보고·쓰며 익혀 보세요.</p>
        </div>
        <div class="row-grid">${cards}</div>
        <div class="cta-row" style="margin-top:1.5rem;">
          <button type="button" class="btn btn-primary" data-action="quiz">이 튜토리얼 퀴즈</button>
        </div>
      </section>
    `;

    app.querySelector('[data-action="hub"]').onclick = () =>
      go({ name: "home" });
    app.querySelector('[data-action="quiz"]').onclick = () =>
      go({ name: "quiz", tutorialId: t.id });
    app.querySelectorAll("[data-row]").forEach((btn) => {
      btn.onclick = () =>
        go({
          name: "lesson",
          tutorialId: t.id,
          rowId: btn.dataset.row,
          index: 0,
          activity: "look",
        });
    });
  }

  function renderPhraseLearn(t) {
    const items = t.getItems();
    const known = knownSet(t.id);
    const q = (view.filter || "").trim().toLowerCase();

    const indexed = items.map((item, i) => ({ item, i }));
    const filtered = q
      ? indexed.filter(({ item }) => {
          const hay = [item.jp, item.reading, item.romaji, item.ko, item.tip]
            .join(" ")
            .toLowerCase();
          return hay.includes(q);
        })
      : indexed;

    const list =
      filtered.length === 0
        ? `<p class="activity-prompt">검색 결과가 없어요.</p>`
        : filtered
            .map(
              ({ item, i }) => `
        <button type="button" class="phrase-row${
          known.has(item.id) ? " done" : ""
        }" data-index="${i}">
          <span class="phrase-jp">${item.jp}</span>
          <span class="phrase-ko">${item.ko}</span>
          <span class="phrase-mark">${known.has(item.id) ? "익힘" : "학습"}</span>
        </button>`
            )
            .join("");

    const isVocab = t.id.startsWith("vocab-");

    app.innerHTML = `
      <section class="section">
        <div class="lesson-top">
          <button type="button" class="back-link" data-action="hub">← 튜토리얼 목록</button>
          <h2 style="margin:0;font-family:var(--font-display);">${t.title}</h2>
        </div>
        <div class="section-head">
          <h2>${isVocab ? "단어 고르기" : "표현 고르기"}</h2>
          <p>
            ${t.blurb}
            (익힘 ${known.size} / ${items.length}
            ${
              t.remoteLevel && window.VOCAB_REMOTE[t.remoteLevel]
                ? " · <span class=\"api-badge\">OpenJLPT</span>"
                : ""
            })
          </p>
        </div>
        <div class="list-toolbar">
          <input
            type="search"
            class="recall-input list-search"
            id="listSearch"
            placeholder="일본어·읽기·뜻·로마자 검색"
            value="${(view.filter || "").replace(/"/g, "&quot;")}"
          />
          <span class="list-count">${filtered.length}개 표시</span>
        </div>
        <div class="phrase-list">${list}</div>
        <div class="cta-row" style="margin-top:1.5rem;">
          <button type="button" class="btn btn-primary" data-action="quiz">이 튜토리얼 퀴즈</button>
        </div>
      </section>
    `;

    app.querySelector('[data-action="hub"]').onclick = () =>
      go({ name: "home" });
    app.querySelector('[data-action="quiz"]').onclick = () =>
      go({ name: "quiz", tutorialId: t.id });

    const search = app.querySelector("#listSearch");
    let timer = null;
    search.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        view.filter = search.value;
        renderPhraseLearn(t);
        const again = document.getElementById("listSearch");
        if (again) {
          again.focus();
          const len = again.value.length;
          again.setSelectionRange(len, len);
        }
      }, 120);
    });

    app.querySelectorAll("[data-index]").forEach((btn) => {
      btn.onclick = () =>
        go({
          name: "phrase-lesson",
          tutorialId: t.id,
          index: Number(btn.dataset.index),
          activity: "look",
        });
    });
  }

  /* —— Kana lesson helpers —— */
  function distractorOptions(all, item, field, count = 3) {
    const pool = shuffle(
      all.filter((c) => c.kana !== item.kana).map((c) => c[field])
    );
    const uniq = [];
    for (const v of pool) {
      if (v !== item[field] && !uniq.includes(v)) uniq.push(v);
      if (uniq.length >= count) break;
    }
    return shuffle([item[field], ...uniq]);
  }

  function makeMiniQuestion(all, item) {
    const types = [
      "kana_to_romaji",
      "romaji_to_kana",
      "listen_to_kana",
      "type_romaji",
    ];
    const type = types[Math.floor(Math.random() * types.length)];
    if (type === "kana_to_romaji") {
      return {
        type,
        item,
        prompt: "이 글자의 로마자는?",
        correct: item.romaji,
        options: distractorOptions(all, item, "romaji"),
      };
    }
    if (type === "romaji_to_kana") {
      return {
        type,
        item,
        prompt: "이 로마자의 글자는?",
        correct: item.kana,
        options: distractorOptions(all, item, "kana"),
      };
    }
    if (type === "listen_to_kana") {
      return {
        type,
        item,
        prompt: "들은 소리의 글자는?",
        correct: item.kana,
        options: distractorOptions(all, item, "kana"),
        autoSpeak: true,
      };
    }
    return {
      type: "type_romaji",
      item,
      prompt: "로마자를 입력해 보세요.",
      correct: item.romaji,
    };
  }

  function renderLesson() {
    const t = tutorial();
    const rows = t.getRows();
    const all = t.getAll();
    const row = rows.find((r) => r.id === view.rowId);
    if (!row) {
      go({ name: "learn", tutorialId: t.id });
      return;
    }

    const index = Math.min(Math.max(view.index ?? 0, 0), row.chars.length - 1);
    view.index = index;
    if (view.activity === "recall") view.activity = "mini";
    if (!view.activity) view.activity = "look";
    if (!view.traceMode) view.traceMode = "guide";

    const ch = row.chars[index];
    const known = knownSet(t.id);
    const isKnown = known.has(ch.kana);
    const activity = view.activity;
    const blind = view.traceMode === "blind";

    if (activity === "mini") {
      const same =
        view.miniQ &&
        view.miniQ.item.kana === ch.kana &&
        view.miniForIndex === index;
      if (!same) {
        view.miniQ = makeMiniQuestion(all, ch);
        view.miniForIndex = index;
        view.miniLocked = false;
      }
    }

    const dots = row.chars
      .map(
        (c, i) => `
        <button type="button" class="dot${i === index ? " active" : ""}${
          known.has(c.kana) ? " known" : ""
        }" data-index="${i}">${c.kana}</button>`
      )
      .join("");

    const tabs = [
      ["look", "보고 듣기"],
      ["speak", "발음"],
      ["mini", "미니 퀴즈"],
      ["trace", "쓰기"],
    ]
      .map(
        ([id, label]) =>
          `<button type="button" class="mode-tab${
            activity === id ? " active" : ""
          }" data-mode="${id}">${label}</button>`
      )
      .join("");

    let activityBody = "";
    let focusInner = "";

    if (activity === "look") {
      focusInner = `
        <span class="big-kana">${ch.kana}</span>
        <button type="button" class="speak-fab" data-action="speak">♪</button>`;
      activityBody = `
        <div class="activity-panel">
          <p class="romaji">${ch.romaji}</p>
          <p>${ch.tip}</p>
          <div class="lesson-controls">
            <button type="button" class="btn btn-primary" data-action="speak">발음 듣기</button>
            <button type="button" class="btn btn-ghost" data-action="to-mini">미니 퀴즈</button>
          </div>
        </div>`;
    } else if (activity === "mini") {
      const q = view.miniQ;
      const typeLabel = {
        kana_to_romaji: "가나 → 로마자",
        romaji_to_kana: "로마자 → 가나",
        listen_to_kana: "듣기 → 가나",
        type_romaji: "직접 입력",
      }[q.type];

      if (q.type === "romaji_to_kana") {
        focusInner = `<span class="big-romaji">${q.item.romaji}</span>`;
      } else if (q.type === "listen_to_kana") {
        focusInner = `
          <button type="button" class="listen-big" data-action="speak">
            <span>♪</span><small>다시 듣기</small>
          </button>`;
      } else {
        focusInner = `<span class="big-kana">${q.item.kana}</span>`;
      }

      if (q.type === "type_romaji") {
        activityBody = `
          <div class="activity-panel">
            <p class="mini-type-tag">${typeLabel}</p>
            <p class="activity-prompt">${q.prompt}</p>
            <form class="recall-form" data-action="mini-type">
              <input id="romajiInput" class="recall-input" type="text" inputmode="latin"
                autocomplete="off" spellcheck="false" placeholder="로마자 입력" />
              <button type="submit" class="btn btn-primary">확인</button>
            </form>
            <p class="recall-feedback" id="miniFeedback"></p>
            <div class="lesson-controls">
              <button type="button" class="btn btn-ghost" data-action="new-mini">다른 방식</button>
              <button type="button" class="btn btn-ghost" data-action="speak">발음 듣기</button>
            </div>
          </div>`;
      } else {
        activityBody = `
          <div class="activity-panel">
            <p class="mini-type-tag">${typeLabel}</p>
            <p class="activity-prompt">${q.prompt}</p>
            <div class="choices mini-choices">${q.options
              .map(
                (opt) =>
                  `<button type="button" class="choice" data-choice="${opt}">${opt}</button>`
              )
              .join("")}</div>
            <p class="recall-feedback" id="miniFeedback"></p>
            <div class="lesson-controls">
              <button type="button" class="btn btn-ghost" data-action="new-mini">다른 방식</button>
              <button type="button" class="btn btn-ghost" data-action="speak">발음 듣기</button>
            </div>
          </div>`;
      }
    } else if (activity === "speak") {
      focusInner = `
        <span class="big-kana">${ch.kana}</span>
        <button type="button" class="speak-fab" data-action="speak">♪</button>`;
      activityBody = pronouncePanel(ch.romaji);
    } else {
      const showKana = !blind || view.peekOpen;
      focusInner = showKana
        ? `<span class="big-kana">${ch.kana}</span>
           <button type="button" class="speak-fab" data-action="speak">♪</button>`
        : `<span class="big-romaji dim">${ch.romaji}</span>
           <p class="blind-hint">형태를 떠올려 빈 칸에 써 보세요</p>`;
      activityBody = `
        <div class="activity-panel">
          <div class="sub-tabs">
            <button type="button" class="sub-tab${!blind ? " active" : ""}" data-trace="guide">따라 쓰기</button>
            <button type="button" class="sub-tab${blind ? " active" : ""}" data-trace="blind">안 보고 쓰기</button>
          </div>
          <p class="activity-prompt">${
            blind
              ? "가이드 없이 써 보세요. 잠깐 보기·정답 겹치기로 확인할 수 있어요."
              : "옅은 글자를 따라 써 보세요."
          }</p>
          <div class="trace-wrap">
            <canvas id="traceCanvas" width="280" height="280"></canvas>
          </div>
          <div class="lesson-controls">
            <button type="button" class="btn btn-ghost" data-action="clear-trace">지우기</button>
            ${
              blind
                ? `<button type="button" class="btn btn-ghost" data-action="peek">잠깐 보기</button>
                   <button type="button" class="btn btn-ghost" data-action="compare">정답 겹치기</button>`
                : ""
            }
            <button type="button" class="btn btn-primary" data-action="mark-traced">${
              blind ? "썼어요" : "따라 썼어요"
            }</button>
          </div>
          <p class="recall-feedback" id="traceFeedback"></p>
        </div>`;
    }

    app.innerHTML = `
      <section class="section">
        <div class="lesson-top">
          <button type="button" class="back-link" data-action="back">← 행 목록</button>
          <h2 style="margin:0;font-family:var(--font-display);">${t.title} · ${row.title}</h2>
          <span class="known-badge${isKnown ? "" : " muted"}">${
            isKnown ? "익힘" : "아직"
          }</span>
        </div>
        <p class="lesson-tip">${row.tip}</p>
        <div class="mode-tabs">${tabs}</div>
        <div class="char-stage">
          <div class="char-focus">${focusInner}</div>
          <div class="char-meta">
            <h3>${
              activity === "mini" && view.miniQ.type === "listen_to_kana"
                ? "？"
                : ch.kana
            }</h3>
            ${activityBody}
            <div class="lesson-controls nav-row">
              <button type="button" class="btn btn-ghost" data-action="prev" ${
                index === 0 ? "disabled" : ""
              }>이전</button>
              <button type="button" class="btn btn-ghost" data-action="next">
                ${index === row.chars.length - 1 ? "행 복습하기" : "다음 글자"}
              </button>
            </div>
          </div>
        </div>
        <div class="dot-rail">${dots}</div>
      </section>
    `;

    const switchChar = (i, opts = {}) =>
      go({
        name: "lesson",
        tutorialId: t.id,
        rowId: row.id,
        index: i,
        activity: opts.activity || activity,
        traceMode: opts.traceMode || view.traceMode || "guide",
      });

    const afterCorrect = () => {
      markKnown(t.id, ch.kana);
      setTimeout(() => {
        if (index >= row.chars.length - 1) {
          go({ name: "row-drill", tutorialId: t.id, rowId: row.id });
        } else switchChar(index + 1, { activity });
      }, 750);
    };

    app.querySelector('[data-action="back"]').onclick = () =>
      go({ name: "learn", tutorialId: t.id });
    app.querySelector('[data-action="prev"]').onclick = () =>
      switchChar(index - 1);
    app.querySelector('[data-action="next"]').onclick = () => {
      if (index >= row.chars.length - 1) {
        go({ name: "row-drill", tutorialId: t.id, rowId: row.id });
      } else switchChar(index + 1);
    };
    app.querySelectorAll("[data-mode]").forEach((tab) => {
      tab.onclick = () =>
        go({
          name: "lesson",
          tutorialId: t.id,
          rowId: row.id,
          index,
          activity: tab.dataset.mode,
          traceMode: view.traceMode || "guide",
        });
    });
    app.querySelectorAll('[data-action="speak"]').forEach((btn) => {
      btn.onclick = () => {
        if (activity === "speak" && view.pron?.status === "listening") {
          stopListen();
          view.pron = {
            status: "idle",
            heard: "",
            note: "모범 발음을 들어 보세요.",
          };
          render();
        }
        speak(ch.kana);
      };
    });
    if (activity === "speak") bindPronounce([ch.kana, ch.romaji]);
    const toMini = app.querySelector('[data-action="to-mini"]');
    if (toMini) {
      toMini.onclick = () =>
        go({
          name: "lesson",
          tutorialId: t.id,
          rowId: row.id,
          index,
          activity: "mini",
        });
    }

    if (activity === "mini") {
      const q = view.miniQ;
      const feedback = app.querySelector("#miniFeedback");
      if (q.autoSpeak) setTimeout(() => speak(ch.kana), 200);
      app.querySelector('[data-action="new-mini"]').onclick = () => {
        let next = makeMiniQuestion(all, ch);
        let g = 0;
        while (next.type === q.type && g < 6) {
          next = makeMiniQuestion(all, ch);
          g += 1;
        }
        view.miniQ = next;
        view.miniLocked = false;
        renderLesson();
      };
      const form = app.querySelector('[data-action="mini-type"]');
      if (form) {
        const input = form.querySelector("#romajiInput");
        setTimeout(() => input?.focus(), 50);
        form.onsubmit = (e) => {
          e.preventDefault();
          if (view.miniLocked) return;
          if (normalizeRomaji(input.value) === normalizeRomaji(q.correct)) {
            view.miniLocked = true;
            feedback.textContent = "정답!";
            feedback.className = "recall-feedback ok";
            speak(ch.kana);
            afterCorrect();
          } else {
            feedback.textContent = `힌트: ${q.correct.length}글자`;
            feedback.className = "recall-feedback bad";
            input.select();
          }
        };
      }
      app.querySelectorAll("[data-choice]").forEach((btn) => {
        btn.onclick = () => {
          if (view.miniLocked) return;
          view.miniLocked = true;
          const ok = btn.dataset.choice === q.correct;
          app.querySelectorAll(".choice").forEach((b) => {
            b.disabled = true;
            if (b.dataset.choice === q.correct) b.classList.add("correct");
            else if (b === btn && !ok) b.classList.add("wrong");
          });
          if (ok) {
            feedback.textContent = "정답!";
            feedback.className = "recall-feedback ok";
            speak(ch.kana);
            afterCorrect();
          } else {
            feedback.textContent = `정답은 ${q.correct}`;
            feedback.className = "recall-feedback bad";
            setTimeout(() => {
              view.miniLocked = false;
              view.miniQ = makeMiniQuestion(all, ch);
              renderLesson();
            }, 1000);
          }
        };
      });
    }

    if (activity === "trace") {
      const canvasApi = setupTraceCanvas(ch.kana, { showGuide: !blind });
      app.querySelectorAll("[data-trace]").forEach((btn) => {
        btn.onclick = () =>
          go({
            name: "lesson",
            tutorialId: t.id,
            rowId: row.id,
            index,
            activity: "trace",
            traceMode: btn.dataset.trace,
            peekOpen: false,
          });
      });
      app.querySelector('[data-action="clear-trace"]').onclick = () =>
        canvasApi.reset();
      const peekBtn = app.querySelector('[data-action="peek"]');
      if (peekBtn) {
        peekBtn.onclick = () => {
          view.peekOpen = true;
          renderLesson();
          setTimeout(() => {
            if (view.activity === "trace" && view.traceMode === "blind") {
              view.peekOpen = false;
              renderLesson();
            }
          }, 1200);
        };
      }
      const compareBtn = app.querySelector('[data-action="compare"]');
      if (compareBtn) {
        compareBtn.onclick = () => {
          canvasApi.showAnswerOverlay();
          const fb = app.querySelector("#traceFeedback");
          if (fb) {
            fb.textContent = "정답을 겹쳐 봤어요.";
            fb.className = "recall-feedback ok";
          }
        };
      }
      app.querySelector('[data-action="mark-traced"]').onclick = () =>
        afterCorrect();
    }

    app.querySelectorAll("[data-index]").forEach((dot) => {
      dot.onclick = () => switchChar(Number(dot.dataset.index));
    });
  }

  function setupTraceCanvas(kana, { showGuide = true } = {}) {
    const canvas = document.getElementById("traceCanvas");
    if (!canvas) return { reset() {}, showAnswerOverlay() {} };
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const size = 280;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const strokes = [];
    let current = null;

    function drawGrid() {
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = "rgba(20,33,43,0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(size / 2, 16);
      ctx.lineTo(size / 2, size - 16);
      ctx.moveTo(16, size / 2);
      ctx.lineTo(size - 16, size / 2);
      ctx.stroke();
    }
    function drawGuideGlyph(alpha = 0.18) {
      ctx.font = "800 170px 'M PLUS Rounded 1c', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = `rgba(14,74,82,${alpha})`;
      ctx.fillText(kana, size / 2, size / 2 + 8);
    }
    function redraw(extra = null) {
      drawGrid();
      if (showGuide) drawGuideGlyph(0.18);
      if (extra != null) drawGuideGlyph(extra);
      ctx.strokeStyle = "#0e4a52";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const stroke of strokes) {
        if (stroke.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i++) {
          ctx.lineTo(stroke[i].x, stroke[i].y);
        }
        ctx.stroke();
      }
    }
    redraw();

    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      const src = e.touches ? e.touches[0] : e;
      return {
        x: ((src.clientX - r.left) / r.width) * size,
        y: ((src.clientY - r.top) / r.height) * size,
      };
    };
    let drawing = false;
    canvas.onpointerdown = (e) => {
      e.preventDefault();
      drawing = true;
      const p = pos(e);
      current = [p];
      strokes.push(current);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.strokeStyle = "#0e4a52";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    };
    canvas.onpointermove = (e) => {
      if (!drawing || !current) return;
      e.preventDefault();
      const p = pos(e);
      current.push(p);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    };
    const end = () => {
      drawing = false;
      current = null;
    };
    canvas.onpointerup = end;
    canvas.onpointerleave = end;
    canvas.onpointercancel = end;

    return {
      reset() {
        strokes.length = 0;
        redraw();
      },
      showAnswerOverlay() {
        redraw(0.35);
      },
    };
  }

  function renderRowDrill() {
    const t = tutorial();
    const rows = t.getRows();
    const all = t.getAll();
    const row = rows.find((r) => r.id === view.rowId);
    if (!row) {
      go({ name: "learn", tutorialId: t.id });
      return;
    }
    if (!view.drill) {
      view.drill = shuffle(row.chars).map((item) => makeMiniQuestion(all, item));
      view.drillIndex = 0;
      view.drillScore = 0;
      view.drillLocked = false;
    }
    if (view.drillIndex >= view.drill.length) {
      app.innerHTML = `
        <section class="section">
          <div class="result-panel">
            <h2>${row.title} 복습 완료</h2>
            <p>${view.drill.length}문제 중 ${view.drillScore}개 맞춤</p>
            <div class="cta-row" style="justify-content:center;">
              <button type="button" class="btn btn-primary" data-action="again">다시 복습</button>
              <button type="button" class="btn btn-ghost" data-action="list">행 목록</button>
            </div>
          </div>
        </section>`;
      app.querySelector('[data-action="again"]').onclick = () =>
        go({ name: "row-drill", tutorialId: t.id, rowId: row.id });
      app.querySelector('[data-action="list"]').onclick = () =>
        go({ name: "learn", tutorialId: t.id });
      return;
    }

    const q = view.drill[view.drillIndex];
    const typeLabel = {
      kana_to_romaji: "가나 → 로마자",
      romaji_to_kana: "로마자 → 가나",
      listen_to_kana: "듣기 → 가나",
      type_romaji: "직접 입력",
    }[q.type];
    let promptHtml = `<span class="big-kana">${q.item.kana}</span>`;
    if (q.type === "romaji_to_kana")
      promptHtml = `<span class="big-romaji">${q.item.romaji}</span>`;
    if (q.type === "listen_to_kana")
      promptHtml = `<button type="button" class="listen-big" data-action="speak"><span>♪</span><small>다시 듣기</small></button>`;

    const answerArea =
      q.type === "type_romaji"
        ? `<form class="recall-form" data-action="drill-type" style="justify-content:center;">
            <input id="drillInput" class="recall-input" type="text" inputmode="latin" autocomplete="off" spellcheck="false" placeholder="로마자" />
            <button type="submit" class="btn btn-primary">확인</button>
          </form>`
        : `<div class="choices">${q.options
            .map(
              (opt) =>
                `<button type="button" class="choice" data-choice="${opt}">${opt}</button>`
            )
            .join("")}</div>`;

    app.innerHTML = `
      <section class="section">
        <div class="lesson-top">
          <button type="button" class="back-link" data-action="back">← 배우기</button>
          <h2 style="margin:0;font-family:var(--font-display);">${row.title} 미니 복습</h2>
        </div>
        <div class="quiz-board">
          <p class="quiz-score">${view.drillIndex + 1} / ${view.drill.length} · ${view.drillScore}점</p>
          <p class="mini-type-tag">${typeLabel}</p>
          <p class="activity-prompt">${q.prompt}</p>
          <div class="quiz-prompt">${promptHtml}</div>
          ${answerArea}
          <p class="quiz-status" id="drillStatus"></p>
          <div class="lesson-controls" style="justify-content:center;margin-top:1rem;">
            <button type="button" class="btn btn-ghost" data-action="speak">발음 듣기</button>
          </div>
        </div>
      </section>`;

    app.querySelector('[data-action="back"]').onclick = () =>
      go({
        name: "lesson",
        tutorialId: t.id,
        rowId: row.id,
        index: 0,
        activity: "look",
      });
    app.querySelectorAll('[data-action="speak"]').forEach((btn) => {
      btn.onclick = () => speak(q.item.kana);
    });
    if (q.autoSpeak) setTimeout(() => speak(q.item.kana), 200);

    const status = app.querySelector("#drillStatus");
    const finish = (ok) => {
      if (view.drillLocked) return;
      view.drillLocked = true;
      if (ok) {
        view.drillScore += 1;
        markKnown(t.id, q.item.kana);
        status.textContent = "정답!";
        status.style.color = "var(--sea-deep)";
        speak(q.item.kana);
      } else {
        status.textContent = `정답은 ${q.correct}`;
        status.style.color = "var(--coral-deep)";
      }
      setTimeout(() => {
        view.drillIndex += 1;
        view.drillLocked = false;
        renderRowDrill();
      }, 850);
    };

    const form = app.querySelector('[data-action="drill-type"]');
    if (form) {
      const input = form.querySelector("#drillInput");
      setTimeout(() => input?.focus(), 50);
      form.onsubmit = (e) => {
        e.preventDefault();
        finish(normalizeRomaji(input.value) === normalizeRomaji(q.correct));
      };
    }
    app.querySelectorAll("[data-choice]").forEach((btn) => {
      btn.onclick = () => {
        if (view.drillLocked) return;
        const ok = btn.dataset.choice === q.correct;
        app.querySelectorAll(".choice").forEach((b) => {
          b.disabled = true;
          if (b.dataset.choice === q.correct) b.classList.add("correct");
          else if (b === btn && !ok) b.classList.add("wrong");
        });
        finish(ok);
      };
    });
  }

  /* —— Phrase lessons —— */
  function makePhraseQuestion(items, item) {
    const types = ["jp_to_ko", "ko_to_jp", "listen_to_ko", "type_romaji"];
    const type = types[Math.floor(Math.random() * types.length)];
    const others = shuffle(items.filter((x) => x.id !== item.id)).slice(0, 3);
    if (type === "jp_to_ko") {
      return {
        type,
        item,
        prompt: "무슨 뜻일까요?",
        correct: item.ko,
        options: shuffle([item.ko, ...others.map((x) => x.ko)]),
      };
    }
    if (type === "ko_to_jp") {
      return {
        type,
        item,
        prompt: "일본어 표현은?",
        correct: item.jp,
        options: shuffle([item.jp, ...others.map((x) => x.jp)]),
      };
    }
    if (type === "listen_to_ko") {
      return {
        type,
        item,
        prompt: "들은 말의 뜻은?",
        correct: item.ko,
        options: shuffle([item.ko, ...others.map((x) => x.ko)]),
        autoSpeak: true,
      };
    }
    return {
      type: "type_romaji",
      item,
      prompt: "로마자를 입력해 보세요.",
      correct: item.romaji,
    };
  }

  function renderPhraseLesson() {
    const t = tutorial();
    const items = view.spotItem ? [view.spotItem] : t.getItems();
    if (!items.length) {
      go({ name: "learn", tutorialId: t.id });
      return;
    }
    const index = Math.min(Math.max(view.index ?? 0, 0), items.length - 1);
    view.index = index;
    if (!view.activity) view.activity = "look";
    const item = items[index];
    const known = knownSet(t.id);
    const isKnown = known.has(item.id);
    const activity = view.activity;

    // 정적 한국어 데이터가 아닐 때만 보강
    if (
      window.NihongoTranslate &&
      !view._enriching &&
      item.source !== "openjlpt-static" &&
      (!item.koMain ||
        (item.examples?.length && !item.examplesOk) ||
        (view.spotItem && !view.spotItem._enriched))
    ) {
      view._enriching = true;
      const run = view.spotItem && !view.spotItem._enriched && window.NihongoAPI
        ? window.NihongoAPI.enrichWithOpenJlpt(
            view.spotItem,
            t.remoteLevel || "n5"
          )
        : window.NihongoTranslate.ensureKoreanItem(item, { examples: true });

      run
        .then((enriched) => {
          const updated = { ...enriched, _enriched: true };
          if (view.spotItem) view.spotItem = updated;
          else if (t.remoteLevel && window.VOCAB_REMOTE[t.remoteLevel]) {
            const arr = window.VOCAB_REMOTE[t.remoteLevel];
            const j = arr.findIndex((x) => x.id === updated.id);
            if (j >= 0) arr[j] = updated;
          }
          view._enriching = false;
          renderPhraseLesson();
        })
        .catch(() => {
          view._enriching = false;
        });
    }

    if (activity === "mini") {
      const same =
        view.miniQ &&
        view.miniQ.item.id === item.id &&
        view.miniForIndex === index;
      if (!same) {
        view.miniQ = makePhraseQuestion(items, item);
        view.miniForIndex = index;
        view.miniLocked = false;
      }
    }

    const tabs = [
      ["look", "보고 듣기"],
      ["speak", "발음"],
      ["mini", "미니 퀴즈"],
    ]
      .map(
        ([id, label]) =>
          `<button type="button" class="mode-tab${
            activity === id ? " active" : ""
          }" data-mode="${id}">${label}</button>`
      )
      .join("");

    const examplesHtml =
      item.examples && item.examples.length
        ? `<div class="examples">
            <h4>예문</h4>
            ${item.examples
              .map(
                (ex) => `
              <figure class="example">
                <p class="example-ja">${ex.ja}</p>
                ${ex.ko ? `<p class="example-ko">${ex.ko}</p>` : ""}
                ${
                  ex.en && ex.en !== ex.ko
                    ? `<p class="example-en">${ex.en}</p>`
                    : ""
                }
                <button type="button" class="btn btn-ghost btn-tiny" data-speak-ex="${ex.ja.replace(/"/g, "&quot;")}">듣기</button>
              </figure>`
              )
              .join("")}
          </div>`
        : "";

    let body = "";
    let focus = `<span class="big-kana phrase-big">${item.jp}</span>
      <button type="button" class="speak-fab" data-action="speak">♪</button>`;

    if (activity === "look") {
      body = `
        <div class="activity-panel">
          <p class="romaji">${item.romaji}</p>
          <p class="meaning-label">뜻</p>
          <p class="phrase-meaning">${item.ko}</p>
          ${
            item.en && item.en !== item.ko
              ? `<p class="meaning-en">영문: ${item.en}</p>`
              : ""
          }
          <p>읽기: ${item.reading}</p>
          <p>${item.tip || ""}</p>
          ${examplesHtml}
          <div class="lesson-controls">
            <button type="button" class="btn btn-primary" data-action="speak">발음 듣기</button>
            <button type="button" class="btn btn-ghost" data-action="mark">${
              isKnown ? "익힘 취소" : "익혔어요"
            }</button>
            <button type="button" class="btn btn-ghost" data-action="to-mini">미니 퀴즈</button>
          </div>
        </div>`;
    } else if (activity === "speak") {
      body = pronouncePanel(item.reading || item.romaji || item.jp);
    } else {
      const q = view.miniQ;
      const typeLabel = {
        jp_to_ko: "일본어 → 뜻",
        ko_to_jp: "뜻 → 일본어",
        listen_to_ko: "듣기 → 뜻",
        type_romaji: "로마자 입력",
      }[q.type];
      if (q.type === "ko_to_jp") {
        focus = `<span class="big-romaji">${item.ko}</span>`;
      } else if (q.type === "listen_to_ko") {
        focus = `<button type="button" class="listen-big" data-action="speak"><span>♪</span><small>다시 듣기</small></button>`;
      }
      if (q.type === "type_romaji") {
        body = `
          <div class="activity-panel">
            <p class="mini-type-tag">${typeLabel}</p>
            <p class="activity-prompt">${q.prompt}</p>
            <form class="recall-form" data-action="mini-type">
              <input id="romajiInput" class="recall-input" type="text" inputmode="latin" autocomplete="off" spellcheck="false" placeholder="예: ${item.romaji}" />
              <button type="submit" class="btn btn-primary">확인</button>
            </form>
            <p class="recall-feedback" id="miniFeedback"></p>
            <div class="lesson-controls">
              <button type="button" class="btn btn-ghost" data-action="new-mini">다른 방식</button>
              <button type="button" class="btn btn-ghost" data-action="speak">발음 듣기</button>
            </div>
          </div>`;
      } else {
        body = `
          <div class="activity-panel">
            <p class="mini-type-tag">${typeLabel}</p>
            <p class="activity-prompt">${q.prompt}</p>
            <div class="choices mini-choices">${q.options
              .map(
                (opt) =>
                  `<button type="button" class="choice" data-choice="${opt}">${opt}</button>`
              )
              .join("")}</div>
            <p class="recall-feedback" id="miniFeedback"></p>
            <div class="lesson-controls">
              <button type="button" class="btn btn-ghost" data-action="new-mini">다른 방식</button>
              <button type="button" class="btn btn-ghost" data-action="speak">발음 듣기</button>
            </div>
          </div>`;
      }
    }

    app.innerHTML = `
      <section class="section">
        <div class="lesson-top">
          <button type="button" class="back-link" data-action="back">← 목록</button>
          <h2 style="margin:0;font-family:var(--font-display);">${t.title}</h2>
          <span class="known-badge${isKnown ? "" : " muted"}">${
            isKnown ? "익힘" : "아직"
          }</span>
        </div>
        <div class="mode-tabs">${tabs}</div>
        <div class="char-stage">
          <div class="char-focus">${focus}</div>
          <div class="char-meta">
            <h3>${item.jp}</h3>
            ${body}
            <div class="lesson-controls nav-row">
              <button type="button" class="btn btn-ghost" data-action="prev" ${
                index === 0 ? "disabled" : ""
              }>이전</button>
              <button type="button" class="btn btn-ghost" data-action="next">
                ${index === items.length - 1 ? "목록으로" : "다음"}
              </button>
            </div>
          </div>
        </div>
      </section>`;

    const switchItem = (i, opts = {}) =>
      go({
        name: "phrase-lesson",
        tutorialId: t.id,
        index: i,
        activity: opts.activity || activity,
      });

    app.querySelector('[data-action="back"]').onclick = () => {
      if (view.spotItem) go({ name: "home" });
      else go({ name: "learn", tutorialId: t.id });
    };
    app.querySelector('[data-action="prev"]').onclick = () =>
      switchItem(index - 1);
    app.querySelector('[data-action="next"]').onclick = () => {
      if (view.spotItem || index >= items.length - 1) {
        if (view.spotItem) go({ name: "home" });
        else go({ name: "learn", tutorialId: t.id });
      } else switchItem(index + 1);
    };
    app.querySelectorAll("[data-mode]").forEach((tab) => {
      tab.onclick = () =>
        go({
          name: "phrase-lesson",
          tutorialId: t.id,
          index,
          activity: tab.dataset.mode,
          spotItem: view.spotItem,
        });
    });
    app.querySelectorAll('[data-action="speak"]').forEach((btn) => {
      btn.onclick = () => {
        if (activity === "speak" && view.pron?.status === "listening") {
          stopListen();
          view.pron = {
            status: "idle",
            heard: "",
            note: "모범 발음을 들어 보세요.",
          };
          render();
        }
        speak(item.reading || item.jp);
      };
    });
    if (activity === "speak") {
      bindPronounce([item.jp, item.reading, item.romaji].filter(Boolean));
    }
    app.querySelectorAll("[data-speak-ex]").forEach((btn) => {
      btn.onclick = () => speak(btn.dataset.speakEx);
    });

    const markBtn = app.querySelector('[data-action="mark"]');
    if (markBtn) {
      markBtn.onclick = () => {
        toggleKnown(t.id, item.id);
        renderPhraseLesson();
      };
    }
    const toMini = app.querySelector('[data-action="to-mini"]');
    if (toMini) {
      toMini.onclick = () =>
        go({
          name: "phrase-lesson",
          tutorialId: t.id,
          index,
          activity: "mini",
          spotItem: view.spotItem,
        });
    }

    if (activity === "mini") {
      const q = view.miniQ;
      const feedback = app.querySelector("#miniFeedback");
      if (q.autoSpeak) setTimeout(() => speak(item.reading || item.jp), 200);
      app.querySelector('[data-action="new-mini"]').onclick = () => {
        let next = makePhraseQuestion(items, item);
        let g = 0;
        while (next.type === q.type && g < 6) {
          next = makePhraseQuestion(items, item);
          g += 1;
        }
        view.miniQ = next;
        view.miniLocked = false;
        renderPhraseLesson();
      };
      const afterOk = () => {
        markKnown(t.id, item.id);
        setTimeout(() => {
          if (index >= items.length - 1)
            go({ name: "learn", tutorialId: t.id });
          else switchItem(index + 1, { activity: "mini" });
        }, 750);
      };
      const form = app.querySelector('[data-action="mini-type"]');
      if (form) {
        const input = form.querySelector("#romajiInput");
        setTimeout(() => input?.focus(), 50);
        form.onsubmit = (e) => {
          e.preventDefault();
          if (view.miniLocked) return;
          const ok =
            normalizeRomaji(input.value) === normalizeRomaji(q.correct);
          if (ok) {
            view.miniLocked = true;
            feedback.textContent = "정답!";
            feedback.className = "recall-feedback ok";
            speak(item.reading || item.jp);
            afterOk();
          } else {
            feedback.textContent = "다시 시도해 보세요.";
            feedback.className = "recall-feedback bad";
            input.select();
          }
        };
      }
      app.querySelectorAll("[data-choice]").forEach((btn) => {
        btn.onclick = () => {
          if (view.miniLocked) return;
          view.miniLocked = true;
          const ok = btn.dataset.choice === q.correct;
          app.querySelectorAll(".choice").forEach((b) => {
            b.disabled = true;
            if (b.dataset.choice === q.correct) b.classList.add("correct");
            else if (b === btn && !ok) b.classList.add("wrong");
          });
          if (ok) {
            feedback.textContent = "정답!";
            feedback.className = "recall-feedback ok";
            speak(item.reading || item.jp);
            afterOk();
          } else {
            feedback.textContent = `정답: ${q.correct}`;
            feedback.className = "recall-feedback bad";
            setTimeout(() => {
              view.miniLocked = false;
              view.miniQ = makePhraseQuestion(items, item);
              renderPhraseLesson();
            }, 1000);
          }
        };
      });
    }
  }

  /* —— Quiz —— */
  function renderQuiz() {
    const t = tutorial();
    if (t.kind === "kana") renderKanaQuiz(t);
    else renderPhraseQuiz(t);
  }

  function renderKanaQuiz(t) {
    const all = t.getAll();
    if (!view.round) {
      view.round = shuffle(all)
        .slice(0, Math.min(10, all.length))
        .map((item) => makeMiniQuestion(all, item));
      view.qIndex = 0;
      view.score = 0;
      view.locked = false;
    }
    renderGenericQuiz(t, view.round, (itemId) => markKnown(t.id, itemId), (q) =>
      speak(q.item.kana)
    );
  }

  function renderPhraseQuiz(t) {
    const items = t.getItems();
    if (!view.round) {
      const n = items.length >= 80 ? 15 : Math.min(10, items.length);
      view.round = shuffle(items)
        .slice(0, n)
        .map((item) => makePhraseQuestion(items, item));
      view.qIndex = 0;
      view.score = 0;
      view.locked = false;
    }
    renderGenericQuiz(
      t,
      view.round,
      (itemId) => markKnown(t.id, itemId),
      (q) => speak(q.item.reading || q.item.jp),
      true
    );
  }

  function renderGenericQuiz(t, round, onCorrect, onSpeak, isPhrase = false) {
    if (view.qIndex >= round.length) {
      app.innerHTML = `
        <section class="section">
          <div class="result-panel">
            <h2>${t.title} 퀴즈 끝!</h2>
            <p>${round.length}문제 중 ${view.score}개 맞춤 · 익힘 ${knownCount(t)} / ${totalCount(t)}</p>
            <div class="cta-row" style="justify-content:center;">
              <button type="button" class="btn btn-primary" data-action="again">한 번 더</button>
              <button type="button" class="btn btn-ghost" data-action="learn">배우기로</button>
              <button type="button" class="btn btn-ghost" data-action="hub">홈</button>
            </div>
          </div>
        </section>`;
      app.querySelector('[data-action="again"]').onclick = () =>
        go({ name: "quiz", tutorialId: t.id });
      app.querySelector('[data-action="learn"]').onclick = () =>
        go({ name: "learn", tutorialId: t.id });
      app.querySelector('[data-action="hub"]').onclick = () =>
        go({ name: "home" });
      return;
    }

    const q = round[view.qIndex];
    const idKey = isPhrase ? q.item.id : q.item.kana;
    let promptHtml = isPhrase
      ? `<span class="big-kana phrase-big">${q.item.jp}</span>`
      : `<span class="big-kana">${q.item.kana}</span>`;

    if (!isPhrase) {
      if (q.type === "romaji_to_kana")
        promptHtml = `<span class="big-romaji">${q.item.romaji}</span>`;
      if (q.type === "listen_to_kana")
        promptHtml = `<button type="button" class="listen-big" data-action="speak"><span>♪</span><small>다시 듣기</small></button>`;
    } else {
      if (q.type === "ko_to_jp")
        promptHtml = `<span class="big-romaji">${q.item.ko}</span>`;
      if (q.type === "listen_to_ko")
        promptHtml = `<button type="button" class="listen-big" data-action="speak"><span>♪</span><small>다시 듣기</small></button>`;
    }

    const answerArea =
      q.type === "type_romaji"
        ? `<form class="recall-form" data-action="quiz-type" style="justify-content:center;">
            <input id="quizInput" class="recall-input" type="text" inputmode="latin" autocomplete="off" spellcheck="false" placeholder="로마자" />
            <button type="submit" class="btn btn-primary">확인</button>
          </form>`
        : `<div class="choices">${(q.options || [])
            .map(
              (opt) =>
                `<button type="button" class="choice" data-choice="${opt}">${opt}</button>`
            )
            .join("")}</div>`;

    app.innerHTML = `
      <section class="section">
        <div class="section-head" style="text-align:center;">
          <h2>${t.title} 퀴즈</h2>
          <p>${q.prompt}</p>
        </div>
        <div class="quiz-board">
          <p class="quiz-score">${view.qIndex + 1} / ${round.length} · ${view.score}점</p>
          <div class="quiz-prompt">${promptHtml}</div>
          ${answerArea}
          <p class="quiz-status" id="quizStatus"></p>
          <div class="lesson-controls" style="justify-content:center;margin-top:1rem;">
            <button type="button" class="btn btn-ghost" data-action="speak">발음 듣기</button>
          </div>
        </div>
      </section>`;

    app.querySelectorAll('[data-action="speak"]').forEach((btn) => {
      btn.onclick = () => onSpeak(q);
    });
    if (q.autoSpeak) setTimeout(() => onSpeak(q), 200);

    const status = app.querySelector("#quizStatus");
    const finish = (ok) => {
      if (view.locked) return;
      view.locked = true;
      if (ok) {
        view.score += 1;
        onCorrect(idKey);
        status.textContent = "정답!";
        status.style.color = "var(--sea-deep)";
        onSpeak(q);
      } else {
        status.textContent = `정답은 ${q.correct}`;
        status.style.color = "var(--coral-deep)";
      }
      setTimeout(() => {
        view.qIndex += 1;
        view.locked = false;
        renderQuiz();
      }, 900);
    };

    const form = app.querySelector('[data-action="quiz-type"]');
    if (form) {
      const input = form.querySelector("#quizInput");
      setTimeout(() => input?.focus(), 50);
      form.onsubmit = (e) => {
        e.preventDefault();
        finish(normalizeRomaji(input.value) === normalizeRomaji(q.correct));
      };
    }
    app.querySelectorAll("[data-choice]").forEach((btn) => {
      btn.onclick = () => {
        if (view.locked) return;
        const ok = btn.dataset.choice === q.correct;
        app.querySelectorAll(".choice").forEach((b) => {
          b.disabled = true;
          if (b.dataset.choice === q.correct) b.classList.add("correct");
          else if (b === btn && !ok) b.classList.add("wrong");
        });
        finish(ok);
      };
    });
  }

  document.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.nav;
      if (name === "home") go({ name: "home" });
      else if (name === "learn" && view.tutorialId)
        go({ name: "learn", tutorialId: view.tutorialId });
      else if (name === "quiz" && view.tutorialId)
        go({ name: "quiz", tutorialId: view.tutorialId });
    });
  });

  updateProgress();
  render();
})();
