/**
 * Comprueba catálogos públicos y el alta del comerciante
 * sin levantar MySQL. Requiere `npm run build` antes.
 */
require('reflect-metadata');

const assert = require('node:assert/strict');
const { BadRequestException, ConflictException } = require('@nestjs/common');
const { Test } = require('@nestjs/testing');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const request = require('supertest');
const { QueryFailedError } = require('typeorm');
const { configureApp } = require('../dist/configure-app');
const {
  flattenValidationErrors,
} = require('../dist/common/validation/validation-exception.factory');
const { EstadoNegocio } = require('../dist/common/enums/domain.enums');
const passwordUtil = require('../dist/common/security/password.util');
const {
  RegisterVendorDto,
  PASSWORD_RULE_MESSAGE,
} = require('../dist/modules/auth/dto/register-vendor.dto');
const {
  AuthService,
  DUPLICATE_CONTACT_CODE,
  DUPLICATE_CONTACT_MESSAGE,
  REGISTER_SUCCESS_MESSAGE,
} = require('../dist/modules/auth/auth.service');
const { AuthController } = require('../dist/modules/auth/auth.controller');
const { CatalogController } = require('../dist/modules/catalog/catalog.controller');
const { CatalogService } = require('../dist/modules/catalog/catalog.service');
const { Categoria } = require('../dist/modules/system/entities/categoria.entity');
const { DiaSemana } = require('../dist/modules/system/entities/dia-semana.entity');
const { Negocio } = require('../dist/modules/businesses/entities/negocio.entity');

const hashedPasswords = [];

const VALID_BODY = {
  name: 'Novedades María',
  category_id: 1,
  short_description: 'Venta de ropa calientita',
  logo_url: 'https://feria.bo/logo.png',
  phone: '71234567',
  email: null,
  opening_days: ['JUEVES', 'DOMINGO'],
  sector: 'Sector Rieles',
  aisle_number: 'Pasillo 4, Puesto 12',
  latitude: -16.4951,
  longitude: -68.1623,
  password: 'Password123',
  terms_accepted: true,
};

async function detailsOf(body) {
  const dto = plainToInstance(RegisterVendorDto, body);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return flattenValidationErrors(errors);
}

function messagesFor(details, field) {
  return details
    .filter((detail) => detail.field === field)
    .map((detail) => detail.message);
}

function createRegisterHarness({
  category = { id: 1 },
  days = [
    { id: 1, codigo: 'JUEVES' },
    { id: 2, codigo: 'DOMINGO' },
  ],
  negocio = null,
  transactionError = null,
} = {}) {
  const saved = [];
  const manager = {
    async findOne(entity) {
      if (entity === Categoria) {
        return category;
      }
      if (entity === Negocio) {
        return negocio;
      }
      return null;
    },
    async find(entity) {
      if (entity === DiaSemana) {
        return days;
      }
      return [];
    },
    create(_entity, data) {
      return { ...data };
    },
    async save(value) {
      saved.push(value);
      if (Array.isArray(value)) {
        return value;
      }
      return { ...value, id: 9 };
    },
  };

  const service = new AuthService({
    manager,
    async transaction(work) {
      if (transactionError) {
        throw transactionError;
      }
      return work(manager);
    },
  });

  return { service, saved };
}

async function main() {
  const originalHash = passwordUtil.hashPassword;
  passwordUtil.hashPassword = async (plain) => {
    hashedPasswords.push(plain);
    return '$2b$12$hashed';
  };

  try {
    await assertDto();
    await assertCatalog();
    await assertRegister();
    await assertHttp();
  } finally {
    passwordUtil.hashPassword = originalHash;
  }

  console.log('Fase 2, tareas 1 a 4: comprobación correcta.');
}

async function assertDto() {
  assert.deepEqual(await detailsOf(VALID_BODY), []);

  const trimmed = plainToInstance(RegisterVendorDto, {
    ...VALID_BODY,
    name: '  Novedades María  ',
    email: '   ',
    short_description: '  ',
    logo_url: '',
    phone: ' 71234567 ',
  });
  assert.equal(trimmed.name, 'Novedades María');
  assert.equal(trimmed.email, null);
  assert.equal(trimmed.short_description, null);
  assert.equal(trimmed.logo_url, null);
  assert.equal(trimmed.phone, '71234567');
  assert.deepEqual(await detailsOf(trimmed), []);

  const rejected = await detailsOf({
    ...VALID_BODY,
    phone: '51234567',
    password: 'soloLetras',
    terms_accepted: false,
    opening_days: [],
    status: 'APROBADO',
    password_hash: 'no-debe-entrar',
  });
  assert.ok(
    messagesFor(rejected, 'phone').includes(
      'Ingresa un número de celular boliviano válido (8 dígitos).',
    ),
  );
  assert.ok(messagesFor(rejected, 'password').includes(PASSWORD_RULE_MESSAGE));
  assert.ok(
    messagesFor(rejected, 'terms_accepted').includes(
      'Debes aceptar los términos y políticas para continuar.',
    ),
  );
  assert.ok(
    messagesFor(rejected, 'opening_days').includes(
      'Debes seleccionar al menos un día de apertura.',
    ),
  );
  assert.deepEqual(messagesFor(rejected, 'status'), [
    'Este campo no está permitido.',
  ]);
  assert.deepEqual(messagesFor(rejected, 'password_hash'), [
    'Este campo no está permitido.',
  ]);

  const tooLong = await detailsOf({
    ...VALID_BODY,
    password: `a1${'x'.repeat(71)}`,
  });
  assert.deepEqual(messagesFor(tooLong, 'password'), [
    'La contraseña no puede superar los 72 caracteres.',
  ]);

  const accented = await detailsOf({
    ...VALID_BODY,
    password: 'Contraseña1',
  });
  assert.deepEqual(accented, []);

  const fields = await detailsOf({
    ...VALID_BODY,
    category_id: 0,
    latitude: 91,
    longitude: -181,
    logo_url: 'ftp://feria.bo/logo.png',
    opening_days: ['LUNES'],
    email: 'no-es-correo',
    name: 'ab',
  });
  for (const field of [
    'category_id',
    'latitude',
    'longitude',
    'logo_url',
    'opening_days',
    'email',
    'name',
  ]) {
    assert.ok(messagesFor(fields, field).length > 0, field);
  }
}

async function assertCatalog() {
  const categorias = {
    async find() {
      return [
        {
          id: 1,
          nombre: 'Deportes',
          slug: 'deportes',
          icono_url: 'https://cdn.example/icon.png',
          activo: true,
        },
      ];
    },
  };
  const dias = {
    async find() {
      return [
        { id: 1, codigo: 'JUEVES', nombre: 'Jueves' },
        { id: 2, codigo: 'DOMINGO', nombre: 'Domingo' },
        { id: 3, codigo: 'OTROS', nombre: 'Otros' },
      ];
    },
  };
  const service = new CatalogService(categorias, dias);

  assert.deepEqual(await service.listCategories(), {
    data: [{ id: 1, name: 'Deportes', slug: 'deportes' }],
  });
  assert.deepEqual(await service.listOpeningDays(), {
    data: [
      { code: 'JUEVES', name: 'Jueves' },
      { code: 'DOMINGO', name: 'Domingo' },
      { code: 'OTROS', name: 'Otros' },
    ],
  });
}

async function assertRegister() {
  const ok = createRegisterHarness();
  const created = await ok.service.register(
    plainToInstance(RegisterVendorDto, VALID_BODY),
  );
  assert.deepEqual(created, {
    id: 9,
    status: EstadoNegocio.PENDIENTE_VALIDACION,
    message: REGISTER_SUCCESS_MESSAGE,
  });
  assert.deepEqual(Object.keys(created), ['id', 'status', 'message']);
  assert.deepEqual(hashedPasswords, ['Password123']);

  const negocio = ok.saved.find((value) => !Array.isArray(value));
  assert.equal(negocio.estado, 'PENDIENTE_VALIDACION');
  assert.equal(negocio.whatsapp, '71234567');
  assert.equal(negocio.email, null);
  assert.equal(negocio.password_hash, '$2b$12$hashed');
  assert.equal(negocio.terminos_aceptados, true);
  assert.ok(negocio.terminos_aceptados_en instanceof Date);
  assert.equal(negocio.latitud, '-16.49510000');
  assert.equal(negocio.longitud, '-68.16230000');
  assert.equal(Object.hasOwn(negocio, 'password'), false);
  assert.deepEqual(
    ok.saved.find((value) => Array.isArray(value)),
    [
      { negocio_id: 9, dia_id: 1 },
      { negocio_id: 9, dia_id: 2 },
    ],
  );

  hashedPasswords.length = 0;
  const inactive = createRegisterHarness({ category: null });
  await assert.rejects(
    () => inactive.service.register(plainToInstance(RegisterVendorDto, VALID_BODY)),
    (error) => {
      assert.ok(error instanceof BadRequestException);
      assert.equal(error.getStatus(), 400);
      assert.deepEqual(error.getResponse().details, [
        {
          field: 'category_id',
          message: 'La categoría seleccionada no existe o no está activa.',
        },
      ]);
      return true;
    },
  );
  assert.deepEqual(hashedPasswords, []);

  const duplicate = createRegisterHarness({ negocio: { id: 4 } });
  await assert.rejects(
    () =>
      duplicate.service.register(plainToInstance(RegisterVendorDto, VALID_BODY)),
    (error) => {
      assert.ok(error instanceof ConflictException);
      assert.equal(error.getStatus(), 409);
      assert.deepEqual(error.getResponse(), {
        error: DUPLICATE_CONTACT_CODE,
        message: DUPLICATE_CONTACT_MESSAGE,
      });
      return true;
    },
  );

  const raced = createRegisterHarness({
    transactionError: new QueryFailedError('INSERT', [], {
      code: 'ER_DUP_ENTRY',
      errno: 1062,
    }),
  });
  await assert.rejects(
    () => raced.service.register(plainToInstance(RegisterVendorDto, VALID_BODY)),
    (error) => error instanceof ConflictException,
  );
}

async function assertHttp() {
  const register = async () => ({
    id: 3,
    status: EstadoNegocio.PENDIENTE_VALIDACION,
    message: REGISTER_SUCCESS_MESSAGE,
  });
  let registerCalls = 0;
  const auth = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      {
        provide: AuthService,
        useValue: {
          register: async (...args) => {
            registerCalls += 1;
            return register(...args);
          },
        },
      },
    ],
  }).compile();
  const authApp = auth.createNestApplication();
  authApp.setGlobalPrefix('api/v1');
  configureApp(authApp);
  await authApp.init();

  const catalog = await Test.createTestingModule({
    controllers: [CatalogController],
    providers: [
      {
        provide: CatalogService,
        useValue: {
          listCategories: async () => ({
            data: [{ id: 1, name: 'Deportes', slug: 'deportes' }],
          }),
          listOpeningDays: async () => ({
            data: [
              { code: 'JUEVES', name: 'Jueves' },
              { code: 'DOMINGO', name: 'Domingo' },
              { code: 'OTROS', name: 'Otros' },
            ],
          }),
        },
      },
    ],
  }).compile();
  const catalogApp = catalog.createNestApplication();
  catalogApp.setGlobalPrefix('api/v1');
  configureApp(catalogApp);
  await catalogApp.init();

  try {
    const created = await request(authApp.getHttpServer())
      .post('/api/v1/auth/register')
      .send(VALID_BODY);
    assert.equal(created.status, 201);
    assert.deepEqual(created.body, {
      id: 3,
      status: 'PENDIENTE_VALIDACION',
      message: REGISTER_SUCCESS_MESSAGE,
    });
    assert.equal(created.body.password_hash, undefined);
    assert.equal(registerCalls, 1);

    const invalid = await request(authApp.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...VALID_BODY, phone: '123', status: 'APROBADO' });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error, 'VALIDATION_ERROR');
    assert.ok(
      invalid.body.details.some(
        (detail) =>
          detail.field === 'phone' &&
          detail.message ===
            'Ingresa un número de celular boliviano válido (8 dígitos).',
      ),
    );
    assert.ok(
      invalid.body.details.some(
        (detail) =>
          detail.field === 'status' &&
          detail.message === 'Este campo no está permitido.',
      ),
    );
    assert.equal(registerCalls, 1);

    const categories = await request(catalogApp.getHttpServer()).get(
      '/api/v1/categories',
    );
    assert.equal(categories.status, 200);
    assert.deepEqual(categories.body, {
      data: [{ id: 1, name: 'Deportes', slug: 'deportes' }],
    });

    const days = await request(catalogApp.getHttpServer()).get(
      '/api/v1/opening-days',
    );
    assert.equal(days.status, 200);
    assert.deepEqual(days.body.data.map((day) => day.code), [
      'JUEVES',
      'DOMINGO',
      'OTROS',
    ]);
  } finally {
    await authApp.close();
    await catalogApp.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
