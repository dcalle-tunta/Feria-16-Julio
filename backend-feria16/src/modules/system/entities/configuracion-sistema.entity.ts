import { Column, Entity, PrimaryColumn } from 'typeorm';
import { updatedAtColumn } from '../../../database/column-options';

@Entity('configuraciones_sistema', { engine: 'InnoDB' })
export class ConfiguracionSistema {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  clave: string;

  @Column({ type: 'varchar', length: 255 })
  valor: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Column(updatedAtColumn)
  actualizado_en: Date;
}
