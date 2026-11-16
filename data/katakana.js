/** 카타카나 오십음 (기본) */
window.KATAKANA_ROWS = [
  {
    id: "a",
    title: "ア행",
    tip: "외래어·강조에 자주 쓰이는 각진 글자예요.",
    chars: [
      { kana: "ア", romaji: "a", tip: "아" },
      { kana: "イ", romaji: "i", tip: "이" },
      { kana: "ウ", romaji: "u", tip: "우" },
      { kana: "エ", romaji: "e", tip: "에" },
      { kana: "オ", romaji: "o", tip: "오" },
    ],
  },
  {
    id: "ka",
    title: "カ행",
    tip: "히라가나 か행과 같은 소리예요.",
    chars: [
      { kana: "カ", romaji: "ka", tip: "카" },
      { kana: "キ", romaji: "ki", tip: "키" },
      { kana: "ク", romaji: "ku", tip: "쿠" },
      { kana: "ケ", romaji: "ke", tip: "케" },
      { kana: "コ", romaji: "ko", tip: "코" },
    ],
  },
  {
    id: "sa",
    title: "サ행",
    tip: "シ는 '시', ツ와 シ 형태를 헷갈리기 쉬워요.",
    chars: [
      { kana: "サ", romaji: "sa", tip: "사" },
      { kana: "シ", romaji: "shi", tip: "시" },
      { kana: "ス", romaji: "su", tip: "스" },
      { kana: "セ", romaji: "se", tip: "세" },
      { kana: "ソ", romaji: "so", tip: "소" },
    ],
  },
  {
    id: "ta",
    title: "タ행",
    tip: "ツ는 '쓰', チ는 '치'예요.",
    chars: [
      { kana: "タ", romaji: "ta", tip: "타" },
      { kana: "チ", romaji: "chi", tip: "치" },
      { kana: "ツ", romaji: "tsu", tip: "쓰" },
      { kana: "テ", romaji: "te", tip: "테" },
      { kana: "ト", romaji: "to", tip: "토" },
    ],
  },
  {
    id: "na",
    title: "ナ행",
    tip: "부드러운 나행 소리예요.",
    chars: [
      { kana: "ナ", romaji: "na", tip: "나" },
      { kana: "ニ", romaji: "ni", tip: "니" },
      { kana: "ヌ", romaji: "nu", tip: "누" },
      { kana: "ネ", romaji: "ne", tip: "네" },
      { kana: "ノ", romaji: "no", tip: "노" },
    ],
  },
  {
    id: "ha",
    title: "ハ행",
    tip: "フ는 '후'에 가깝게 발음해요.",
    chars: [
      { kana: "ハ", romaji: "ha", tip: "하" },
      { kana: "ヒ", romaji: "hi", tip: "히" },
      { kana: "フ", romaji: "fu", tip: "후" },
      { kana: "ヘ", romaji: "he", tip: "헤" },
      { kana: "ホ", romaji: "ho", tip: "호" },
    ],
  },
  {
    id: "ma",
    title: "マ행",
    tip: "마행은 입술을 다았다 떼며 내요.",
    chars: [
      { kana: "マ", romaji: "ma", tip: "마" },
      { kana: "ミ", romaji: "mi", tip: "미" },
      { kana: "ム", romaji: "mu", tip: "무" },
      { kana: "メ", romaji: "me", tip: "메" },
      { kana: "モ", romaji: "mo", tip: "모" },
    ],
  },
  {
    id: "ya",
    title: "ヤ행",
    tip: "ヤ·ユ·ヨ 세 글자예요.",
    chars: [
      { kana: "ヤ", romaji: "ya", tip: "야" },
      { kana: "ユ", romaji: "yu", tip: "유" },
      { kana: "ヨ", romaji: "yo", tip: "요" },
    ],
  },
  {
    id: "ra",
    title: "ラ행",
    tip: "혀를 살짝 튕기듯 내는 소리예요.",
    chars: [
      { kana: "ラ", romaji: "ra", tip: "라" },
      { kana: "リ", romaji: "ri", tip: "리" },
      { kana: "ル", romaji: "ru", tip: "루" },
      { kana: "レ", romaji: "re", tip: "레" },
      { kana: "ロ", romaji: "ro", tip: "로" },
    ],
  },
  {
    id: "wa",
    title: "ワ행·ン",
    tip: "ヲ는 보통 '오', ン은 비음이에요.",
    chars: [
      { kana: "ワ", romaji: "wa", tip: "와" },
      { kana: "ヲ", romaji: "wo", tip: "오" },
      { kana: "ン", romaji: "n", tip: "응" },
    ],
  },
];

window.KATAKANA_ALL = window.KATAKANA_ROWS.flatMap((row) =>
  row.chars.map((c) => ({ ...c, rowId: row.id, rowTitle: row.title }))
);
