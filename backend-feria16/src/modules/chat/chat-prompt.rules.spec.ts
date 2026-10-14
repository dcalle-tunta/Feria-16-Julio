import { rejectChatPrompt } from './chat-prompt.rules';

function words(count: number): string {
  return Array.from({ length: count }, (_, index) => `palabra${index}`).join(
    ' ',
  );
}

describe('rejectChatPrompt', () => {
  it('acepta hasta 100 palabras y 2000 caracteres', () => {
    expect(rejectChatPrompt(words(100))).toBeNull();
    expect(rejectChatPrompt('a'.repeat(2000))).toBeNull();
    expect(rejectChatPrompt('  busco   una chamarra  ')).toBeNull();
  });

  it('rechaza más de 100 palabras antes que el tope de caracteres', () => {
    expect(rejectChatPrompt(words(101))).toBe('word_limit');
    expect(rejectChatPrompt(`${words(101)} ${'a'.repeat(2000)}`)).toBe(
      'word_limit',
    );
  });

  it('rechaza más de 2000 caracteres cuando el texto cabe en 100 palabras', () => {
    expect(rejectChatPrompt('a'.repeat(2001))).toBe('character_limit');
  });
});
