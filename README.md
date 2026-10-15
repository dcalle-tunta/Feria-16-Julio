# Feria 16 de Julio

El backend NestJS está en `backend-feria16`. El esquema físico (InnoDB, `utf8mb4`, timestamps en UTC) es `docs/schema.sql`.

## Entorno

Copia `backend-feria16/.env.example` a `backend-feria16/.env` y completa los valores en tu máquina. Ese archivo no se versiona.

Variables: `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `JWT_SECRET`, `JWT_EXPIRES_IN` (si se omite, queda `12h`), `AI_API_KEY`, `AI_MODEL` y `AI_BASE_URL` (si se omite, queda `https://api.openai.com/v1`; el endpoint debe exponer `/chat/completions`).

## synchronize

TypeORM enciende `synchronize` solo cuando `NODE_ENV=development`. Con `test`, `production` o cualquier otro valor queda apagado, para no reescribir tablas fuera de desarrollo.

Las tablas se crean ejecutando `docs/schema.sql` sobre una base vacía:

```bash
cd backend-feria16
npm install
npm run db:schema
```
