import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ProductoServicio } from './producto-servicio.entity';

@Entity('producto_imagenes', { engine: 'InnoDB' })
@Index('uq_producto_orden', ['producto_id', 'orden'], { unique: true })
export class ProductoImagen {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ type: 'int', unsigned: true })
  producto_id: number;

  @ManyToOne(() => ProductoServicio, (producto) => producto.imagenes, {
    nullable: false,
    onDelete: 'CASCADE',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({
    name: 'producto_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_imagenes_producto',
  })
  producto: ProductoServicio;

  @Column({ type: 'varchar', length: 500 })
  imagen_url: string;

  @Column({ type: 'smallint', unsigned: true, default: 1 })
  orden: number;
}
