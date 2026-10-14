/**
 * Comprueba login de comerciante, login de backoffice, JWT y el guard
 * sin levantar MySQL. Requiere `npm run build` antes.
 */
require('reflect-metadata');

const assert = require('node:assert/strict');
const {
  Controller,
  Get,
  Req,
  UseGuards,
} = require('@nestjs/common');
const { JwtService } = require('@nestjs/jwt');
const { Test } = require('@nestjs/testing');
const request = require('supertest');
const { configureApp } = require('../dist/configure-app');
const { EstadoNegocio, RolBackoffice } = require('../dist/common/enums/domain.enums');
const passwordUtil = require('../dist/common/security/password.util');
const { AuthRole } = require('../dist/modules/auth/auth-token');
const { AdminAuthController } = require('../dist/modules/auth/admin-auth.controller');
const { AuthController } = require('../dist/modules/auth/auth.controller');
const {
  AuthService,
  ACCOUNT_PENDING_APPROVAL,
  ACCOUNT_PENDING_MESSAGE,
  ACCOUNT_REJECTED,
  ACCOUNT_REJECTED_MESSAGE,
  ACCOUNT_SUSPENDED,
  ACCOUNT_SUSPENDED_MESSAGE,
  INVALID_CREDENTIALS_CODE,
  INVALID_CREDENTIALS_MESSAGE,
  UNAUTHORIZED_MESSAGE,
} = require('../dist/modules/auth/auth.service');
const { JwtAuthGuard, FORBIDDEN_ROLE_MESSAGE } = require('../dist/modules/auth/jwt-auth.guard');
const { Roles } = require('../dist/modules/auth/roles.decorator');
const { Negocio } = require('../dist/modules/businesses/entities/negocio.entity');
const { UsuarioBackoffice } = require('../dist/modules/auth/entities/usuario-backoffice.entity');

const STORED_HASH = 'stored-hash';
const DUMMY_HASH = 'dummy-hash';

class SessionController {
  me(req) {
    return {
      id: req.user.id,
      role: req.user.role,
      name: req.user.name,
      status: req.user.status ?? null,
    };
  }

  adminOnly(req) {
    return { id: req.user.id, role: req.user.role };
  }
}

Controller('session')(SessionController);
bindRoute(SessionController, 'me', Get(), UseGuards(JwtAuthGuard));
bindRoute(
  SessionController,
  'adminOnly',
  Get('admin'),
  UseGuards(JwtAuthGuard),
  Roles(AuthRole.ADMIN),
);

function bindRoute(controller, method, ...decorators) {
  const descriptor = Object.getOwnPropertyDescriptor(
    controller.prototype,
    method,
  );
  for (const decorator of decorators) {
    decorator(controller.prototype, method, descriptor);
  }
  Req()(controller.prototype, method, 0);
}

function createDataSource(vendors, staff) {
  return {
    getRepository(entity) {
      const rows = entity === Negocio ? vendors : staff;
      assert.ok(entity === Negocio || entity === UsuarioBackoffice);
      return {
        createQueryBuilder() {
          const query = { field: 'whatsapp', value: '' };
          return {
            addSelect() {
              return this;
            },
            where(clause, params) {
              query.field = clause.includes('whatsapp') ? 'whatsapp' : 'email';
              query.value = params.identifier ?? params.email;
              return this;
            },
            async getOne() {
              return rows.find((row) => row[query.field] === query.value) ?? null;
            },
          };
        },
        async findOne({ where }) {
          return rows.find((row) => row.id === where.id) ?? null;
        },
      };
    },
  };
}

async function main() {
  const originalVerify = passwordUtil.verifyPassword;
  const originalDummy = passwordUtil.dummyPasswordHash;
  const comparisons = [];
  passwordUtil.verifyPassword = async (plain, hash) => {
    comparisons.push({ plain, hash });
    return plain === 'Password123' && hash === STORED_HASH;
  };
  passwordUtil.dummyPasswordHash = async () => DUMMY_HASH;

  const vendors = [
    vendor({
      id: 3,
      whatsapp: '71234567',
      email: 'maria@feria.bo',
      estado: EstadoNegocio.APROBADO,
    }),
    vendor({
      id: 4,
      whatsapp: '71234568',
      email: null,
      estado: EstadoNegocio.SUSPENDIDO,
    }),
    vendor({
      id: 5,
      whatsapp: '71234569',
      email: 'pendiente@feria.bo',
      estado: EstadoNegocio.PENDIENTE_VALIDACION,
    }),
    vendor({
      id: 6,
      whatsapp: '71234560',
      email: null,
      estado: EstadoNegocio.RECHAZADO,
      motivo_rechazo: 'El número de puesto no coincide con el plano.',
    }),
  ];
  const staff = [
    {
      id: 1,
      nombre: 'Ada Admin',
      email: 'ada@feria.bo',
      rol: RolBackoffice.ADMIN,
      password_hash: STORED_HASH,
    },
    {
      id: 2,
      nombre: 'Omar Operador',
      email: 'omar@feria.bo',
      rol: RolBackoffice.OPERADOR,
      password_hash: STORED_HASH,
    },
  ];
  const jwt = new JwtService({
    secret: 'phase2-auth-test-secret',
    signOptions: { expiresIn: '1h' },
  });
  const service = new AuthService(createDataSource(vendors, staff), jwt);

  try {
    await assertLogins(service, jwt, comparisons);
    await assertPrincipal(service, jwt, vendors, staff);
    await assertHttp(service, jwt, vendors, staff);
  } finally {
    passwordUtil.verifyPassword = originalVerify;
    passwordUtil.dummyPasswordHash = originalDummy;
  }

  console.log('Fase 2, tareas 5 a 9: comprobación correcta.');
}

function vendor({ id, whatsapp, email, estado, motivo_rechazo = null }) {
  return {
    id,
    nombre: 'Novedades María',
    whatsapp,
    email,
    password_hash: STORED_HASH,
    estado,
    motivo_rechazo,
  };
}

async function assertLogins(service, jwt, comparisons) {
  const approved = await service.loginVendor({
    login_identifier: '71234567',
    password: 'Password123',
  });
  assert.equal(approved.token_type, 'Bearer');
  assert.deepEqual(approved.user, {
    id: 3,
    name: 'Novedades María',
    status: 'APROBADO',
    role: 'VENDOR',
  });
  assert.equal(Object.hasOwn(approved, 'password_hash'), false);
  const vendorPayload = jwt.verify(approved.access_token);
  assert.equal(vendorPayload.sub, 3);
  assert.equal(vendorPayload.role, 'VENDOR');
  assert.equal(vendorPayload.password, undefined);
  assert.equal(vendorPayload.password_hash, undefined);

  const byEmail = await service.loginVendor({
    login_identifier: 'maria@feria.bo',
    password: 'Password123',
  });
  assert.equal(jwt.verify(byEmail.access_token).sub, 3);

  comparisons.length = 0;
  await assert.rejects(
    () =>
      service.loginVendor({
        login_identifier: '71234568',
        password: 'ClaveMala1',
      }),
    (error) => {
      assert.equal(error.getStatus(), 401);
      assert.equal(error.getResponse().error, INVALID_CREDENTIALS_CODE);
      assert.equal(error.getResponse().message, INVALID_CREDENTIALS_MESSAGE);
      return true;
    },
  );
  assert.deepEqual(comparisons, [{ plain: 'ClaveMala1', hash: STORED_HASH }]);

  await assert.rejects(
    () =>
      service.loginVendor({
        login_identifier: '71234569',
        password: 'Password123',
      }),
    (error) => {
      assert.equal(error.getStatus(), 403);
      assert.equal(error.getResponse().error, ACCOUNT_PENDING_APPROVAL);
      assert.equal(error.getResponse().message, ACCOUNT_PENDING_MESSAGE);
      assert.equal(Object.hasOwn(error.getResponse(), 'rejection_reason'), false);
      return true;
    },
  );

  await assert.rejects(
    () =>
      service.loginVendor({
        login_identifier: '71234560',
        password: 'Password123',
      }),
    (error) => {
      assert.equal(error.getStatus(), 403);
      assert.equal(error.getResponse().error, ACCOUNT_REJECTED);
      assert.equal(error.getResponse().message, ACCOUNT_REJECTED_MESSAGE);
      assert.equal(
        error.getResponse().rejection_reason,
        'El número de puesto no coincide con el plano.',
      );
      return true;
    },
  );

  await assert.rejects(
    () =>
      service.loginVendor({
        login_identifier: '71234568',
        password: 'Password123',
      }),
    (error) => {
      assert.equal(error.getStatus(), 403);
      assert.equal(error.getResponse().error, ACCOUNT_SUSPENDED);
      return true;
    },
  );

  comparisons.length = 0;
  await assert.rejects(
    () =>
      service.loginVendor({
        login_identifier: '70000000',
        password: 'Password123',
      }),
    (error) => {
      assert.equal(error.getStatus(), 401);
      assert.equal(error.getResponse().error, INVALID_CREDENTIALS_CODE);
      return true;
    },
  );
  assert.deepEqual(comparisons, [{ plain: 'Password123', hash: DUMMY_HASH }]);

  const admin = await service.loginAdmin({
    email: 'ada@feria.bo',
    password: 'Password123',
  });
  assert.equal(admin.user.role, 'ADMIN');
  assert.equal(jwt.verify(admin.access_token).sub, 1);
  assert.equal(jwt.verify(admin.access_token).role, 'ADMIN');

  const operador = await service.loginAdmin({
    email: 'omar@feria.bo',
    password: 'Password123',
  });
  assert.equal(operador.user.role, 'OPERADOR');
  assert.equal(jwt.verify(operador.access_token).role, 'OPERADOR');

  await assert.rejects(
    () =>
      service.loginAdmin({
        email: 'ada@feria.bo',
        password: 'ClaveMala1',
      }),
    (error) => error.getStatus() === 401,
  );
}

async function assertPrincipal(service, jwt, vendors, staff) {
  const token = jwt.sign({ sub: 3, role: AuthRole.VENDOR });
  const principal = await service.loadAuthenticatedPrincipal(jwt.verify(token));
  assert.deepEqual(principal, {
    id: 3,
    role: 'VENDOR',
    name: 'Novedades María',
    status: 'APROBADO',
  });

  vendors[0].estado = EstadoNegocio.SUSPENDIDO;
  await assert.rejects(
    () => service.loadAuthenticatedPrincipal(jwt.verify(token)),
    (error) => {
      assert.equal(error.getStatus(), 403);
      assert.equal(error.getResponse().error, ACCOUNT_SUSPENDED);
      assert.equal(error.getResponse().message, ACCOUNT_SUSPENDED_MESSAGE);
      return true;
    },
  );
  vendors[0].estado = EstadoNegocio.APROBADO;

  await assert.rejects(
    () => service.loadAuthenticatedPrincipal({ sub: 99, role: AuthRole.VENDOR }),
    (error) => error.getStatus() === 401,
  );

  const adminToken = jwt.sign({ sub: 1, role: AuthRole.ADMIN });
  staff[0].rol = RolBackoffice.OPERADOR;
  await assert.rejects(
    () => service.loadAuthenticatedPrincipal(jwt.verify(adminToken)),
    (error) => {
      assert.equal(error.getStatus(), 401);
      assert.equal(error.getResponse().message, UNAUTHORIZED_MESSAGE);
      return true;
    },
  );
  staff[0].rol = RolBackoffice.ADMIN;

  await assert.rejects(
    () => service.loadAuthenticatedPrincipal({ sub: 'no', role: 'VENDOR' }),
    (error) => error.getStatus() === 401,
  );
}

async function assertHttp(service, jwt, vendors) {
  const moduleRef = await Test.createTestingModule({
    controllers: [AuthController, AdminAuthController, SessionController],
    providers: [
      { provide: AuthService, useValue: service },
      { provide: JwtService, useValue: jwt },
      JwtAuthGuard,
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  configureApp(app);
  await app.init();

  try {
    const approved = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ login_identifier: ' 71234567 ', password: 'Password123' });
    assert.equal(approved.status, 200);
    assert.equal(approved.body.token_type, 'Bearer');
    assert.equal(approved.body.user.role, 'VENDOR');
    assert.equal(approved.body.password_hash, undefined);
    const token = approved.body.access_token;

    const invalid = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ login_identifier: '123', password: 'Password123', role: 'ADMIN' });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error, 'VALIDATION_ERROR');
    assert.ok(invalid.body.details.some((detail) => detail.field === 'login_identifier'));
    assert.ok(
      invalid.body.details.some(
        (detail) =>
          detail.field === 'role' &&
          detail.message === 'Este campo no está permitido.',
      ),
    );

    const pending = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ login_identifier: '71234569', password: 'Password123' });
    assert.equal(pending.status, 403);
    assert.equal(pending.body.error, ACCOUNT_PENDING_APPROVAL);
    assert.equal(Object.hasOwn(pending.body, 'rejection_reason'), false);
    assert.deepEqual(pending.body.details, []);

    const rejected = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ login_identifier: '71234560', password: 'Password123' });
    assert.equal(rejected.status, 403);
    assert.equal(rejected.body.error, ACCOUNT_REJECTED);
    assert.equal(
      rejected.body.rejection_reason,
      'El número de puesto no coincide con el plano.',
    );

    const admin = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ email: 'ada@feria.bo', password: 'Password123' });
    assert.equal(admin.status, 200);
    assert.equal(admin.body.user.role, 'ADMIN');
    assert.equal(jwt.verify(admin.body.access_token).role, 'ADMIN');

    const session = await request(app.getHttpServer())
      .get('/api/v1/session')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(session.status, 200);
    assert.deepEqual(session.body, {
      id: 3,
      role: 'VENDOR',
      name: 'Novedades María',
      status: 'APROBADO',
    });

    const missing = await request(app.getHttpServer()).get('/api/v1/session');
    assert.equal(missing.status, 401);
    assert.equal(missing.body.error, 'UNAUTHORIZED');
    assert.equal(missing.body.message, UNAUTHORIZED_MESSAGE);

    const forged = await request(app.getHttpServer())
      .get('/api/v1/session')
      .set('Authorization', 'Bearer no-es-un-jwt');
    assert.equal(forged.status, 401);

    vendors[0].estado = EstadoNegocio.SUSPENDIDO;
    const suspended = await request(app.getHttpServer())
      .get('/api/v1/session')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(suspended.status, 403);
    assert.equal(suspended.body.error, ACCOUNT_SUSPENDED);
    vendors[0].estado = EstadoNegocio.APROBADO;

    const vendorOnAdmin = await request(app.getHttpServer())
      .get('/api/v1/session/admin')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(vendorOnAdmin.status, 403);
    assert.equal(vendorOnAdmin.body.error, 'FORBIDDEN');
    assert.equal(vendorOnAdmin.body.message, FORBIDDEN_ROLE_MESSAGE);

    const adminSession = await request(app.getHttpServer())
      .get('/api/v1/session/admin')
      .set('Authorization', `Bearer ${admin.body.access_token}`);
    assert.equal(adminSession.status, 200);
    assert.deepEqual(adminSession.body, { id: 1, role: 'ADMIN' });
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
