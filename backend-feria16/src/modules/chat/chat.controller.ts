import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ChatService } from './chat.service';
import {
  FERIA_SESSION_COOKIE,
  FERIA_SESSION_COOKIE_OPTIONS,
} from './chat-session.cookie';
import { RecommendChatDto } from './dto/recommend-chat.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('recommend')
  @HttpCode(HttpStatus.NO_CONTENT)
  async recommend(
    @Body() dto: RecommendChatDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const sessionId = await this.chatService.resolveSession(request);
    response.cookie(
      FERIA_SESSION_COOKIE,
      sessionId,
      FERIA_SESSION_COOKIE_OPTIONS,
    );
    // El cupo solo sube cuando la consulta se procesa (éxito, sin resultados
    // o fuera de contexto). Esas respuestas llegan en las tareas siguientes.
    await this.chatService.guardRecommend(sessionId, dto);
  }
}
