import { isFairCommercePrompt } from './chat-context.rules';

describe('isFairCommercePrompt', () => {
  it('acepta búsquedas de productos, servicios y puestos', () => {
    expect(isFairCommercePrompt('busco una chamarra de cuero')).toBe(true);
    expect(isFairCommercePrompt('chamarra de cuero')).toBe(true);
    expect(isFairCommercePrompt('pizza')).toBe(true);
    expect(isFairCommercePrompt('tv')).toBe(true);
    expect(isFairCommercePrompt('necesito un plomero')).toBe(true);
    expect(isFairCommercePrompt('¿Dónde hay comida?')).toBe(true);
    expect(isFairCommercePrompt('cuánto cuesta una empanada')).toBe(true);
    expect(isFairCommercePrompt('puestos de mascotas')).toBe(true);
  });

  it('rechaza saludos, conocimiento general y texto vacío', () => {
    expect(isFairCommercePrompt('hola')).toBe(false);
    expect(isFairCommercePrompt('Buenos días')).toBe(false);
    expect(isFairCommercePrompt('¿cómo estás?')).toBe(false);
    expect(isFairCommercePrompt('cuál es la capital de Francia')).toBe(false);
    expect(isFairCommercePrompt('qué clima hace hoy')).toBe(false);
    expect(isFairCommercePrompt('cuéntame un chiste')).toBe(false);
    expect(isFairCommercePrompt('explica la fotosíntesis')).toBe(false);
    expect(isFairCommercePrompt('quién eres')).toBe(false);
    expect(isFairCommercePrompt('de la')).toBe(false);
    expect(isFairCommercePrompt('???')).toBe(false);
    expect(isFairCommercePrompt('   ')).toBe(false);
  });
});
