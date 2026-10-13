import { Exclude } from 'class-transformer';
import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { RolBackoffice } from '../../../common/enums/domain.enums';
import { createdAtColumn } from '../../../database/column-options';
import { Negocio } from '../../businesses/entities/negocio.entity';

@Entity('usuarios_backoffice', { engine: 'InnoDB' })
@Index('uq_backoffice_email', ['email'], { unique: true })
export class UsuarioBackoffice {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'varchar', length: 150 })
  email: string;

  @Exclude()
  @Column({ type: 'varchar', length: 255, select: false })
  password_hash: string;

  @Column({ type: 'enum', enum: RolBackoffice })
  rol: RolBackoffice;

  @Column(createdAtColumn)
  creado_en: Date;

  @OneToMany(() => Negocio, (negocio) => negocio.aprobado_por)
  negocios_aprobados: Negocio[];
}
