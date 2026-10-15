import {
  clipModelMessage,
  selectCitedVendors,
  toRecommendedVendors,
  type ChatCandidate,
} from './chat-recommendation.rules';

const CANDIDATES: ChatCandidate[] = [
  {
    id: 4,
    name: 'Kevin Motors',
    sector: 'Sector Rieles',
    logoUrl: null,
    description: null,
    productTitles: [],
  },
  {
    id: 8,
    name: 'Doña Rosa',
    sector: 'Sector Comida',
    logoUrl: 'https://cdn.example/rosa.png',
    description: 'Salteñas',
    productTitles: ['Salteña'],
  },
];

describe('selectCitedVendors', () => {
  const allowed = new Set([4, 8]);

  it('conserva el orden del modelo, descarta ids ajenos y duplicados, y respeta el tope', () => {
    expect(selectCitedVendors([8, 99, 8, 4, 4], allowed, 5)).toEqual([8, 4]);
    expect(selectCitedVendors([4, 8, 1], allowed, 1)).toEqual([4]);
    expect(selectCitedVendors([99, 100], allowed, 5)).toEqual([]);
    expect(selectCitedVendors([4.5, -1, 4], allowed, 5)).toEqual([4]);
    expect(selectCitedVendors([4], allowed, 0)).toEqual([]);
  });
});

describe('toRecommendedVendors', () => {
  it('rellena la ficha con la fila del puesto, no con el texto del modelo', () => {
    expect(toRecommendedVendors([8, 4], CANDIDATES)).toEqual([
      {
        id: 8,
        name: 'Doña Rosa',
        sector: 'Sector Comida',
        logoUrl: 'https://cdn.example/rosa.png',
      },
      {
        id: 4,
        name: 'Kevin Motors',
        sector: 'Sector Rieles',
        logoUrl: null,
      },
    ]);
  });
});

describe('clipModelMessage', () => {
  it('recorta el texto del modelo a 2000 caracteres', () => {
    expect(clipModelMessage('  hola  ')).toBe('hola');
    expect(clipModelMessage('   ')).toBe('');
    expect(clipModelMessage('a'.repeat(2001))).toHaveLength(2000);
  });
});
