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
import {
  EstadoDisponibilidad,
  Moneda,
  TipoProducto,
} from '../../../common/enums/domain.enums';
import { createdAtColumn, updatedAtColumn } from '../../../database/column-options';
import { Negocio } from '../../businesses/entities/negocio.entity';
import { ProductoImagen } from './producto-imagen.entity';

@Entity('productos_servicios', { engine: 'InnoDB' })
@Index('idx_productos_catalogo', ['negocio_id', 'activo', 'moneda', 'precio'])
@Index('idx_productos_creado', ['creado_en'])
@Index('ft_productos_texto', ['titulo', 'descripcion'], { fulltext: true })
@Check('chk_productos_titulo', 'CHAR_LENGTH(titulo) BETWEEN 1 AND 150')
@Check('chk_productos_precio', 'precio >= 0')
export class ProductoServicio {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ type: 'int', unsigned: true })
  negocio_id: number;

  @ManyToOne(() => Negocio, (negocio) => negocio.productos, {
    nullable: false,
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({
    name: 'negocio_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_productos_negocio',
  })
  negocio: Negocio;

  @Column({ type: 'varchar', length: 150 })
  titulo: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  precio: string;

  @Column({ type: 'enum', enum: Moneda, default: Moneda.BOB })
  moneda: Moneda;

  @Column({ type: 'enum', enum: TipoProducto, default: TipoProducto.PRODUCTO })
  tipo: TipoProducto;

  @Column({
    type: 'enum',
    enum: EstadoDisponibilidad,
    default: EstadoDisponibilidad.DISPONIBLE,
  })
  estado_disponibilidad: EstadoDisponibilidad;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @Column(createdAtColumn)
  creado_en: Date;

  @Column(updatedAtColumn)
  actualizado_en: Date;

  @OneToMany(() => ProductoImagen, (imagen) => imagen.producto)
  imagenes: ProductoImagen[];
}
