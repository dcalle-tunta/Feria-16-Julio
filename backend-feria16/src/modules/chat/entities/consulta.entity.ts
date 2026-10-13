import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { createdAtColumn } from '../../../database/column-options';
import { Negocio } from '../../businesses/entities/negocio.entity';
import { Categoria } from '../../system/entities/categoria.entity';
import { ConsultaNegocioSugerido } from './consulta-negocio-sugerido.entity';
import { SesionUsuario } from './sesion-usuario.entity';

@Entity('consultas', { engine: 'InnoDB' })
@Index('idx_consultas_sesion_fecha', ['sesion_id', 'fecha_hora'])
export class Consulta {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ type: 'char', length: 36 })
  sesion_id: string;

  @ManyToOne(() => SesionUsuario, (sesion) => sesion.consultas, {
    nullable: false,
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({
    name: 'sesion_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_consultas_sesion',
  })
  sesion: SesionUsuario;

  @Column({ type: 'int', unsigned: true, nullable: true })
  categoria_id: number | null;

  @ManyToOne(() => Categoria, (categoria) => categoria.consultas, {
    nullable: true,
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({
    name: 'categoria_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_consultas_categoria',
  })
  categoria: Categoria | null;

  @Column({ type: 'text' })
  pregunta_usuario: string;

  @Column({ type: 'text' })
  respuesta_feria16: string;

  @Column(createdAtColumn)
  fecha_hora: Date;

  @OneToMany(() => ConsultaNegocioSugerido, (sugerido) => sugerido.consulta)
  negocios_sugeridos: ConsultaNegocioSugerido[];
}
