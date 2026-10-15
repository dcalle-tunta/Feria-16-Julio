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
import type { ChatRecommendResponse } from './chat-recommendation.rules';
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
  @HttpCode(HttpStatus.OK)
  async recommend(
    @Body() dto: RecommendChatDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ChatRecommendResponse> {
    const sessionId = await this.chatService.resolveSession(request);
    response.cookie(
      FERIA_SESSION_COOKIE,
      sessionId,
      FERIA_SESSION_COOKIE_OPTIONS,
    );
    return this.chatService.recommend(sessionId, dto);
  }
}
