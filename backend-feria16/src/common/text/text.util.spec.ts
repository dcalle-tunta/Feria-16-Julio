import { exceedsCharacterLimit, countWords, TEXT_CHARACTER_LIMITS } from './text.util';

describe('countWords', () => {
  it('recorta, parte por espacios y descarta trozos vacíos', () => {
    expect(countWords('  busco   una chamarra  ')).toBe(3);
    expect(countWords('una\n\npalabra')).toBe(2);
    expect(countWords('   ')).toBe(0);
    expect(countWords('')).toBe(0);
  });
});

describe('exceedsCharacterLimit', () => {
  it('usa 2000 caracteres para el chat y 300 para la búsqueda', () => {
    expect(TEXT_CHARACTER_LIMITS.chat).toBe(2000);
    expect(TEXT_CHARACTER_LIMITS.search).toBe(300);
    expect(exceedsCharacterLimit('a'.repeat(2000), 'chat')).toBe(false);
    expect(exceedsCharacterLimit('a'.repeat(2001), 'chat')).toBe(true);
    expect(exceedsCharacterLimit('a'.repeat(300), 'search')).toBe(false);
    expect(exceedsCharacterLimit('a'.repeat(301), 'search')).toBe(true);
  });
});
