import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { DiaSemana } from '../../system/entities/dia-semana.entity';
import { Negocio } from './negocio.entity';

@Entity('negocio_dias_atencion', { engine: 'InnoDB' })
export class NegocioDiaAtencion {
  @PrimaryColumn({ type: 'int', unsigned: true })
  negocio_id: number;

  @PrimaryColumn({ type: 'tinyint', unsigned: true })
  dia_id: number;

  @ManyToOne(() => Negocio, (negocio) => negocio.dias_atencion, {
    nullable: false,
    onDelete: 'CASCADE',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({
    name: 'negocio_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_nda_negocio',
  })
  negocio: Negocio;

  @ManyToOne(() => DiaSemana, (dia) => dia.atenciones, {
    nullable: false,
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({
    name: 'dia_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_nda_dia',
  })
  dia: DiaSemana;
}
