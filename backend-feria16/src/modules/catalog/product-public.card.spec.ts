import {
  EstadoDisponibilidad,
  Moneda,
  TipoProducto,
} from '../../common/enums/domain.enums';
import { ProductoServicio } from '../products/entities/producto-servicio.entity';
import {
  googleMapsUrl,
  orderedImageUrls,
  toPublicProductCard,
  toPublicProductDetail,
  whatsappProductUrl,
} from './product-public.card';

const WHATSAPP_URL =
  'https://wa.me/59171234567?text=Hola%2C%20me%20interesa%20el%20producto%20Chamarra%20de%20cuero%20que%20vi%20en%20Feria%2016.';
const MAPS_URL =
  'https://www.google.com/maps/search/?api=1&query=-16.50000000,-68.15000000';

function sampleProduct(): ProductoServicio {
  return {
    id: 15,
    titulo: 'Chamarra de cuero',
    descripcion: 'Talle único, cuero vacuno.',
    precio: '150.00',
    moneda: Moneda.BOB,
    tipo: TipoProducto.PRODUCTO,
    estado_disponibilidad: EstadoDisponibilidad.DISPONIBLE,
    actualizado_en: new Date('2026-10-01T12:00:00.000Z'),
    imagenes: [
      { id: 2, imagen_url: 'https://cdn.example/dos.jpg', orden: 2 },
      { id: 1, imagen_url: 'https://cdn.example/uno.jpg', orden: 1 },
    ],
    negocio: {
      id: 3,
      nombre: 'Puesto de Doña Juana',
      whatsapp: '71234567',
      sector: 'Sector Rieles',
      pasillo_puesto: 'Pasillo 4, Puesto 12',
      latitud: '-16.50000000',
      longitud: '-68.15000000',
    },
  } as ProductoServicio;
}

describe('ficha pública del producto', () => {
  it('arma WhatsApp y Maps sin persistirlas, con el teléfono de 8 dígitos', () => {
    expect(whatsappProductUrl('71234567', 'Chamarra de cuero')).toBe(
      WHATSAPP_URL,
    );
    expect(googleMapsUrl('-16.50000000', '-68.15000000')).toBe(MAPS_URL);
    expect(whatsappProductUrl('71234567', 'Pan & café')).toContain(
      'Pan%20%26%20caf%C3%A9',
    );

    const card = toPublicProductCard(sampleProduct());

    expect(card.vendor.phone).toBe('71234567');
    expect(card.vendor.whatsappUrl).toBe(WHATSAPP_URL);
    expect(card.vendor.googleMapsUrl).toBe(MAPS_URL);
    expect(card.vendor.latitude).toBe(-16.5);
    expect(card.vendor.longitude).toBe(-68.15);
    expect(card.vendor.aisleNumber).toBe('Pasillo 4, Puesto 12');
    expect(card.price).toBe(150);
  });

  it('usa la imagen de menor orden y null cuando no hay galería', () => {
    expect(orderedImageUrls(sampleProduct().imagenes)).toEqual([
      'https://cdn.example/uno.jpg',
      'https://cdn.example/dos.jpg',
    ]);
    expect(toPublicProductCard(sampleProduct()).imageUrl).toBe(
      'https://cdn.example/uno.jpg',
    );

    const empty = sampleProduct();
    empty.imagenes = [];
    expect(toPublicProductCard(empty).imageUrl).toBeNull();
  });

  it('agrega la galería ordenada y el tipo solo en el detalle', () => {
    const detail = toPublicProductDetail(sampleProduct());

    expect(detail.images).toEqual([
      'https://cdn.example/uno.jpg',
      'https://cdn.example/dos.jpg',
    ]);
    expect(detail.imageUrl).toBe(detail.images[0]);
    expect(detail.type).toBe(TipoProducto.PRODUCTO);
    expect(toPublicProductCard(sampleProduct())).not.toHaveProperty('images');
    expect(toPublicProductCard(sampleProduct())).not.toHaveProperty('type');
  });
});
