import type { ChatCandidate } from './chat-recommendation.rules';
import {
  buildModelMessages,
  parseModelRecommendation,
} from './chat-model.parse';

describe('parseModelRecommendation', () => {
  it('lee el JSON aunque venga entre marcas de código y acepta ids en texto', () => {
    expect(
      parseModelRecommendation(
        '```json\n{"out_of_context":false,"message":"Hay chamarras.","vendor_ids":[4,"8"]}\n```',
      ),
    ).toEqual({
      outOfContext: false,
      message: 'Hay chamarras.',
      vendorIds: [4, 8],
    });
  });

  it('marca fuera de contexto y descarta un cuerpo que no es JSON', () => {
    expect(
      parseModelRecommendation(
        '{"out_of_context":true,"message":"","vendor_ids":[]}',
      ),
    ).toEqual({
      outOfContext: true,
      message: '',
      vendorIds: [],
    });
    expect(parseModelRecommendation('no es json')).toBeNull();
  });
});

describe('buildModelMessages', () => {
  const candidates: ChatCandidate[] = [
    {
      id: 4,
      name: 'Kevin Motors',
      sector: 'Sector Rieles',
      logoUrl: null,
      description: 'Motos',
      productTitles: ['Casco'],
    },
  ];

  it('incluye solo los ids candidatos en el pedido al modelo', () => {
    const messages = buildModelMessages('busco un casco', candidates);
    const user = messages[1]?.content ?? '';

    expect(user).toContain('id 4');
    expect(user).toContain('Kevin Motors');
    expect(user).toContain('Casco');
    expect(user).not.toContain('id 99');
  });
});
