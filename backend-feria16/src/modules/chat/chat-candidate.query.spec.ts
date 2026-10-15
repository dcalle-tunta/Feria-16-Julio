import {
  buildCandidateProductSql,
  buildCandidateSearchSql,
} from './chat-candidate.query';

function placeholderCount(sql: string): number {
  return sql.split('?').length - 1;
}

describe('buildCandidateSearchSql', () => {
  it('filtra aprobados, categoría y FULLTEXT, y alinea los parámetros', () => {
    const query = buildCandidateSearchSql({
      fulltextQuery: 'chamarra cuero',
      likePatterns: ['%de%'],
      categoryId: 2,
    });

    expect(query.sql).toContain("negocio.estado = 'APROBADO'");
    expect(query.sql).toContain('negocio.categoria_id = ?');
    expect(query.sql).toContain('producto.activo = 1');
    expect(query.sql).toContain(
      'MATCH(negocio.nombre, negocio.descripcion_corta) AGAINST (? IN NATURAL LANGUAGE MODE)',
    );
    expect(query.sql).toContain(
      'MATCH(producto.titulo, producto.descripcion) AGAINST (? IN NATURAL LANGUAGE MODE)',
    );
    expect(query.sql).toContain('LIMIT 30');
    expect(placeholderCount(query.sql)).toBe(query.params.length);
    expect(query.params).toEqual([
      'chamarra cuero',
      'chamarra cuero',
      2,
      'chamarra cuero',
      'chamarra cuero',
      '%de%',
      '%de%',
      '%de%',
      '%de%',
    ]);
  });

  it('arma solo LIKE cuando todos los tokens son cortos', () => {
    const query = buildCandidateSearchSql({
      fulltextQuery: null,
      likePatterns: ['%tv%'],
    });

    expect(query.sql).not.toContain('MATCH(');
    expect(query.sql).not.toContain('categoria_id');
    expect(placeholderCount(query.sql)).toBe(query.params.length);
    expect(query.params).toEqual(['%tv%', '%tv%', '%tv%', '%tv%']);
  });
});

describe('buildCandidateProductSql', () => {
  it('pide títulos activos de esos puestos y ordena por FULLTEXT si hay consulta', () => {
    const query = buildCandidateProductSql([4, 8], 'chamarra');

    expect(query.sql).toContain('producto.activo = 1');
    expect(query.sql).toContain('producto.negocio_id IN (?, ?)');
    expect(placeholderCount(query.sql)).toBe(query.params.length);
    expect(query.params).toEqual([4, 8, 'chamarra']);
  });
});
