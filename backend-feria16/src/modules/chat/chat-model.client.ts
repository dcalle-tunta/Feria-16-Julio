import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ChatCandidate,
  ChatModelRecommendation,
} from './chat-recommendation.rules';
import {
  buildModelMessages,
  parseModelRecommendation,
} from './chat-model.parse';

const AI_UNAVAILABLE = 'AI_UNAVAILABLE';
const AI_UNAVAILABLE_MESSAGE =
  'No se pudo generar la recomendación. Intenta de nuevo.';

@Injectable()
export class ChatModelClient {
  private readonly logger = new Logger(ChatModelClient.name);

  constructor(private readonly config: ConfigService) {}

  async recommend(
    prompt: string,
    candidates: readonly ChatCandidate[],
  ): Promise<ChatModelRecommendation> {
    const apiKey = this.config.get<string>('AI_API_KEY')?.trim() ?? '';
    const model = this.config.get<string>('AI_MODEL')?.trim() ?? '';
    const baseUrl = (
      this.config.get<string>('AI_BASE_URL')?.trim() ||
      'https://api.openai.com/v1'
    ).replace(/\/$/, '');

    if (!apiKey || !model) {
      this.logger.error('Faltan AI_API_KEY o AI_MODEL.');
      throw new ServiceUnavailableException({
        error: AI_UNAVAILABLE,
        message: AI_UNAVAILABLE_MESSAGE,
      });
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: buildModelMessages(prompt, candidates),
        }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      this.logger.error(
        error instanceof Error
          ? error.message
          : 'Fallo de red al llamar al modelo.',
      );
      throw new ServiceUnavailableException({
        error: AI_UNAVAILABLE,
        message: AI_UNAVAILABLE_MESSAGE,
      });
    }

    if (!response.ok) {
      this.logger.error(`El modelo respondió HTTP ${response.status}.`);
      throw new ServiceUnavailableException({
        error: AI_UNAVAILABLE,
        message: AI_UNAVAILABLE_MESSAGE,
      });
    }

    const recommendation = parseModelRecommendation(
      readMessageContent(await response.json()),
    );
    if (!recommendation) {
      this.logger.error('El modelo no devolvió el JSON esperado.');
      throw new ServiceUnavailableException({
        error: AI_UNAVAILABLE,
        message: AI_UNAVAILABLE_MESSAGE,
      });
    }

    return recommendation;
  }
}

function readMessageContent(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) {
    return '';
  }

  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return '';
  }

  const first = choices[0];
  if (typeof first !== 'object' || first === null) {
    return '';
  }

  const content = (first as { message?: { content?: unknown } }).message
    ?.content;
  if (typeof content === 'string') {
    return content;
  }

  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map((part) => {
      if (typeof part === 'string') {
        return part;
      }

      if (
        typeof part === 'object' &&
        part !== null &&
        'text' in part &&
        typeof part.text === 'string'
      ) {
        return part.text;
      }

      return '';
    })
    .join('');
}
