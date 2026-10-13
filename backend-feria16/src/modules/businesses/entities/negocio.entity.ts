import { Exclude } from 'class-transformer';
import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EstadoNegocio } from '../../../common/enums/domain.enums';
import { createdAtColumn, updatedAtColumn } from '../../../database/column-options';
import { ConsultaNegocioSugerido } from '../../chat/entities/consulta-negocio-sugerido.entity';
import { ProductoServicio } from '../../products/entities/producto-servicio.entity';
import { UsuarioBackoffice } from '../../auth/entities/usuario-backoffice.entity';
import { Categoria } from '../../system/entities/categoria.entity';
import { NegocioDiaAtencion } from './negocio-dia-atencion.entity';

@Entity('negocios', { engine: 'InnoDB' })
@Index('uq_negocios_whatsapp', ['whatsapp'], { unique: true })
@Index('uq_negocios_email', ['email'], { unique: true })
@Index('idx_negocios_categoria', ['categoria_id'])
@Index('idx_negocios_estado_fecha', ['estado', 'fecha_registro'])
@Index('ft_negocios_texto', ['nombre', 'descripcion_corta'], { fulltext: true })
@Check('chk_negocios_nombre', 'CHAR_LENGTH(nombre) BETWEEN 3 AND 50')
@Check('chk_negocios_whatsapp', "whatsapp REGEXP '^[67][0-9]{7}'")
@Check('chk_negocios_latitud', 'latitud BETWEEN -90 AND 90')
@Check('chk_negocios_longitud', 'longitud BETWEEN -180 AND 180')
@Check('chk_negocios_terminos', 'terminos_aceptados = 1')
export class Negocio {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ type: 'int', unsigned: true })
  categoria_id: number;

  @ManyToOne(() => Categoria, (categoria) => categoria.negocios, {
    nullable: false,
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({
    name: 'categoria_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_negocios_categoria',
  })
  categoria: Categoria;

  @Column({ type: 'varchar', length: 50 })
  nombre: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  descripcion_corta: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logo_url: string | null;

  @Column({ type: 'varchar', length: 8 })
  whatsapp: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email: string | null;

  @Exclude()
  @Column({ type: 'varchar', length: 255, select: false })
  password_hash: string;

  @Column({ type: 'varchar', length: 100 })
  sector: string;

  @Column({ type: 'varchar', length: 100 })
  pasillo_puesto: string;

  @Column({ type: 'decimal', precision: 10, scale: 8 })
  latitud: string;

  @Column({ type: 'decimal', precision: 11, scale: 8 })
  longitud: string;

  @Column({ type: 'boolean' })
  terminos_aceptados: boolean;

  @Column({ type: 'timestamp' })
  terminos_aceptados_en: Date;

  @Column({
    type: 'enum',
    enum: EstadoNegocio,
    default: EstadoNegocio.PENDIENTE_VALIDACION,
  })
  estado: EstadoNegocio;

  @Column({ type: 'varchar', length: 255, nullable: true })
  motivo_rechazo: string | null;

  @Column({ type: 'int', unsigned: true, nullable: true })
  aprobado_por_id: number | null;

  @ManyToOne(() => UsuarioBackoffice, (usuario) => usuario.negocios_aprobados, {
    nullable: true,
    onDelete: 'SET NULL',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({
    name: 'aprobado_por_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_negocios_aprobador',
  })
  aprobado_por: UsuarioBackoffice | null;

  @Column(createdAtColumn)
  fecha_registro: Date;

  @Column({ type: 'timestamp', nullable: true })
  fecha_aprobacion: Date | null;

  @Column(updatedAtColumn)
  actualizado_en: Date;

  @OneToMany(() => NegocioDiaAtencion, (atencion) => atencion.negocio)
  dias_atencion: NegocioDiaAtencion[];

  @OneToMany(() => ProductoServicio, (producto) => producto.negocio)
  productos: ProductoServicio[];

  @OneToMany(() => ConsultaNegocioSugerido, (sugerido) => sugerido.negocio)
  sugerencias: ConsultaNegocioSugerido[];
}
