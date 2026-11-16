/** 홈 대분류 → 세부 튜토리얼 */
window.TUTORIAL_GROUPS = [
  {
    id: "kana",
    title: "문자",
    accent: "あ",
    blurb: "히라가나·카타카나 기본 음절을 행별로 익혀요.",
  },
  {
    id: "basics",
    title: "기초",
    accent: "礼",
    blurb: "인사·생활 표현과 숫자 읽기부터 시작해요.",
  },
  {
    id: "daily",
    title: "실생활",
    accent: "生",
    blurb: "집·음식·교통 등 일상에서 바로 쓰는 단어.",
  },
  {
    id: "jlpt",
    title: "JLPT",
    accent: "N",
    blurb: "N5부터 N1까지 수준별·누적 단어 세트.",
  },
];

/** 일본어 튜토리얼 허브 목록 */
window.TUTORIALS = [
  {
    id: "hiragana",
    title: "히라가나",
    kind: "kana",
    group: "문자",
    groupId: "kana",
    accent: "あ",
    blurb: "일본어의 기본 음절 문자. 행마다 익히고 퀴즈로 확인해요.",
    getRows: () => window.HIRAGANA_ROWS,
    getAll: () => window.HIRAGANA_ALL,
  },
  {
    id: "katakana",
    title: "카타카나",
    kind: "kana",
    group: "문자",
    groupId: "kana",
    accent: "ア",
    blurb: "외래어·브랜드명에 많이 쓰는 각진 문자예요.",
    getRows: () => window.KATAKANA_ROWS,
    getAll: () => window.KATAKANA_ALL,
  },
  {
    id: "greetings",
    title: "인사·생활",
    kind: "phrases",
    group: "기초",
    groupId: "basics",
    accent: "礼",
    blurb: "아침 인사부터 식사 예절까지, 바로 쓰는 표현.",
    getItems: () => window.GREETING_ITEMS,
  },
  {
    id: "numbers",
    title: "숫자 1–10",
    kind: "phrases",
    group: "기초",
    groupId: "basics",
    accent: "数",
    blurb: "기본 숫자 읽기와 뜻 연결하기.",
    getItems: () => window.NUMBER_ITEMS,
  },
  {
    id: "vocab-daily",
    title: "실생활 단어",
    kind: "phrases",
    group: "실생활",
    groupId: "daily",
    accent: "生",
    blurb: "집·음식·쇼핑·교통·날씨 등 일상에서 바로 쓰는 단어 250개.",
    getItems: () => window.VOCAB_DAILY,
  },
  {
    id: "vocab-n5",
    title: "JLPT N5 단어",
    kind: "phrases",
    group: "JLPT 단어",
    groupId: "jlpt",
    accent: "N5",
    blurb: "N5 약 970단어 (목표 ~800). 한국어 뜻 포함.",
    remoteLevel: "n5",
    getItems: () => window.VOCAB_REMOTE?.n5 || window.VOCAB_N5,
  },
  {
    id: "vocab-n4",
    title: "JLPT N4 단어",
    kind: "phrases",
    group: "JLPT 단어",
    groupId: "jlpt",
    accent: "N4",
    blurb: "N5+N4 누적 약 1,900단어 (목표 ~1,500).",
    remoteLevel: "n4",
    getItems: () => window.VOCAB_REMOTE?.n4 || window.VOCAB_N4,
  },
  {
    id: "vocab-n3",
    title: "JLPT N3 단어",
    kind: "phrases",
    group: "JLPT 단어",
    groupId: "jlpt",
    accent: "N3",
    blurb: "N5~N3 누적 약 4,400단어 (목표 2,000~3,000+).",
    remoteLevel: "n3",
    getItems: () => window.VOCAB_REMOTE?.n3 || window.VOCAB_N3,
  },
  {
    id: "vocab-n2",
    title: "JLPT N2 단어",
    kind: "phrases",
    group: "JLPT 단어",
    groupId: "jlpt",
    accent: "N2",
    blurb: "N5~N2 누적 약 6,600단어 (목표 ~6,000).",
    remoteLevel: "n2",
    getItems: () => window.VOCAB_REMOTE?.n2 || window.VOCAB_N2,
  },
  {
    id: "vocab-n1",
    title: "JLPT N1 단어",
    kind: "phrases",
    group: "JLPT 단어",
    groupId: "jlpt",
    accent: "N1",
    blurb: "N5~N1 누적 약 10,500단어 (목표 ~10,000).",
    remoteLevel: "n1",
    getItems: () => window.VOCAB_REMOTE?.n1 || window.VOCAB_N1,
  },
];

window.getTutorial = (id) =>
  window.TUTORIALS.find((t) => t.id === id) || null;

window.getTutorialGroup = (id) =>
  window.TUTORIAL_GROUPS.find((g) => g.id === id) || null;

window.tutorialsInGroup = (groupId) =>
  window.TUTORIALS.filter((t) => t.groupId === groupId);
