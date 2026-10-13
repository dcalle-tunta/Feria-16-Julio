import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfiguracionSistema } from '../../modules/system/entities/configuracion-sistema.entity';
import { Categoria } from '../../modules/system/entities/categoria.entity';
import { DiaSemana } from '../../modules/system/entities/dia-semana.entity';
import {
  CATEGORIAS_SEMILLA,
  CONFIGURACIONES_SEMILLA,
  DIAS_SEMILLA,
} from './catalog-seed.data';

@Injectable()
export class CatalogSeedService implements OnModuleInit {
  private readonly logger = new Logger(CatalogSeedService.name);

  constructor(
    @InjectRepository(ConfiguracionSistema)
    private readonly configuraciones: Repository<ConfiguracionSistema>,
    @InjectRepository(Categoria)
    private readonly categorias: Repository<Categoria>,
    @InjectRepository(DiaSemana)
    private readonly dias: Repository<DiaSemana>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.configuraciones
      .createQueryBuilder()
      .insert()
      .into(ConfiguracionSistema)
      .values([...CONFIGURACIONES_SEMILLA])
      .orIgnore()
      .updateEntity(false)
      .execute();

    await this.categorias
      .createQueryBuilder()
      .insert()
      .into(Categoria)
      .values([...CATEGORIAS_SEMILLA])
      .orIgnore()
      .updateEntity(false)
      .execute();

    await this.dias
      .createQueryBuilder()
      .insert()
      .into(DiaSemana)
      .values([...DIAS_SEMILLA])
      .orIgnore()
      .updateEntity(false)
      .execute();

    await this.assertSeed();
  }

  private async assertSeed(): Promise<void> {
    const claves = CONFIGURACIONES_SEMILLA.map((row) => row.clave);
    const slugs = CATEGORIAS_SEMILLA.map((row) => row.slug);
    const codigos = DIAS_SEMILLA.map((row) => row.codigo);

    const [configRows, categoriaRows, diaRows] = await Promise.all([
      this.configuraciones.find({ select: { clave: true, valor: true } }),
      this.categorias.find({ select: { slug: true } }),
      this.dias.find({ select: { codigo: true } }),
    ]);

    const foundClaves = new Map(configRows.map((row) => [row.clave, row.valor]));
    const foundSlugs = new Set(categoriaRows.map((row) => row.slug));
    const foundCodigos = new Set(diaRows.map((row) => row.codigo));

    const missingClaves = claves.filter((clave) => !foundClaves.has(clave));
    const missingSlugs = slugs.filter((slug) => !foundSlugs.has(slug));
    const missingCodigos = codigos.filter((codigo) => !foundCodigos.has(codigo));

    if (
      missingClaves.length > 0 ||
      missingSlugs.length > 0 ||
      missingCodigos.length > 0
    ) {
      throw new Error(
        `Semilla incompleta. Faltan configuraciones [${missingClaves.join(', ')}], categorías [${missingSlugs.join(', ')}], días [${missingCodigos.join(', ')}].`,
      );
    }

    const expectedValues = new Map(
      CONFIGURACIONES_SEMILLA.map((row) => [row.clave, row.valor]),
    );
    const changed = claves.filter(
      (clave) => foundClaves.get(clave) !== expectedValues.get(clave),
    );

    this.logger.log(
      `Semilla lista: ${claves.length} configuraciones, ${slugs.length} categorías, ${codigos.length} días.`,
    );

    if (changed.length > 0) {
      this.logger.warn(
        `Estas claves ya existían con otro valor y no se sobrescribieron: ${changed.join(', ')}.`,
      );
    }
  }
}
