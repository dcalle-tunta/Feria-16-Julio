export const TEXT_CHARACTER_LIMITS = {
  chat: 2000,
  search: 300,
} as const;

export type TextCharacterScope = keyof typeof TEXT_CHARACTER_LIMITS;

export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0).length;
}

export function exceedsCharacterLimit(
  text: string,
  scope: TextCharacterScope,
): boolean {
  return text.length > TEXT_CHARACTER_LIMITS[scope];
}
