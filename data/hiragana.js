/** 히라가나 오십음 (기본) — 행별 학습용 */
window.HIRAGANA_ROWS = [
  {
    id: "a",
    title: "あ행",
    tip: "입술을 크게 벌리고 내는 모음 소리예요.",
    chars: [
      { kana: "あ", romaji: "a", tip: "입을 크게 벌려 '아'" },
      { kana: "い", romaji: "i", tip: "입꼬리를 살짝 당겨 '이'" },
      { kana: "う", romaji: "u", tip: "입술을 둥글게 '우'" },
      { kana: "え", romaji: "e", tip: "입을 옆으로 열어 '에'" },
      { kana: "お", romaji: "o", tip: "입술을 동그랗게 '오'" },
    ],
  },
  {
    id: "ka",
    title: "か행",
    tip: "목구멍 쪽에서 살짝 걸리는 'ㅋ' 느낌이에요.",
    chars: [
      { kana: "か", romaji: "ka", tip: "가·카 사이 소리" },
      { kana: "き", romaji: "ki", tip: "기·키" },
      { kana: "く", romaji: "ku", tip: "구·쿠" },
      { kana: "け", romaji: "ke", tip: "게·케" },
      { kana: "こ", romaji: "ko", tip: "고·코" },
    ],
  },
  {
    id: "sa",
    title: "さ행",
    tip: "し는 '시'에 가깝게 발음해요.",
    chars: [
      { kana: "さ", romaji: "sa", tip: "사" },
      { kana: "し", romaji: "shi", tip: "시 (si가 아님)" },
      { kana: "す", romaji: "su", tip: "스" },
      { kana: "せ", romaji: "se", tip: "세" },
      { kana: "そ", romaji: "so", tip: "소" },
    ],
  },
  {
    id: "ta",
    title: "た행",
    tip: "ち는 '치', つ는 '쓰'에 가까워요.",
    chars: [
      { kana: "た", romaji: "ta", tip: "타" },
      { kana: "ち", romaji: "chi", tip: "치 (ti가 아님)" },
      { kana: "つ", romaji: "tsu", tip: "쓰 (tu가 아님)" },
      { kana: "て", romaji: "te", tip: "테" },
      { kana: "と", romaji: "to", tip: "토" },
    ],
  },
  {
    id: "na",
    title: "な행",
    tip: "코로 울리는 부드러운 'ㄴ' 소리예요.",
    chars: [
      { kana: "な", romaji: "na", tip: "나" },
      { kana: "に", romaji: "ni", tip: "니" },
      { kana: "ぬ", romaji: "nu", tip: "누" },
      { kana: "ね", romaji: "ne", tip: "네" },
      { kana: "の", romaji: "no", tip: "노" },
    ],
  },
  {
    id: "ha",
    title: "は행",
    tip: "ふ는 '후'에 가깝게, 입술 사이로 숨을 내쉬듯 발음해요.",
    chars: [
      { kana: "は", romaji: "ha", tip: "하 (조사로는 '와')" },
      { kana: "ひ", romaji: "hi", tip: "히" },
      { kana: "ふ", romaji: "fu", tip: "후 (hu가 아님)" },
      { kana: "へ", romaji: "he", tip: "헤 (조사로는 '에')" },
      { kana: "ほ", romaji: "ho", tip: "호" },
    ],
  },
  {
    id: "ma",
    title: "ま행",
    tip: "입술을 다았다 떼며 내는 'ㅁ' 소리예요.",
    chars: [
      { kana: "ま", romaji: "ma", tip: "마" },
      { kana: "み", romaji: "mi", tip: "미" },
      { kana: "む", romaji: "mu", tip: "무" },
      { kana: "め", romaji: "me", tip: "메" },
      { kana: "も", romaji: "mo", tip: "모" },
    ],
  },
  {
    id: "ya",
    title: "や행",
    tip: "や·ゆ·よ 세 글자만 있어요. (yi, ye는 없음)",
    chars: [
      { kana: "や", romaji: "ya", tip: "야" },
      { kana: "ゆ", romaji: "yu", tip: "유" },
      { kana: "よ", romaji: "yo", tip: "요" },
    ],
  },
  {
    id: "ra",
    title: "ら행",
    tip: "혀를 살짝 튕기듯 'ㄹ·ㄷ' 사이 소리예요.",
    chars: [
      { kana: "ら", romaji: "ra", tip: "라" },
      { kana: "り", romaji: "ri", tip: "리" },
      { kana: "る", romaji: "ru", tip: "루" },
      { kana: "れ", romaji: "re", tip: "레" },
      { kana: "ろ", romaji: "ro", tip: "로" },
    ],
  },
  {
    id: "wa",
    title: "わ행·ん",
    tip: "を는 보통 '오'로 읽고, ん은 홀로 있는 비음이에요.",
    chars: [
      { kana: "わ", romaji: "wa", tip: "와" },
      { kana: "を", romaji: "wo", tip: "오 (조사)" },
      { kana: "ん", romaji: "n", tip: "응·ㄴ 받침" },
    ],
  },
];

window.HIRAGANA_ALL = window.HIRAGANA_ROWS.flatMap((row) =>
  row.chars.map((c) => ({ ...c, rowId: row.id, rowTitle: row.title }))
);
