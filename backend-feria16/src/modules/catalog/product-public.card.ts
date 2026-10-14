import {
  EstadoDisponibilidad,
  Moneda,
  TipoProducto,
} from '../../common/enums/domain.enums';
import { Negocio } from '../businesses/entities/negocio.entity';
import { ProductoImagen } from '../products/entities/producto-imagen.entity';
import { ProductoServicio } from '../products/entities/producto-servicio.entity';

export interface PublicVendorCard {
  id: number;
  name: string;
  phone: string;
  sector: string;
  aisleNumber: string;
  latitude: number;
  longitude: number;
  whatsappUrl: string;
  googleMapsUrl: string;
}

export interface PublicProductCard {
  id: number;
  title: string;
  description: string | null;
  price: number;
  currency: Moneda;
  availabilityStatus: EstadoDisponibilidad;
  imageUrl: string | null;
  updatedAt: Date;
  vendor: PublicVendorCard;
}

export interface PublicProductDetail extends PublicProductCard {
  images: string[];
  type: TipoProducto;
}

export function whatsappInterestText(title: string): string {
  return `Hola, me interesa el producto ${title} que vi en Feria 16.`;
}

/** Se calcula al responder. No hay columna para esta URL. */
export function whatsappProductUrl(phone: string, title: string): string {
  const text = encodeURIComponent(whatsappInterestText(title));
  return `https://wa.me/591${phone}?text=${text}`;
}

/** Ocho decimales, la misma precisión de `latitud` y `longitud`. */
export function formatCoordinate(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error('Coordenada de puesto inválida.');
  }

  return numeric.toFixed(8);
}

/** Se calcula al responder. No hay columna para esta URL. */
export function googleMapsUrl(latitude: string, longitude: string): string {
  const query = `${formatCoordinate(latitude)},${formatCoordinate(longitude)}`;
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function orderedImageUrls(
  images: ProductoImagen[] | null | undefined,
): string[] {
  return [...(images ?? [])]
    .filter((image) => image != null && typeof image.imagen_url === 'string')
    .sort((left, right) => left.orden - right.orden || left.id - right.id)
    .map((image) => image.imagen_url);
}

export function toPublicProductCard(
  product: ProductoServicio,
): PublicProductCard {
  return toCard(product, orderedImageUrls(product.imagenes));
}

export function toPublicProductDetail(
  product: ProductoServicio,
): PublicProductDetail {
  const images = orderedImageUrls(product.imagenes);

  return {
    ...toCard(product, images),
    images,
    type: product.tipo,
  };
}

function toCard(
  product: ProductoServicio,
  images: string[],
): PublicProductCard {
  const vendor = requireVendor(product);

  return {
    id: product.id,
    title: product.titulo,
    description: product.descripcion,
    price: Number(product.precio),
    currency: product.moneda,
    availabilityStatus: product.estado_disponibilidad,
    imageUrl: images[0] ?? null,
    updatedAt: product.actualizado_en,
    vendor: {
      id: vendor.id,
      name: vendor.nombre,
      phone: vendor.whatsapp,
      sector: vendor.sector,
      aisleNumber: vendor.pasillo_puesto,
      latitude: Number(vendor.latitud),
      longitude: Number(vendor.longitud),
      whatsappUrl: whatsappProductUrl(vendor.whatsapp, product.titulo),
      googleMapsUrl: googleMapsUrl(vendor.latitud, vendor.longitud),
    },
  };
}

function requireVendor(product: ProductoServicio): Negocio {
  if (!product.negocio) {
    throw new Error('El producto público requiere el negocio asociado.');
  }

  return product.negocio;
}
