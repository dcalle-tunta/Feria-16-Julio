/**
 * Comprueba el perfil del comerciante y el alta, edición y baja lógica
 * de sus productos sin levantar MySQL. Requiere `npm run build` antes.
 */
require('reflect-metadata');

const assert = require('node:assert/strict');
const { BadRequestException, ConflictException, NotFoundException, UnauthorizedException, ValidationPipe } = require('@nestjs/common');
const { QueryFailedError } = require('typeorm');
const { EstadoDisponibilidad, EstadoNegocio, Moneda, TipoProducto } = require('../dist/common/enums/domain.enums');
const { toApiResponse } = require('../dist/common/interceptors/api-response.interceptor');
const { validationExceptionFactory } = require('../dist/common/validation/validation-exception.factory');
const passwordUtil = require('../dist/common/security/password.util');
const { NegocioDiaAtencion } = require('../dist/modules/businesses/entities/negocio-dia-atencion.entity');
const { Negocio } = require('../dist/modules/businesses/entities/negocio.entity');
const { ProductoImagen } = require('../dist/modules/products/entities/producto-imagen.entity');
const { ProductoServicio } = require('../dist/modules/products/entities/producto-servicio.entity');
const { DiaSemana } = require('../dist/modules/system/entities/dia-semana.entity');
const { CreateVendorProductDto } = require('../dist/modules/vendor/dto/create-vendor-product.dto');
const { UpdateVendorProductDto } = require('../dist/modules/vendor/dto/update-vendor-product.dto');
const { UpdateVendorProfileDto } = require('../dist/modules/vendor/dto/update-vendor-profile.dto');
const { VendorService } = require('../dist/modules/vendor/vendor.service');

const DAYS = [
  { id: 1, codigo: 'JUEVES', nombre: 'Jueves' },
  { id: 2, codigo: 'DOMINGO', nombre: 'Domingo' },
  { id: 3, codigo: 'OTROS', nombre: 'Otros' },
];

function createHarness(storedHash) {
  const store = {
    negocio: {
      id: 3,
      nombre: 'Puesto de Doña Juana',
      descripcion_corta: 'Ropa',
      logo_url: null,
      whatsapp: '71234567',
      email: 'maria@feria.bo',
      password_hash: storedHash,
      sector: 'Sector Rieles',
      pasillo_puesto: 'Pasillo 4',
      latitud: '-16.50000000',
      longitud: '-68.15000000',
      estado: EstadoNegocio.APROBADO,
      categoria: { id: 1, nombre: 'Deportes', slug: 'deportes' },
      dias_atencion: [
        {
          negocio_id: 3,
          dia_id: 2,
          dia: { id: 2, codigo: 'DOMINGO', nombre: 'Domingo' },
        },
        {
          negocio_id: 3,
          dia_id: 1,
          dia: { id: 1, codigo: 'JUEVES', nombre: 'Jueves' },
        },
      ],
    },
    contacts: [
      { id: 3, whatsapp: '71234567', email: 'maria@feria.bo' },
      { id: 9, whatsapp: '79876543', email: 'otro@feria.bo' },
    ],
    products: [
      {
        id: 15,
        negocio_id: 3,
        titulo: 'Chamarra',
        descripcion: null,
        precio: '150.00',
        moneda: Moneda.BOB,
        tipo: TipoProducto.PRODUCTO,
        estado_disponibilidad: EstadoDisponibilidad.DISPONIBLE,
        activo: false,
        creado_en: new Date('2026-10-01T12:00:00.000Z'),
        actualizado_en: new Date('2026-10-01T12:00:00.000Z'),
        imagenes: [
          { id: 2, imagen_url: 'https://cdn.example/b.jpg', orden: 2 },
          { id: 1, imagen_url: 'https://cdn.example/a.jpg', orden: 1 },
        ],
      },
      {
        id: 16,
        negocio_id: 4,
        titulo: 'De otro puesto',
        descripcion: null,
        precio: '10.00',
        moneda: Moneda.BOB,
        tipo: TipoProducto.PRODUCTO,
        estado_disponibilidad: EstadoDisponibilidad.DISPONIBLE,
        activo: true,
        creado_en: new Date('2026-10-03T12:00:00.000Z'),
        actualizado_en: new Date('2026-10-03T12:00:00.000Z'),
        imagenes: [],
      },
      {
        id: 17,
        negocio_id: 3,
        titulo: 'Jugo',
        descripcion: 'De temporada',
        precio: '8.50',
        moneda: Moneda.BOB,
        tipo: TipoProducto.PRODUCTO,
        estado_disponibilidad: EstadoDisponibilidad.AGOTADO,
        activo: true,
        creado_en: new Date('2026-10-02T12:00:00.000Z'),
        actualizado_en: new Date('2026-10-02T12:00:00.000Z'),
        imagenes: [],
      },
    ],
    days: DAYS.map((day) => ({ ...day })),
    failUpdate: false,
    nextProductId: 18,
    nextImageId: 3,
  };

  const negocioRepo = {
    createQueryBuilder() {
      let withPassword = false;
      const builder = {
        leftJoinAndSelect() {
          return builder;
        },
        where() {
          return builder;
        },
        addSelect() {
          withPassword = true;
          return builder;
        },
        async getOne() {
          if (!store.negocio) {
            return null;
          }
          const copy = {
            ...store.negocio,
            dias_atencion: [...store.negocio.dias_atencion],
          };
          if (!withPassword) {
            delete copy.password_hash;
          }
          return copy;
        },
      };
      return builder;
    },
    async findOne(options) {
      const where = options.where ?? {};
      const found = store.contacts.find((row) => {
        if (where.whatsapp !== undefined && row.whatsapp !== where.whatsapp) {
          return false;
        }
        if (where.email !== undefined && row.email !== where.email) {
          return false;
        }
        return where.whatsapp !== undefined || where.email !== undefined;
      });
      return found ? { id: found.id } : null;
    },
    async update(_criteria, patch) {
      if (store.failUpdate) {
        throw new QueryFailedError(
          'UPDATE negocios',
          [],
          Object.assign(new Error('ER_DUP_ENTRY'), {
            code: 'ER_DUP_ENTRY',
            errno: 1062,
          }),
        );
      }
      Object.assign(store.negocio, patch);
      const contact = store.contacts.find((row) => row.id === 3);
      if (contact) {
        if (typeof patch.whatsapp === 'string') {
          contact.whatsapp = patch.whatsapp;
        }
        if (patch.email === null || typeof patch.email === 'string') {
          contact.email = patch.email;
        }
      }
    },
  };

  const dayRepo = {
    async find(options) {
      const value = options?.where?.codigo?.value;
      const codes = Array.isArray(value) ? value.map(String) : null;
      return store.days.filter((day) => (codes ? codes.includes(day.codigo) : true));
    },
  };

  const attendanceRepo = {
    async delete() {
      store.negocio.dias_atencion = [];
    },
    create(data) {
      return { ...data };
    },
    async save(rows) {
      store.negocio.dias_atencion = rows.map((row) => ({
        ...row,
        dia: store.days.find((day) => day.id === row.dia_id),
      }));
      return rows;
    },
  };

  const productRepo = {
    create(data) {
      return { ...data };
    },
    async save(entity) {
      const now = new Date('2026-10-14T05:00:00.000Z');
      const stored = {
        descripcion: null,
        moneda: Moneda.BOB,
        tipo: TipoProducto.PRODUCTO,
        estado_disponibilidad: EstadoDisponibilidad.DISPONIBLE,
        activo: true,
        ...entity,
        id: store.nextProductId++,
        creado_en: now,
        actualizado_en: now,
        imagenes: [],
      };
      store.products.push(stored);
      return { ...stored, imagenes: [] };
    },
    async findOne(options) {
      const where = options?.where ?? {};
      const found = store.products.find(
        (product) =>
          product.id === where.id && product.negocio_id === where.negocio_id,
      );
      if (!found) {
        return null;
      }
      return {
        ...found,
        imagenes: found.imagenes.map((image) => ({ ...image })),
      };
    },
    async update(criteria, patch) {
      const row = store.products.find((product) => product.id === criteria.id);
      if (!row) {
        return { affected: 0 };
      }
      Object.assign(row, patch);
      row.actualizado_en = new Date('2026-10-14T06:00:00.000Z');
      return { affected: 1 };
    },
    async find(options) {
      const rows = store.products.filter(
        (product) => product.negocio_id === options.where.negocio_id,
      );
      if (options.order?.creado_en !== 'DESC') {
        return rows;
      }
      return [...rows].sort(
        (left, right) =>
          right.creado_en.getTime() - left.creado_en.getTime() || right.id - left.id,
      );
    },
  };

  const imageRepo = {
    create(data) {
      return { ...data };
    },
    async delete(criteria) {
      const product = store.products.find((item) => item.id === criteria.producto_id);
      if (product) {
        product.imagenes = [];
      }
    },
    async save(rows) {
      const list = Array.isArray(rows) ? rows : [rows];
      const product = store.products.find((item) => item.id === list[0]?.producto_id);
      if (!product) {
        throw new Error('Producto de imagen inexistente.');
      }
      product.imagenes = list.map((row) => ({
        id: store.nextImageId++,
        producto_id: row.producto_id,
        imagen_url: row.imagen_url,
        orden: row.orden,
      }));
      return product.imagenes.map((image) => ({ ...image }));
    },
  };

  const manager = {
    getRepository(entity) {
      if (entity === Negocio) return negocioRepo;
      if (entity === DiaSemana) return dayRepo;
      if (entity === NegocioDiaAtencion) return attendanceRepo;
      if (entity === ProductoServicio) return productRepo;
      if (entity === ProductoImagen) return imageRepo;
      throw new Error('Repositorio inesperado.');
    },
  };

  const dataSource = {
    manager,
    getRepository: (entity) => manager.getRepository(entity),
    transaction: (work) => work(manager),
  };

  return { store, service: new VendorService(dataSource) };
}

function errorBody(error) {
  assert.ok(
    error instanceof BadRequestException ||
      error instanceof ConflictException ||
      error instanceof NotFoundException,
  );
  return error.getResponse();
}

async function main() {
  const storedHash = await passwordUtil.hashPassword('Password123');
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: validationExceptionFactory,
  });

  const rejected = await pipe
    .transform(
      {
        status: 'SUSPENDIDO',
        category_id: 2,
        name: 'Otro nombre',
        password_hash: 'no',
        short_description: 'Hola',
      },
      { type: 'body', metatype: UpdateVendorProfileDto },
    )
    .then(
      () => {
        throw new Error('El body con estado y categoría debió rechazarse.');
      },
      (error) => error,
    );
  assert.ok(rejected instanceof BadRequestException);
  const rejectedFields = errorBody(rejected).details.map((detail) => detail.field);
  for (const field of ['status', 'category_id', 'name', 'password_hash']) {
    assert.ok(rejectedFields.includes(field), `Faltó rechazar ${field}`);
  }

  const dto = await pipe.transform(
    {
      short_description: '  Ropa de abrigo  ',
      email: '   ',
      current_password: 'Password123',
      new_password: 'NuevaClave1',
      opening_days: ['DOMINGO', 'JUEVES'],
    },
    { type: 'body', metatype: UpdateVendorProfileDto },
  );
  assert.equal(dto.short_description, 'Ropa de abrigo');
  assert.equal(dto.email, null);
  assert.equal(dto.new_password, 'NuevaClave1');

  await assert.rejects(
    () =>
      pipe.transform(
        { current_password: 'Password123', new_password: 'abcdefgh' },
        { type: 'body', metatype: UpdateVendorProfileDto },
      ),
    BadRequestException,
  );

  const profileHarness = createHarness(storedHash);
  const profile = toApiResponse(await profileHarness.service.getProfile(3));
  assert.equal(profile.name, 'Puesto de Doña Juana');
  assert.deepEqual(profile.category, { id: 1, name: 'Deportes', slug: 'deportes' });
  assert.equal(profile.phone, '71234567');
  assert.equal(profile.status, 'APROBADO');
  assert.deepEqual(profile.opening_days, [
    { code: 'JUEVES', name: 'Jueves' },
    { code: 'DOMINGO', name: 'Domingo' },
  ]);
  assert.equal(JSON.stringify(profile).includes(storedHash), false);
  assert.equal(profile.password_hash, undefined);

  profileHarness.store.negocio = null;
  await assert.rejects(
    () => profileHarness.service.getProfile(3),
    UnauthorizedException,
  );

  const updateHarness = createHarness(storedHash);
  const updated = await updateHarness.service.updateProfile(3, {
    short_description: 'Ropa de abrigo',
    phone: '71234567',
    latitude: -16.4,
    longitude: -68.1,
    opening_days: ['DOMINGO'],
  });
  assert.equal(updated.shortDescription, 'Ropa de abrigo');
  assert.equal(updated.phone, '71234567');
  assert.equal(updated.openingDays.length, 1);
  assert.equal(updated.openingDays[0].code, 'DOMINGO');
  assert.equal(updateHarness.store.negocio.latitud, '-16.40000000');
  assert.equal(updateHarness.store.negocio.password_hash, storedHash);

  const passwordHarness = createHarness(storedHash);
  await assert.rejects(
    () =>
      passwordHarness.service.updateProfile(3, {
        current_password: 'OtraClave9',
        new_password: 'NuevaClave1',
      }),
    BadRequestException,
  );
  assert.equal(passwordHarness.store.negocio.password_hash, storedHash);
  await passwordHarness.service.updateProfile(3, {
    current_password: 'Password123',
    new_password: 'NuevaClave1',
  });
  assert.equal(
    await passwordUtil.verifyPassword(
      'NuevaClave1',
      passwordHarness.store.negocio.password_hash,
    ),
    true,
  );

  const pairHarness = createHarness(storedHash);
  await assert.rejects(
    () => pairHarness.service.updateProfile(3, { new_password: 'NuevaClave1' }),
    BadRequestException,
  );
  assert.equal(pairHarness.store.negocio.password_hash, storedHash);

  const duplicateHarness = createHarness(storedHash);
  await assert.rejects(
    () => duplicateHarness.service.updateProfile(3, { phone: '79876543' }),
    ConflictException,
  );
  await assert.rejects(
    () => duplicateHarness.service.updateProfile(3, { email: 'otro@feria.bo' }),
    ConflictException,
  );

  const clearHarness = createHarness(storedHash);
  const cleared = await clearHarness.service.updateProfile(3, { email: null });
  assert.equal(cleared.email, null);
  clearHarness.store.failUpdate = true;
  await assert.rejects(
    () => clearHarness.service.updateProfile(3, { sector: 'Sector Norte' }),
    ConflictException,
  );
  assert.equal(clearHarness.store.negocio.sector, 'Sector Rieles');

  const daysHarness = createHarness(storedHash);
  daysHarness.store.days = daysHarness.store.days.filter((day) => day.codigo !== 'OTROS');
  await assert.rejects(
    () => daysHarness.service.updateProfile(3, { opening_days: ['OTROS'] }),
    BadRequestException,
  );
  assert.equal(daysHarness.store.negocio.dias_atencion.length, 2);

  const listed = toApiResponse(await createHarness(storedHash).service.listProducts(3));
  assert.deepEqual(
    listed.data.map((item) => item.id),
    [17, 15],
  );
  assert.equal(listed.data[0].availability_status, 'AGOTADO');
  assert.equal(listed.data[0].active, true);
  assert.equal(listed.data[1].active, false);
  assert.equal(listed.data[1].image_url, 'https://cdn.example/a.jpg');
  assert.deepEqual(listed.data[1].images, [
    'https://cdn.example/a.jpg',
    'https://cdn.example/b.jpg',
  ]);

  const rejectedProduct = await pipe
    .transform(
      {
        title: 'Chamarra',
        price: 10,
        category_id: 2,
        negocio_id: 9,
        activo: false,
        status: 'APROBADO',
      },
      { type: 'body', metatype: CreateVendorProductDto },
    )
    .then(
      () => {
        throw new Error('El alta no debe aceptar rubro, dueño ni baja lógica.');
      },
      (error) => error,
    );
  assert.ok(rejectedProduct instanceof BadRequestException);
  const rejectedProductFields = errorBody(rejectedProduct).details.map(
    (detail) => detail.field,
  );
  for (const field of ['category_id', 'negocio_id', 'activo', 'status']) {
    assert.ok(rejectedProductFields.includes(field), `Faltó rechazar ${field}`);
  }

  await assert.rejects(
    () =>
      pipe.transform(
        { title: '  ', price: -1, image_urls: ['ftp://cdn.example/a.jpg'] },
        { type: 'body', metatype: CreateVendorProductDto },
      ),
    BadRequestException,
  );
  await assert.rejects(
    () =>
      pipe.transform(
        {
          title: 'Chamarra',
          price: 10,
          image_urls: Array.from({ length: 9 }, (_, index) => `https://cdn.example/${index}.jpg`),
        },
        { type: 'body', metatype: CreateVendorProductDto },
      ),
    BadRequestException,
  );

  const createDto = await pipe.transform(
    { title: '  Jugo de temporada  ', price: '8.5', description: '   ' },
    { type: 'body', metatype: CreateVendorProductDto },
  );
  assert.equal(createDto.title, 'Jugo de temporada');
  assert.equal(createDto.price, 8.5);
  assert.equal(createDto.description, null);

  const catalog = createHarness(storedHash);
  const created = toApiResponse(
    await catalog.service.createProduct(3, {
      title: 'Jugo de temporada',
      price: 8.5,
    }),
  );
  assert.equal(created.id, 18);
  assert.equal(created.currency, 'BOB');
  assert.equal(created.type, 'PRODUCTO');
  assert.equal(created.availability_status, 'DISPONIBLE');
  assert.equal(created.active, true);
  assert.equal(created.description, null);
  assert.equal(created.image_url, null);
  assert.deepEqual(created.images, []);
  assert.equal(
    catalog.store.products.find((product) => product.id === 18).precio,
    '8.50',
  );
  assert.equal(
    catalog.store.products.find((product) => product.id === 18).negocio_id,
    3,
  );

  const withImages = toApiResponse(
    await catalog.service.createProduct(3, {
      title: 'Cambio de aceite',
      description: 'Incluye filtro',
      price: 0,
      currency: Moneda.USD,
      type: TipoProducto.SERVICIO,
      availability_status: EstadoDisponibilidad.AGOTADO,
      image_urls: ['https://cdn.example/b.jpg', 'https://cdn.example/a.jpg'],
    }),
  );
  assert.equal(withImages.currency, 'USD');
  assert.equal(withImages.type, 'SERVICIO');
  assert.equal(withImages.availability_status, 'AGOTADO');
  assert.equal(withImages.price, 0);
  assert.equal(withImages.image_url, 'https://cdn.example/b.jpg');
  assert.deepEqual(
    catalog.store.products
      .find((product) => product.id === withImages.id)
      .imagenes.map((image) => image.orden),
    [1, 2],
  );

  const kept = toApiResponse(
    await catalog.service.updateProduct(3, withImages.id, {
      title: 'Cambio de aceite premium',
    }),
  );
  assert.equal(kept.title, 'Cambio de aceite premium');
  assert.deepEqual(kept.images, [
    'https://cdn.example/b.jpg',
    'https://cdn.example/a.jpg',
  ]);

  const galleryCleared = toApiResponse(
    await catalog.service.updateProduct(3, withImages.id, {
      description: null,
      image_urls: [],
    }),
  );
  assert.equal(galleryCleared.description, null);
  assert.deepEqual(galleryCleared.images, []);
  assert.equal(galleryCleared.image_url, null);

  const foreign = catalog.store.products.find((product) => product.id === 16);
  await assert.rejects(
    () => catalog.service.updateProduct(3, 16, { title: 'Ajeno' }),
    (error) => {
      assert.ok(error instanceof NotFoundException);
      assert.equal(errorBody(error).error, 'PRODUCT_NOT_FOUND');
      return true;
    },
  );
  assert.equal(foreign.titulo, 'De otro puesto');

  const removed = toApiResponse(await catalog.service.deactivateProduct(3, 18));
  assert.equal(removed.active, false);
  const row = catalog.store.products.find((product) => product.id === 18);
  assert.ok(row);
  assert.equal(row.activo, false);

  await assert.rejects(
    () => catalog.service.deactivateProduct(3, 16),
    NotFoundException,
  );
  await assert.rejects(
    () => catalog.service.deactivateProduct(3, 999),
    NotFoundException,
  );
  assert.equal(foreign.activo, true);

  const afterDelete = toApiResponse(await catalog.service.listProducts(3));
  assert.ok(afterDelete.data.some((item) => item.id === 18 && item.active === false));

  console.log('Fase 4, tareas 1 a 6: perfil y productos del comerciante en orden.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
