import { Column, Entity, Index, OneToMany, PrimaryColumn } from 'typeorm';
import { NegocioDiaAtencion } from '../../businesses/entities/negocio-dia-atencion.entity';

@Entity('dias_semana', { engine: 'InnoDB' })
@Index('uq_dias_codigo', ['codigo'], { unique: true })
export class DiaSemana {
  @PrimaryColumn({ type: 'tinyint', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 10 })
  codigo: string;

  @Column({ type: 'varchar', length: 15 })
  nombre: string;

  @OneToMany(() => NegocioDiaAtencion, (atencion) => atencion.dia)
  atenciones: NegocioDiaAtencion[];
}
