import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(scriptDir, '../../docs/schema.sql');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Falta ${name}. Copia backend-feria16/.env.example a backend-feria16/.env y complétalo.`,
    );
  }
  return value;
}

async function main() {
  const host = requireEnv('DB_HOST');
  const user = requireEnv('DB_USERNAME');
  const database = requireEnv('DB_DATABASE');
  const password = process.env.DB_PASSWORD ?? '';
  const port = Number(process.env.DB_PORT ?? 3306);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT tiene que ser un puerto entre 1 y 65535.');
  }

  if (!/^[A-Za-z0-9_]+$/.test(database)) {
    throw new Error(
      'DB_DATABASE solo puede contener letras, números y guion bajo.',
    );
  }

  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true,
    charset: 'utf8mb4',
    timezone: 'Z',
  });

  try {
    await connection.query("SET time_zone = '+00:00'");
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await connection.query(`USE \`${database}\``);

    const [rows] = await connection.query(
      'SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = ?',
      [database],
    );
    const total = Number(rows[0].total);

    if (total > 0) {
      throw new Error(
        `La base "${database}" no está vacía (${total} tablas). schema.sql solo se ejecuta sobre una base vacía.`,
      );
    }

    await connection.query(schemaSql);
    console.log(
      `schema.sql aplicado en "${database}" (InnoDB, utf8mb4, sesión en UTC).`,
    );
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
