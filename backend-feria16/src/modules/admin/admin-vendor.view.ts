import { EstadoNegocio } from '../../common/enums/domain.enums';
import { Negocio } from '../businesses/entities/negocio.entity';

export interface AdminVendorCategory {
  id: number;
  name: string;
  slug: string;
}

export interface AdminVendorOpeningDay {
  code: string;
  name: string;
}

export interface AdminVendor {
  id: number;
  name: string;
  category: AdminVendorCategory;
  shortDescription: string | null;
  logoUrl: string | null;
  phone: string;
  email: string | null;
  sector: string;
  aisleNumber: string;
  latitude: number;
  longitude: number;
  openingDays: AdminVendorOpeningDay[];
  status: EstadoNegocio;
  rejectionReason: string | null;
  approvedById: number | null;
  registeredAt: Date;
  approvedAt: Date | null;
}

export interface AdminVendorPage {
  totalResults: number;
  page: number;
  limit: number;
  totalPages: number;
  data: AdminVendor[];
}

export function toAdminVendor(negocio: Negocio): AdminVendor {
  if (!negocio.categoria) {
    throw new Error('El puesto del backoffice requiere la categoría.');
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
    rejectionReason: negocio.motivo_rechazo,
    approvedById: negocio.aprobado_por_id,
    registeredAt: negocio.fecha_registro,
    approvedAt: negocio.fecha_aprobacion,
  };
}

export function totalPages(totalResults: number, limit: number): number {
  if (totalResults <= 0) {
    return 0;
  }

  return Math.ceil(totalResults / limit);
}
