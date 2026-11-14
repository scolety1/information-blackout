export function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase()
    .replace(/[’'`]/gu, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

export function findPhraseOccurrences(text: string, phrase: string): number[] {
  const normalizedText = normalizeText(text);
  const normalizedPhrase = normalizeText(phrase);
  if (!normalizedPhrase) return [];

  const haystack = ` ${normalizedText} `;
  const needle = ` ${normalizedPhrase} `;
  const occurrences: number[] = [];
  let fromIndex = 0;

  while (fromIndex < haystack.length) {
    const index = haystack.indexOf(needle, fromIndex);
    if (index === -1) break;
    occurrences.push(Math.max(0, index));
    fromIndex = index + needle.length - 1;
  }

  return occurrences;
}
