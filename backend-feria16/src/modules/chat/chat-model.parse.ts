import {
  clipModelMessage,
  type ChatCandidate,
  type ChatModelRecommendation,
} from './chat-recommendation.rules';

export function parseModelRecommendation(
  content: string,
): ChatModelRecommendation | null {
  const json = extractJsonObject(content);
  if (!json) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  const message =
    typeof record.message === 'string' ? clipModelMessage(record.message) : '';

  return {
    outOfContext: record.out_of_context === true,
    message,
    vendorIds: readVendorIds(record.vendor_ids),
  };
}

export function buildModelMessages(
  prompt: string,
  candidates: readonly ChatCandidate[],
): { role: 'system' | 'user'; content: string }[] {
  const lines = candidates.map((candidate) => {
    const description = candidate.description
      ? ` | descripcion: ${candidate.description}`
      : '';
    const products =
      candidate.productTitles.length > 0
        ? ` | productos: ${candidate.productTitles.join('; ')}`
        : '';

    return `- id ${candidate.id} | ${candidate.name} | sector ${candidate.sector}${description}${products}`;
  });

  return [
    {
      role: 'system',
      content: [
        'Eres el asistente de recomendaciones de la Feria 16 de Julio, en El Alto, Bolivia.',
        'Solo hablas de productos, servicios y puestos de esta feria.',
        'Responde únicamente con un objeto JSON, sin markdown, con esta forma:',
        '{"out_of_context":false,"message":"...","vendor_ids":[1,2]}',
        'Si la consulta no trata de productos, servicios o puestos de la feria, out_of_context es true, message es vacío y vendor_ids es [].',
        'Si trata de la feria, vendor_ids solo puede incluir ids de la lista, en el orden en que los recomiendas.',
        'No inventes ids ni nombres. message es un texto breve en español y solo menciona puestos incluidos en vendor_ids.',
        'Si ninguno de los candidatos sirve, vendor_ids queda vacío.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `Consulta del visitante:\n${prompt}\n\nPuestos candidatos:\n${lines.join('\n')}`,
    },
  ];
}

function extractJsonObject(content: string): string | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(content);
  const source = fenced?.[1] ?? content;
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start === -1 || end <= start) {
    return null;
  }

  return source.slice(start, end + 1);
}

function readVendorIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const ids: number[] = [];
  for (const item of value) {
    const id = readId(item);
    if (id !== null) {
      ids.push(id);
    }
  }

  return ids;
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
