import {
  EstadoDisponibilidad,
  EstadoNegocio,
  Moneda,
  TipoProducto,
} from '../../common/enums/domain.enums';
import type { ApiFieldError } from '../../common/http/api-error.response';
import { orderedImageUrls } from '../catalog/product-public.card';
import { Negocio } from '../businesses/entities/negocio.entity';
import { ProductoServicio } from '../products/entities/producto-servicio.entity';

export const CURRENT_PASSWORD_REQUIRED = 'Debes ingresar la contraseña actual.';
export const NEW_PASSWORD_REQUIRED = 'Debes ingresar la nueva contraseña.';
export const CURRENT_PASSWORD_MISMATCH = 'La contraseña actual no es correcta.';

export interface VendorOpeningDay {
  code: string;
  name: string;
}

export interface VendorCategory {
  id: number;
  name: string;
  slug: string;
}

export interface VendorProfile {
  id: number;
  name: string;
  category: VendorCategory;
  shortDescription: string | null;
  logoUrl: string | null;
  phone: string;
  email: string | null;
  sector: string;
  aisleNumber: string;
  latitude: number;
  longitude: number;
  openingDays: VendorOpeningDay[];
  status: EstadoNegocio;
}

export interface VendorProductItem {
  id: number;
  title: string;
  description: string | null;
  price: number;
  currency: Moneda;
  type: TipoProducto;
  availabilityStatus: EstadoDisponibilidad;
  active: boolean;
  imageUrl: string | null;
  images: string[];
  createdAt: Date;
  updatedAt: Date;
}

export function passwordChangeFieldErrors(dto: {
  current_password?: string;
  new_password?: string;
}): ApiFieldError[] {
  const hasCurrent = dto.current_password !== undefined;
  const hasNew = dto.new_password !== undefined;
  if (hasCurrent === hasNew) {
    return [];
  }

  if (!hasCurrent) {
    return [{ field: 'current_password', message: CURRENT_PASSWORD_REQUIRED }];
  }

  return [{ field: 'new_password', message: NEW_PASSWORD_REQUIRED }];
}

export function toVendorProfile(negocio: Negocio): VendorProfile {
  if (!negocio.categoria) {
    throw new Error('El perfil del comerciante requiere la categoría.');
  }

  const openingDays = [...(negocio.dias_atencion ?? [])]
    .flatMap((row) =>
      row.dia
        ? [{ id: row.dia.id, code: row.dia.codigo, name: row.dia.nombre }]
        : [],
    )
    .sort((left, right) => left.id - right.id)
    .map(({ code, name }) => ({ code, name }));

  return {
    id: negocio.id,
    name: negocio.nombre,
    category: {
      id: negocio.categoria.id,
      name: negocio.categoria.nombre,
      slug: negocio.categoria.slug,
    },
    shortDescription: negocio.descripcion_corta,
    logoUrl: negocio.logo_url,
    phone: negocio.whatsapp,
    email: negocio.email,
    sector: negocio.sector,
    aisleNumber: negocio.pasillo_puesto,
    latitude: Number(negocio.latitud),
    longitude: Number(negocio.longitud),
    openingDays,
    status: negocio.estado,
  };
}

export function toVendorProduct(product: ProductoServicio): VendorProductItem {
  const images = orderedImageUrls(product.imagenes);

  return {
    id: product.id,
    title: product.titulo,
    description: product.descripcion,
    price: Number(product.precio),
    currency: product.moneda,
    type: product.tipo,
    availabilityStatus: product.estado_disponibilidad,
    active: product.activo,
    imageUrl: images[0] ?? null,
    images,
    createdAt: product.creado_en,
    updatedAt: product.actualizado_en,
  };
}
