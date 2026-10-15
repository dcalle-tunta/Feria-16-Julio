import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { planProductSearchText } from '../catalog/product-search.rules';
import {
  buildCandidateProductSql,
  buildCandidateSearchSql,
} from './chat-candidate.query';
import {
  PRODUCTS_PER_CANDIDATE,
  type ChatCandidate,
} from './chat-recommendation.rules';

@Injectable()
export class ChatCandidateService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async find(prompt: string, categoryId?: number): Promise<ChatCandidate[]> {
    const text = planProductSearchText(prompt);
    if (!text.fulltextQuery && text.likePatterns.length === 0) {
      return [];
    }

    const search = buildCandidateSearchSql({
      fulltextQuery: text.fulltextQuery,
      likePatterns: text.likePatterns,
      categoryId,
    });
    const businesses = readBusinessRows(
      await this.dataSource.query(search.sql, search.params),
    );
    if (businesses.length === 0) {
      return [];
    }

    const products = buildCandidateProductSql(
      businesses.map((row) => row.id),
      text.fulltextQuery,
    );
    const titles = groupTitles(
      readProductRows(
        await this.dataSource.query(products.sql, products.params),
      ),
      PRODUCTS_PER_CANDIDATE,
    );

    return businesses.map((row) => ({
      id: row.id,
      name: row.nombre,
      sector: row.sector,
      logoUrl: row.logoUrl,
      description: row.description,
      productTitles: titles.get(row.id) ?? [],
    }));
  }
}

interface BusinessRow {
  id: number;
  nombre: string;
  sector: string;
  logoUrl: string | null;
  description: string | null;
}

interface ProductRow {
  negocioId: number;
  titulo: string;
}

function readBusinessRows(value: unknown): BusinessRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const rows: BusinessRow[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }

    const record = item as Record<string, unknown>;
    const id = readId(record.id);
    const nombre = readText(record.nombre);
    const sector = readText(record.sector);
    if (id === null || nombre === null || sector === null) {
      continue;
    }

    rows.push({
      id,
      nombre,
      sector,
      logoUrl: readText(record.logo_url),
      description: readText(record.descripcion_corta),
    });
  }

  return rows;
}

function readProductRows(value: unknown): ProductRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const rows: ProductRow[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }

    const record = item as Record<string, unknown>;
    const negocioId = readId(record.negocio_id);
    const titulo = readText(record.titulo);
    if (negocioId === null || titulo === null) {
      continue;
    }

    rows.push({ negocioId, titulo });
  }

  return rows;
}

function groupTitles(
  rows: readonly ProductRow[],
  limit: number,
): Map<number, string[]> {
  const grouped = new Map<number, string[]>();

  for (const row of rows) {
    const current = grouped.get(row.negocioId) ?? [];
    if (current.length >= limit || current.includes(row.titulo)) {
      grouped.set(row.negocioId, current);
      continue;
    }

    current.push(row.titulo);
    grouped.set(row.negocioId, current);
  }

  return grouped;
}

function readId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

  return null;
}

function readText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
