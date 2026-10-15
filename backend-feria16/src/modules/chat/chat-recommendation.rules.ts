export const NO_RESULTS_STATUS = 'no_results' as const;
export const SUCCESS_STATUS = 'success' as const;

export const NO_RESULTS_MESSAGE =
  'No se encontraron productos ni negocios relacionados con tu búsqueda en la feria.';

export const SUCCESS_FALLBACK_MESSAGE =
  'Estos puestos de la feria coinciden con tu búsqueda.';

export const CHAT_CANDIDATE_LIMIT = 30;
export const PRODUCTS_PER_CANDIDATE = 5;
export const MODEL_MESSAGE_LIMIT = 2000;

export interface ChatCandidate {
  id: number;
  name: string;
  sector: string;
  logoUrl: string | null;
  description: string | null;
  productTitles: string[];
}

export interface RecommendedVendor {
  id: number;
  name: string;
  sector: string;
  logoUrl: string | null;
}

export interface ChatRecommendResponse {
  status: typeof SUCCESS_STATUS | typeof NO_RESULTS_STATUS;
  message: string;
  recommendedVendors: RecommendedVendor[];
}

export interface ChatModelRecommendation {
  outOfContext: boolean;
  message: string;
  vendorIds: number[];
}

export function selectCitedVendors(
  citedIds: readonly number[],
  allowedIds: ReadonlySet<number>,
  maxVendors: number,
): number[] {
  if (!Number.isInteger(maxVendors) || maxVendors <= 0) {
    return [];
  }

  const selected: number[] = [];
  const seen = new Set<number>();

  for (const id of citedIds) {
    if (
      !Number.isInteger(id) ||
      id <= 0 ||
      !allowedIds.has(id) ||
      seen.has(id)
    ) {
      continue;
    }

    selected.push(id);
    seen.add(id);
    if (selected.length >= maxVendors) {
      break;
    }
  }

  return selected;
}

export function toRecommendedVendors(
  citedIds: readonly number[],
  candidates: readonly ChatCandidate[],
): RecommendedVendor[] {
  const byId = new Map(
    candidates.map((candidate) => [candidate.id, candidate]),
  );

  return citedIds.flatMap((id) => {
    const candidate = byId.get(id);
    if (!candidate) {
      return [];
    }

    return [
      {
        id: candidate.id,
        name: candidate.name,
        sector: candidate.sector,
        logoUrl: candidate.logoUrl,
      },
    ];
  });
}

export function noResultsResponse(): ChatRecommendResponse {
  return {
    status: NO_RESULTS_STATUS,
    message: NO_RESULTS_MESSAGE,
    recommendedVendors: [],
  };
}

export function clipModelMessage(message: string): string {
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return '';
  }

  return trimmed.length <= MODEL_MESSAGE_LIMIT
    ? trimmed
    : trimmed.slice(0, MODEL_MESSAGE_LIMIT);
}
