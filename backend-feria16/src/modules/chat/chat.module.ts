import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemModule } from '../system/system.module';
import { ChatCandidateService } from './chat-candidate.service';
import { ChatController } from './chat.controller';
import { ChatModelClient } from './chat-model.client';
import { ChatService } from './chat.service';
import { ConsultaNegocioSugerido } from './entities/consulta-negocio-sugerido.entity';
import { Consulta } from './entities/consulta.entity';
import { SesionUsuario } from './entities/sesion-usuario.entity';

@Module({
  imports: [
    SystemModule,
    TypeOrmModule.forFeature([
      SesionUsuario,
      Consulta,
      ConsultaNegocioSugerido,
    ]),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatCandidateService, ChatModelClient],
  exports: [TypeOrmModule],
})
export class ChatModule {}
