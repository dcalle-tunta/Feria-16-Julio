import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { createdAtColumn } from '../../../database/column-options';
import { Consulta } from './consulta.entity';

@Entity('sesiones_usuario', { engine: 'InnoDB' })
export class SesionUsuario {
  @PrimaryColumn({ type: 'char', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_direccion: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  user_agent: string | null;

  @Column({ type: 'int', unsigned: true, default: 0 })
  consultas_realizadas: number;

  @Column({ type: 'timestamp', nullable: true })
  ultima_consulta_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  bloqueado_hasta: Date | null;

  @Column(createdAtColumn)
  creado_en: Date;

  @OneToMany(() => Consulta, (consulta) => consulta.sesion)
  consultas: Consulta[];
}
