const BAD_WORDS = [
  "amk", "aq", "orospu", "piç", "siktir", "sikeyim", "yarrak", "mal", "salak",
  "fuck", "shit", "bitch", "asshole", "damn",
];

export function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase();
  return BAD_WORDS.some((w) => lower.includes(w));
}

export function filterProfanity(text: string): string {
  let out = text;
  for (const w of BAD_WORDS) {
    const re = new RegExp(w, "gi");
    out = out.replace(re, "*".repeat(w.length));
  }
  return out;
}
