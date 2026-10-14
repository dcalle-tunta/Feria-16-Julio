import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  VALIDATION_ERROR_CODE,
  VALIDATION_ERROR_MESSAGE,
} from '../../common/http/api-error.response';
import { Categoria } from '../system/entities/categoria.entity';
import { ConfiguracionSistema } from '../system/entities/configuracion-sistema.entity';
import {
  CHAT_CHAR_LIMIT_MESSAGE,
  rejectChatPrompt,
  WORD_LIMIT_EXCEEDED,
  WORD_LIMIT_MESSAGE,
} from './chat-prompt.rules';
import {
  CHAT_SETTING_KEYS,
  countAfterProcessedPrompt,
  evaluateChatQuota,
  INVALID_CATEGORY,
  INVALID_CATEGORY_MESSAGE,
  RATE_LIMIT_EXCEEDED,
  RATE_LIMIT_MESSAGE,
  resolveChatSettings,
  type ChatSettings,
} from './chat-quota.rules';
import { clipOptional, readFeriaSessionId } from './chat-session.cookie';
import { RecommendChatDto } from './dto/recommend-chat.dto';
import { SesionUsuario } from './entities/sesion-usuario.entity';

const IP_MAX = 45;
const USER_AGENT_MAX = 255;

@Injectable()
export class ChatService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(SesionUsuario)
    private readonly sesiones: Repository<SesionUsuario>,
    @InjectRepository(Categoria)
    private readonly categorias: Repository<Categoria>,
    @InjectRepository(ConfiguracionSistema)
    private readonly configuraciones: Repository<ConfiguracionSistema>,
  ) {}

  async resolveSession(request: Request): Promise<string> {
    const presented = readFeriaSessionId(request.headers.cookie);
    if (presented) {
      const existing = await this.sesiones.findOne({
        where: { id: presented },
        select: { id: true },
      });
      if (existing) {
        return existing.id;
      }
    }

    const id = randomUUID();
    await this.sesiones.insert({
      id,
      ip_direccion: clipOptional(
        request.ip || request.socket?.remoteAddress,
        IP_MAX,
      ),
      user_agent: clipOptional(request.get('user-agent'), USER_AGENT_MAX),
      consultas_realizadas: 0,
    });
    return id;
  }

  async guardRecommend(
    sessionId: string,
    dto: RecommendChatDto,
    now = new Date(),
  ): Promise<void> {
    this.assertPrompt(dto.prompt);
    await this.assertCategory(dto.category_id);
    const settings = await this.loadSettings();
    await this.enforceQuota(sessionId, settings, now);
  }

  async recordProcessedPrompt(
    sessionId: string,
    now = new Date(),
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const session = await this.lockSession(manager, sessionId);
      const next = countAfterProcessedPrompt(
        Number(session.consultas_realizadas),
      );
      await manager.update(SesionUsuario, sessionId, {
        consultas_realizadas: next,
        ultima_consulta_at: now,
      });
    });
  }

  private assertPrompt(prompt: string): void {
    const rejection = rejectChatPrompt(prompt);
    if (rejection === 'word_limit') {
      throw new UnprocessableEntityException({
        error: WORD_LIMIT_EXCEEDED,
        message: WORD_LIMIT_MESSAGE,
      });
    }

    if (rejection === 'character_limit') {
      throw new BadRequestException({
        error: VALIDATION_ERROR_CODE,
        message: VALIDATION_ERROR_MESSAGE,
        details: [{ field: 'prompt', message: CHAT_CHAR_LIMIT_MESSAGE }],
      });
    }
  }

  private async assertCategory(categoryId?: number): Promise<void> {
    if (categoryId === undefined) {
      return;
    }

    const category = await this.categorias.findOne({
      where: { id: categoryId, activo: true },
      select: { id: true },
    });

    if (!category) {
      throw new BadRequestException({
        error: INVALID_CATEGORY,
        message: INVALID_CATEGORY_MESSAGE,
      });
    }
  }

  private async loadSettings(): Promise<ChatSettings> {
    const rows = await this.configuraciones.find({
      where: { clave: In(Object.values(CHAT_SETTING_KEYS)) },
      select: { clave: true, valor: true },
    });
    return resolveChatSettings(rows);
  }

  private async enforceQuota(
    sessionId: string,
    settings: ChatSettings,
    now: Date,
  ): Promise<void> {
    const decision = await this.dataSource.transaction(async (manager) => {
      const session = await this.lockSession(manager, sessionId);
      const effect = evaluateChatQuota({
        consultasRealizadas: Number(session.consultas_realizadas),
        bloqueadoHasta: asDate(session.bloqueado_hasta),
        maxConsultas: settings.maxConsultasSesion,
        bloqueoMinutos: settings.tiempoBloqueoMinutos,
        now,
      });

      if (effect.kind === 'allow' && effect.reset) {
        await manager.update(SesionUsuario, sessionId, {
          consultas_realizadas: 0,
          bloqueado_hasta: null,
        });
      }

      if (effect.kind === 'reject' && effect.persistBlock) {
        await manager.update(SesionUsuario, sessionId, {
          bloqueado_hasta: effect.bloqueadoHasta,
        });
      }

      return effect;
    });

    if (decision.kind === 'reject') {
      throw new HttpException(
        {
          error: RATE_LIMIT_EXCEEDED,
          message: RATE_LIMIT_MESSAGE,
          retry_after_seconds: decision.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async lockSession(
    manager: EntityManager,
    sessionId: string,
  ): Promise<SesionUsuario> {
    const session = await manager
      .getRepository(SesionUsuario)
      .createQueryBuilder('sesion')
      .setLock('pessimistic_write')
      .where('sesion.id = :id', { id: sessionId })
      .getOne();

    if (!session) {
      throw new Error('La sesión del chat no existe.');
    }

    return session;
  }
}

function asDate(value: Date | string | null): Date | null {
  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
