/* ============================================================
   과목 카탈로그 — SOOM QUIZ
   ============================================================ */
const SUBJECTS = [
  {
    id: 'ir',
    name: '정보검색론',
    emoji: '🔎',
    examLine: '기말고사 · 6~12장',
    hasExamSwitch: false,
    primary: ['exam', 'learn'],
    aux: ['mcq', 'short', 'wrong'],
    exam: { mcq: 20, short: 10, minutes: 25 },
  },
  {
    id: 'mgmt',
    name: '도서관·정보센터 경영론',
    emoji: '📚',
    examLine: '객관식 20 + 단답 5 · 초록~시맨틱 웹',
    hasExamSwitch: false,
    primary: ['exam', 'learn'],
    aux: ['mcq', 'short', 'wrong'],
    exam: { mcq: 20, short: 5, minutes: 40 },
  },
];

const SUBJECT_BY_ID = Object.fromEntries(SUBJECTS.map(s => [s.id, s]));
