import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Negocio } from '../../businesses/entities/negocio.entity';
import { Consulta } from '../../chat/entities/consulta.entity';

@Entity('categorias', { engine: 'InnoDB' })
@Index('uq_categorias_slug', ['slug'], { unique: true })
@Index('uq_categorias_nombre', ['nombre'], { unique: true })
export class Categoria {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'varchar', length: 100 })
  slug: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  icono_url: string | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @OneToMany(() => Negocio, (negocio) => negocio.categoria)
  negocios: Negocio[];

  @OneToMany(() => Consulta, (consulta) => consulta.categoria)
  consultas: Consulta[];
}
