export const OUT_OF_CONTEXT = 'OUT_OF_CONTEXT';
export const OUT_OF_CONTEXT_MESSAGE =
  'Tu consulta no está relacionada con los productos o comercios de la Feria 16 de Julio. Por favor, intenta con otra búsqueda.';

const GREETING_ONLY =
  /^(hola|holi|hey|hi|hello|buenas|buen dia|buenos dias|buenas tardes|buenas noches|gracias|muchas gracias|ok|okay|vale|adios|chao|que tal|como estas|como esta|quien eres|que puedes hacer)$/;

const COMMERCE_CUE =
  /\b(busco|buscar|buscando|quiero|quisiera|necesito|necesitamos|compro|comprar|venden|vende|venta|precio|precios|cuesta|cuestan|puesto|puestos|local|negocio|negocios|producto|productos|servicio|servicios|feria|recomienda|recomendame|recomendacion|donde hay|donde encuentro|donde venden|tienda|comida|bebida|almuerzo|desayuno|cena)\b/;

const OFF_TOPIC =
  /\b(clima|pronostico|temperatura|lluvia|llover|capital de|presidente|politica|elecciones|horoscopo|chiste|broma|javascript|python|fotosintesis|ecuacion|derivada|integral|donde queda|donde esta|quien gano|tarea de)\b/;

const QUESTION_LIKE =
  /^(que |cual |cuales |quien |quienes |como |cuando |cuanto |cuantos |por que |explica |explicame |cuentame |escribeme |traduce |resuelve |dime |hablame |ayuda con |ayudame )/;

const STOPWORDS = new Set([
  'a',
  'al',
  'con',
  'de',
  'del',
  'e',
  'el',
  'en',
  'es',
  'la',
  'las',
  'le',
  'les',
  'lo',
  'los',
  'me',
  'mi',
  'nos',
  'o',
  'para',
  'por',
  'que',
  'se',
  'son',
  'su',
  'sus',
  'te',
  'tu',
  'un',
  'una',
  'unas',
  'unos',
  'y',
]);

export function isFairCommercePrompt(prompt: string): boolean {
  const normalized = normalizePrompt(prompt);
  if (normalized.length === 0 || GREETING_ONLY.test(normalized)) {
    return false;
  }

  if (COMMERCE_CUE.test(normalized)) {
    return true;
  }

  if (OFF_TOPIC.test(normalized) || QUESTION_LIKE.test(normalized)) {
    return false;
  }

  return hasMeaningfulToken(normalized);
}

function normalizePrompt(prompt: string): string {
  return prompt
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasMeaningfulToken(normalized: string): boolean {
  return normalized
    .split(' ')
    .some((token) => token.length >= 2 && !STOPWORDS.has(token));
}
