import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Negocio } from '../../businesses/entities/negocio.entity';
import { Consulta } from './consulta.entity';

@Entity('consulta_negocios_sugeridos', { engine: 'InnoDB' })
export class ConsultaNegocioSugerido {
  @PrimaryColumn({ type: 'int', unsigned: true })
  consulta_id: number;

  @PrimaryColumn({ type: 'int', unsigned: true })
  negocio_id: number;

  @Column({ type: 'smallint', unsigned: true })
  orden: number;

  @ManyToOne(() => Consulta, (consulta) => consulta.negocios_sugeridos, {
    nullable: false,
    onDelete: 'CASCADE',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({
    name: 'consulta_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_cns_consulta',
  })
  consulta: Consulta;

  @ManyToOne(() => Negocio, (negocio) => negocio.sugerencias, {
    nullable: false,
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({
    name: 'negocio_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_cns_negocio',
  })
  negocio: Negocio;
}
