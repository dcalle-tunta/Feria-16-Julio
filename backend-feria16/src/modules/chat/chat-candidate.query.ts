import { CHAT_CANDIDATE_LIMIT } from './chat-recommendation.rules';

export interface CandidateSearchSql {
  sql: string;
  params: Array<string | number>;
}

const BUSINESS_MATCH =
  'MATCH(negocio.nombre, negocio.descripcion_corta) AGAINST (? IN NATURAL LANGUAGE MODE)';
const PRODUCT_MATCH =
  'MATCH(producto.titulo, producto.descripcion) AGAINST (? IN NATURAL LANGUAGE MODE)';

export function buildCandidateSearchSql(input: {
  fulltextQuery: string | null;
  likePatterns: readonly string[];
  categoryId?: number;
  limit?: number;
}): CandidateSearchSql {
  const limit = input.limit ?? CHAT_CANDIDATE_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > CHAT_CANDIDATE_LIMIT) {
    throw new Error('Límite de candidatos inválido.');
  }

  const where: string[] = ["negocio.estado = 'APROBADO'"];
  const whereParams: Array<string | number> = [];

  if (input.categoryId !== undefined) {
    where.push('negocio.categoria_id = ?');
    whereParams.push(input.categoryId);
  }

  if (input.fulltextQuery) {
    where.push(`(
      ${BUSINESS_MATCH}
      OR EXISTS (
        SELECT 1
        FROM productos_servicios producto
        WHERE producto.negocio_id = negocio.id
          AND producto.activo = 1
          AND ${PRODUCT_MATCH}
      )
    )`);
    whereParams.push(input.fulltextQuery, input.fulltextQuery);
  }

  for (const pattern of input.likePatterns) {
    where.push(`(
      negocio.nombre LIKE ? ESCAPE '\\\\'
      OR negocio.descripcion_corta LIKE ? ESCAPE '\\\\'
      OR EXISTS (
        SELECT 1
        FROM productos_servicios producto
        WHERE producto.negocio_id = negocio.id
          AND producto.activo = 1
          AND (
            producto.titulo LIKE ? ESCAPE '\\\\'
            OR producto.descripcion LIKE ? ESCAPE '\\\\'
          )
      )
    )`);
    whereParams.push(pattern, pattern, pattern, pattern);
  }

  const selectParams: Array<string | number> = [];
  let score = '0';
  if (input.fulltextQuery) {
    score = `(
      ${BUSINESS_MATCH}
      + COALESCE((
          SELECT MAX(${PRODUCT_MATCH})
          FROM productos_servicios producto
          WHERE producto.negocio_id = negocio.id
            AND producto.activo = 1
        ), 0)
    )`;
    selectParams.push(input.fulltextQuery, input.fulltextQuery);
  }

  const sql = `
    SELECT
      negocio.id AS id,
      negocio.nombre AS nombre,
      negocio.sector AS sector,
      negocio.logo_url AS logo_url,
      negocio.descripcion_corta AS descripcion_corta,
      ${score} AS score
    FROM negocios negocio
    WHERE ${where.join('\n      AND ')}
    ORDER BY score DESC, negocio.id ASC
    LIMIT ${limit}
  `;

  return { sql, params: [...selectParams, ...whereParams] };
}

export function buildCandidateProductSql(
  businessIds: readonly number[],
  fulltextQuery: string | null,
): CandidateSearchSql {
  const placeholders = businessIds.map(() => '?').join(', ');
  const params: Array<string | number> = [...businessIds];
  let order = 'producto.negocio_id ASC, producto.id ASC';

  if (fulltextQuery) {
    order = `producto.negocio_id ASC, ${PRODUCT_MATCH} DESC, producto.id ASC`;
    params.push(fulltextQuery);
  }

  const sql = `
    SELECT producto.negocio_id AS negocio_id, producto.titulo AS titulo
    FROM productos_servicios producto
    WHERE producto.activo = 1
      AND producto.negocio_id IN (${placeholders})
    ORDER BY ${order}
  `;

  return { sql, params };
}
