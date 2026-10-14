import { Moneda } from '../../common/enums/domain.enums';
import {
  assertProductSearch,
  planProductSearchText,
  ProductSearchError,
  SEARCH_CHAR_LIMIT,
  SEARCH_PRICE_RANGE,
  SEARCH_QUERY_REQUIRED,
  SEARCH_WORD_LIMIT,
  totalPages,
  type ProductSort,
} from './product-search.rules';

function rejection(input: Parameters<typeof assertProductSearch>[0]) {
  try {
    assertProductSearch(input);
  } catch (error) {
    expect(error).toBeInstanceOf(ProductSearchError);
    const searchError = error as ProductSearchError;
    return { field: searchError.field, message: searchError.message };
  }

  throw new Error('la búsqueda debía rechazarse');
}

describe('assertProductSearch', () => {
  it('exige un término, como máximo 30 palabras y 300 caracteres', () => {
    expect(rejection({})).toEqual({
      field: 'q',
      message: SEARCH_QUERY_REQUIRED,
    });
    expect(rejection({ q: '   ' }).message).toBe(SEARCH_QUERY_REQUIRED);

    expect(
      rejection({ q: Array.from({ length: 31 }, () => 'polo').join(' ') })
        .message,
    ).toBe(SEARCH_WORD_LIMIT);

    expect(rejection({ q: 'a'.repeat(301) }).message).toBe(SEARCH_CHAR_LIMIT);

    expect(
      assertProductSearch({
        q: Array.from({ length: 30 }, () => 'polo').join(' '),
      }).q,
    ).toContain('polo');
    expect(assertProductSearch({ q: 'a'.repeat(300) }).q).toHaveLength(300);
  });

  it('rechaza un mínimo mayor que el máximo y acepta un extremo suelto', () => {
    expect(rejection({ q: 'chamarra', price_min: 80, price_max: 10 })).toEqual({
      field: 'price_min',
      message: SEARCH_PRICE_RANGE,
    });

    expect(assertProductSearch({ q: 'chamarra', price_min: 0 }).priceMin).toBe(
      0,
    );
    expect(assertProductSearch({ q: 'chamarra', price_max: 25 }).priceMax).toBe(
      25,
    );
    expect(
      assertProductSearch({ q: 'chamarra', price_min: 10, price_max: 10 })
        .priceMin,
    ).toBe(10);
  });

  it('encierra el precio en una moneda y deja BOB y USD en relevancia o recientes', () => {
    const cases: Array<{
      sort: ProductSort;
      priceMin?: number;
      currency?: Moneda;
      expected: Moneda | null;
    }> = [
      { sort: 'PRICE_ASC', expected: Moneda.BOB },
      { sort: 'PRICE_DESC', currency: Moneda.USD, expected: Moneda.USD },
      { sort: 'RELEVANCE', priceMin: 0, expected: Moneda.BOB },
      {
        sort: 'NEWEST',
        priceMin: 15,
        currency: Moneda.USD,
        expected: Moneda.USD,
      },
      { sort: 'RELEVANCE', currency: Moneda.USD, expected: null },
      { sort: 'NEWEST', expected: null },
    ];

    for (const item of cases) {
      expect(
        assertProductSearch({
          q: 'ropa',
          sort_by: item.sort,
          price_min: item.priceMin,
          currency: item.currency,
        }).currency,
      ).toBe(item.expected);
    }
  });

  it('deja la página en 1, el límite en 10 y los días sin repetir', () => {
    const search = assertProductSearch({
      q: 'polo',
      days: ['DOMINGO', 'JUEVES', 'DOMINGO'],
    });

    expect(search.page).toBe(1);
    expect(search.limit).toBe(10);
    expect(search.days).toEqual(['DOMINGO', 'JUEVES']);
    expect(
      assertProductSearch({ q: 'polo', page: 3, limit: 50 }),
    ).toMatchObject({ page: 3, limit: 50, days: [] });
  });
});

describe('planProductSearchText', () => {
  it('manda a FULLTEXT los tokens de 3 o más caracteres y a LIKE los más cortos', () => {
    expect(planProductSearchText('chamarra de cuero')).toEqual({
      fulltextQuery: 'chamarra cuero',
      likePatterns: ['%de%'],
    });
    expect(planProductSearchText('tv')).toEqual({
      fulltextQuery: null,
      likePatterns: ['%tv%'],
    });
    expect(planProductSearchText('polo')).toEqual({
      fulltextQuery: 'polo',
      likePatterns: [],
    });
  });

  it('escapa los comodines de LIKE en los tokens cortos', () => {
    expect(planProductSearchText('a%')).toEqual({
      fulltextQuery: null,
      likePatterns: ['%a\\%%'],
    });
    expect(planProductSearchText('_')).toEqual({
      fulltextQuery: null,
      likePatterns: ['%\\_%'],
    });
  });
});

describe('totalPages', () => {
  it('calcula las páginas y deja 0 cuando no hay resultados', () => {
    expect(totalPages(12, 10)).toBe(2);
    expect(totalPages(10, 10)).toBe(1);
    expect(totalPages(0, 10)).toBe(0);
  });
});
