/**
 * Comprueba el ValidationPipe, el sobre de error y el snake_case
 * sin levantar MySQL. Requiere `npm run build` antes.
 */
require('reflect-metadata');

const assert = require('node:assert/strict');
const {
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Post,
} = require('@nestjs/common');
const { Test } = require('@nestjs/testing');
const { IsNotEmpty, IsString } = require('class-validator');
const request = require('supertest');
const { configureApp } = require('../dist/configure-app');
const {
  hashPassword,
  BCRYPT_COST,
} = require('../dist/common/security/password.util');
const {
  countWords,
  exceedsCharacterLimit,
} = require('../dist/common/text/text.util');
const { redactForLog } = require('../dist/common/logging/redact-sensitive');
const { RedactingLogger } = require('../dist/common/logging/redacting-logger');

const HASH = `$2b$12$${ 'a'.repeat(53) }`;

class ProbeDto {}

IsString()(ProbeDto.prototype, 'name');
IsNotEmpty()(ProbeDto.prototype, 'name');

class ProbeController {
  create(body) {
    return {
      receivedName: body.name,
      createdAt: new Date('2026-10-12T16:00:00.000Z'),
    };
  }

  secret() {
    return { id: 1, password_hash: 'no-debe-salir', name: 'Puesto' };
  }

  missing() {
    throw new NotFoundException('No encontrado.');
  }

  crash() {
    throw new Error(`fallo ${HASH}`);
  }
}

Controller('probe')(ProbeController);
decorateMethod(Post(), ProbeController, 'create');
Body()(ProbeController.prototype, 'create', 0);
Reflect.defineMetadata(
  'design:paramtypes',
  [ProbeDto],
  ProbeController.prototype,
  'create',
);
decorateMethod(Get('secret'), ProbeController, 'secret');
decorateMethod(Get('missing'), ProbeController, 'missing');
decorateMethod(Get('crash'), ProbeController, 'crash');

function decorateMethod(decorator, target, property) {
  const descriptor = Object.getOwnPropertyDescriptor(target.prototype, property);
  decorator(target.prototype, property, descriptor);
}

async function main() {
  assert.equal(countWords('  busco   una chamarra  '), 3);
  assert.equal(countWords('   '), 0);
  assert.equal(exceedsCharacterLimit('a'.repeat(2001), 'chat'), true);
  assert.equal(exceedsCharacterLimit('a'.repeat(300), 'search'), false);
  assert.equal(BCRYPT_COST, 12);

  const hashed = await hashPassword('Password123');
  assert.ok(hashed.startsWith('$2a$12$') || hashed.startsWith('$2b$12$'));

  const redacted = redactForLog({ password_hash: HASH, nombre: 'Ana' });
  assert.equal(redacted.password_hash, '[REDACTED]');
  assert.equal(JSON.stringify(redacted).includes(HASH), false);
  assertNoHashInLogs();

  const moduleRef = await Test.createTestingModule({
    controllers: [ProbeController],
  }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  const errorSpy = capture(Logger.prototype, 'error');
  await app.init();

  try {
    const rejected = await request(app.getHttpServer()).post('/probe').send({
      name: 'Puesto',
      status: 'APROBADO',
      password_hash: 'no-debe-entrar',
      role: 'ADMIN',
    });
    assert.equal(rejected.status, 400);
    assert.equal(rejected.body.error, 'VALIDATION_ERROR');
    assert.deepEqual(
      rejected.body.details.map((detail) => detail.field).sort(),
      ['password_hash', 'role', 'status'],
    );
    assert.ok(
      rejected.body.details.every(
        (detail) => detail.message === 'Este campo no está permitido.',
      ),
    );
    assert.match(
      rejected.body.timestamp,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/,
    );
    assert.equal(JSON.stringify(rejected.body).includes('no-debe-entrar'), false);

    const created = await request(app.getHttpServer())
      .post('/probe')
      .send({ name: 'Puesto' });
    assert.equal(created.status, 201);
    assert.deepEqual(created.body, {
      received_name: 'Puesto',
      created_at: '2026-10-12T16:00:00Z',
    });

    const secret = await request(app.getHttpServer()).get('/probe/secret');
    assert.equal(secret.status, 200);
    assert.deepEqual(secret.body, { id: 1, name: 'Puesto' });

    const missing = await request(app.getHttpServer()).get('/probe/missing');
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error, 'NOT_FOUND');
    assert.deepEqual(missing.body.details, []);

    const crash = await request(app.getHttpServer()).get('/probe/crash');
    assert.equal(crash.status, 500);
    assert.equal(crash.body.error, 'INTERNAL_SERVER_ERROR');
    assert.equal(crash.body.message, 'Ocurrió un error interno.');
    assert.deepEqual(crash.body.details, []);
    assert.equal(JSON.stringify(crash.body).includes(HASH), false);

    const logged = errorSpy.calls
      .map((call) =>
        call
          .map((arg) =>
            arg instanceof Error
              ? `${arg.message}\n${arg.stack ?? ''}`
              : JSON.stringify(arg),
          )
          .join(' '),
      )
      .join('\n');
    assert.equal(logged.includes(HASH), false);
  } finally {
    errorSpy.restore();
    await app.close();
  }

  console.log('Fase 1, tareas 7 a 10: comprobación correcta.');
}

function assertNoHashInLogs() {
  const written = [];
  const stdout = process.stdout.write;
  const stderr = process.stderr.write;
  const captureWrite = (chunk) => {
    written.push(String(chunk));
    return true;
  };
  process.stdout.write = captureWrite;
  process.stderr.write = captureWrite;

  try {
    const logger = new RedactingLogger();
    logger.log({ nombre: 'Ana', password_hash: HASH });
    logger.error(new Error(`fallo ${HASH}`));
  } finally {
    process.stdout.write = stdout;
    process.stderr.write = stderr;
  }

  const output = written.join('\n');
  assert.equal(output.includes(HASH), false);
  assert.equal(output.includes('Ana'), true);
  assert.equal(output.includes('[REDACTED]'), true);
}

function capture(object, methodName) {
  const original = object[methodName];
  const calls = [];
  object[methodName] = function mocked(...args) {
    calls.push(args);
  };
  return {
    calls,
    restore() {
      object[methodName] = original;
    },
  };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
