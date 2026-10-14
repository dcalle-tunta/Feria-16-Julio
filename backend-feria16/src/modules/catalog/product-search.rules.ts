import {
  Moneda,
  type CodigoDiaAtencion,
} from '../../common/enums/domain.enums';
import {
  countWords,
  exceedsCharacterLimit,
  TEXT_CHARACTER_LIMITS,
} from '../../common/text/text.util';

export const PRODUCT_SORTS = [
  'RELEVANCE',
  'PRICE_ASC',
  'PRICE_DESC',
  'NEWEST',
] as const;

export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const SEARCH_QUERY_REQUIRED = 'Ingrese un término para buscar.';
export const SEARCH_WORD_LIMIT =
  'El texto de búsqueda no debe superar las 30 palabras.';
export const SEARCH_CHAR_LIMIT = `El texto de búsqueda no debe superar los ${TEXT_CHARACTER_LIMITS.search} caracteres.`;
export const SEARCH_PRICE_RANGE =
  'El precio mínimo no puede ser mayor al precio máximo.';

const SEARCH_WORD_LIMIT_COUNT = 30;

/** MySQL, con `innodb_ft_min_token_size` por defecto, no indexa tokens más cortos. */
export const FULLTEXT_MIN_TOKEN_LENGTH = 3;

export interface ProductSearchInput {
  q?: string;
  price_min?: number;
  price_max?: number;
  currency?: Moneda;
  days?: CodigoDiaAtencion[];
  sort_by?: ProductSort;
  page?: number;
  limit?: number;
}

export interface NormalizedProductSearch {
  q: string;
  priceMin?: number;
  priceMax?: number;
  currency: Moneda | null;
  days: CodigoDiaAtencion[];
  sortBy: ProductSort;
  page: number;
  limit: number;
}

export interface ProductSearchTextPlan {
  fulltextQuery: string | null;
  likePatterns: string[];
}

export class ProductSearchError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message);
  }
}

export function assertProductSearch(
  input: ProductSearchInput,
): NormalizedProductSearch {
  const q = typeof input.q === 'string' ? input.q.trim() : '';

  if (q.length === 0) {
    throw new ProductSearchError('q', SEARCH_QUERY_REQUIRED);
  }

  if (countWords(q) > SEARCH_WORD_LIMIT_COUNT) {
    throw new ProductSearchError('q', SEARCH_WORD_LIMIT);
  }

  if (exceedsCharacterLimit(q, 'search')) {
    throw new ProductSearchError('q', SEARCH_CHAR_LIMIT);
  }

  if (
    input.price_min !== undefined &&
    input.price_max !== undefined &&
    input.price_min > input.price_max
  ) {
    throw new ProductSearchError('price_min', SEARCH_PRICE_RANGE);
  }

  const sortBy = input.sort_by ?? 'RELEVANCE';

  return {
    q,
    priceMin: input.price_min,
    priceMax: input.price_max,
    currency: listedCurrency(sortBy, input),
    days: uniqueDays(input.days),
    sortBy,
    page: input.page ?? 1,
    limit: input.limit ?? 10,
  };
}

export function planProductSearchText(q: string): ProductSearchTextPlan {
  const longTokens: string[] = [];
  const likePatterns: string[] = [];

  for (const token of q.trim().split(/\s+/)) {
    if (token.length === 0) {
      continue;
    }

    if (token.length >= FULLTEXT_MIN_TOKEN_LENGTH) {
      longTokens.push(token);
      continue;
    }

    likePatterns.push(`%${escapeLike(token)}%`);
  }

  return {
    fulltextQuery: longTokens.length > 0 ? longTokens.join(' ') : null,
    likePatterns,
  };
}

export function totalPages(totalResults: number, limit: number): number {
  if (totalResults <= 0) {
    return 0;
  }

  return Math.ceil(totalResults / limit);
}

function uniqueDays(days?: CodigoDiaAtencion[]): CodigoDiaAtencion[] {
  if (!days || days.length === 0) {
    return [];
  }

  return [...new Set(days)];
}

function escapeLike(token: string): string {
  return token.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function listedCurrency(
  sortBy: ProductSort,
  input: Pick<ProductSearchInput, 'price_min' | 'price_max' | 'currency'>,
): Moneda | null {
  const hasPriceFilter =
    input.price_min !== undefined || input.price_max !== undefined;
  const ordersByPrice = sortBy === 'PRICE_ASC' || sortBy === 'PRICE_DESC';

  if (!hasPriceFilter && !ordersByPrice) {
    return null;
  }

  return input.currency ?? Moneda.BOB;
}
