import {
  countWords,
  exceedsCharacterLimit,
  TEXT_CHARACTER_LIMITS,
} from '../../common/text/text.util';

export const CHAT_WORD_LIMIT = 100;

export const WORD_LIMIT_EXCEEDED = 'WORD_LIMIT_EXCEEDED';
export const WORD_LIMIT_MESSAGE =
  'El mensaje no puede superar las 100 palabras.';

export const CHAT_CHAR_LIMIT_MESSAGE = `El mensaje no puede superar los ${TEXT_CHARACTER_LIMITS.chat} caracteres.`;

export type ChatPromptRejection = 'word_limit' | 'character_limit';

export function rejectChatPrompt(prompt: string): ChatPromptRejection | null {
  if (countWords(prompt) > CHAT_WORD_LIMIT) {
    return 'word_limit';
  }

  if (exceedsCharacterLimit(prompt, 'chat')) {
    return 'character_limit';
  }

  return null;
}
