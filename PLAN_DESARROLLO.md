# Plan de desarrollo del backend — Feria 16 de Julio

Lista de trabajo para construir el backend completo en NestJS. Las tareas están ordenadas por dependencias: primero la base de datos y las entidades, después la autenticación, después el catálogo de productos, el panel del comerciante y, al final, el backoffice y el chat.

Fuente de verdad: [docs/backend_requirements_spec.md](docs/backend_requirements_spec.md) y [docs/schema.sql](docs/schema.sql). Si un campo de la spec y una columna del SQL discrepan, manda el SQL.

Stack: NestJS, TypeORM, class-validator, class-transformer, MySQL 8, bcrypt (cost 12), JWT.

Módulos previstos: `AuthModule`, `CatalogModule`, `ChatModule`, `VendorModule`, `AdminModule`.

Fuera de esta versión (no entra en las tareas): recuperación de contraseña, subida binaria de archivos (las imágenes son URLs `http`/`https`), pagos y conversión BOB/USD.

---

## Fase 1 — Base de datos, entidades e infraestructura

Sin esta fase no hay módulo de negocio. El resto del backend depende de las entidades, del filtro de errores y de la validación global.

- [x] Crear el proyecto NestJS e instalar TypeORM, el driver de MySQL, `class-validator`, `class-transformer`, `@nestjs/config`, `@nestjs/jwt`, `bcrypt` y los tipos de desarrollo.
- [x] Configurar `ConfigModule` y las variables de entorno, sin valores secretos en el repositorio: `JWT_SECRET`, `JWT_EXPIRES_IN` (por defecto `12h`), `AI_API_KEY`, `AI_MODEL` y la conexión MySQL.
- [x] Conectar TypeORM a MySQL 8 (InnoDB, `utf8mb4`, timestamps en UTC). Ejecutar [docs/schema.sql](docs/schema.sql) sobre una base vacía. Dejar `synchronize` apagado fuera de desarrollo (ver [README.md](README.md)).
- [x] Crear las entidades y relaciones de las 11 tablas: `usuarios_backoffice`, `configuraciones_sistema`, `categorias`, `dias_semana`, `negocios`, `negocio_dias_atencion`, `productos_servicios`, `producto_imagenes`, `sesiones_usuario`, `consultas`, `consulta_negocios_sugeridos`.
- [x] Mapear enums y checks del SQL: estados del negocio (`PENDIENTE_VALIDACION`, `APROBADO`, `RECHAZADO`, `SUSPENDIDO`), moneda `BOB`/`USD`, tipo `PRODUCTO`/`SERVICIO`, disponibilidad `DISPONIBLE`/`AGOTADO`, roles de backoffice `ADMIN`/`OPERADOR`, WhatsApp `^[67]\d{7}$`, latitud -90 a 90, longitud -180 a 180, y `terminos_aceptados` solo en `1`.
- [x] Cargar la semilla del SQL: 3 filas de `configuraciones_sistema` (`MAX_CONSULTAS_SESION` = 20, `TIEMPO_BLOQUEO_MINUTOS` = 60, `MAX_NEGOCIOS_SUGERIDOS` = 5), 4 categorías y 3 días (`JUEVES`, `DOMINGO`, `OTROS`).
- [x] Registrar un `ValidationPipe` global con `whitelist` y `forbidNonWhitelisted`, para rechazar `status`, `password_hash` o `role` colados en el body.
- [x] Implementar el filtro de excepciones con el sobre `{ error, message, details, timestamp }`. `details` va vacío cuando el error no es de un campo. Timestamps de respuesta en ISO-8601 UTC. JSON de la API en `snake_case`.
- [x] Asegurar que `password_hash` nunca se selecciona en respuestas ni se escribe en logs.
- [x] Extraer utilidades compartidas: conteo de palabras (`trim`, partir por `/\s+/`, contar trozos no vacíos), tope de caracteres (chat 2000, búsqueda 300) y hash de contraseña con bcrypt cost 12.

## Fase 2 — Catálogos públicos y autenticación

Depende de la fase 1: categorías, días de atención, `negocios` y `usuarios_backoffice`.

- [x] `GET /api/v1/categories`: devolver solo categorías con `activo = 1` (`id`, `name`, `slug`). Sin CRUD público de catálogos.
- [x] `GET /api/v1/opening-days`: devolver `JUEVES`, `DOMINGO` y `OTROS` (`code`, `name`).
- [x] `POST /api/v1/auth/register`: alta del comerciante en un solo POST. El servidor asigna `PENDIENTE_VALIDACION`. Exigir al menos un día en `negocio_dias_atencion`, `terms_accepted === true` (guardar `terminos_aceptados_en`), password de 8 a 72 caracteres con al menos una letra y un número, y email vacío como `NULL`. Nombre de 3 a 50, descripción corta opcional (máx. 200), logo URL opcional, sector y pasillo de 1 a 100, coordenadas obligatorias. WhatsApp exactamente 8 dígitos que inician en 6 o 7, único, sin prefijo `591`.
- [x] Respuestas del registro: **201** con `id`, `status` y el mensaje de validación; **409** `DUPLICATE_CONTACT` si el WhatsApp o el correo ya existen; **400** de validación con `details` por campo.
- [x] `POST /api/v1/auth/login`: `login_identifier` es el WhatsApp de 8 dígitos o el email. Comparar la contraseña primero. Si no coincide, responder siempre **401** `INVALID_CREDENTIALS`, también cuando el estado no es `APROBADO`.
- [x] Si la contraseña coincide: `APROBADO` → **200** con `access_token`, `token_type` `Bearer` y `user` (`id`, `name`, `status`, `role` = `VENDOR`); `PENDIENTE_VALIDACION` → **403** `ACCOUNT_PENDING_APPROVAL`; `RECHAZADO` → **403** `ACCOUNT_REJECTED` con `rejection_reason`; `SUSPENDIDO` → **403** `ACCOUNT_SUSPENDED`.
- [x] `POST /api/v1/admin/auth/login`: email y password de `usuarios_backoffice`. **200** con JWT de `role` `ADMIN` u `OPERADOR`. **401** si no coincide. Sin auto-registro; la primera fila se inserta en operación.
- [x] Emitir JWT con `sub` (id) y `role` (`VENDOR`, `ADMIN` u `OPERADOR`). `sub` se busca en `negocios` o en `usuarios_backoffice` según el rol.
- [x] Guard de rutas autenticadas que vuelve a leer el estado en la base en cada petición. Un token viejo no autoriza a un negocio que ya no está `APROBADO`.

## Fase 3 — Catálogo público y búsqueda de productos

Depende de la fase 1 (negocios `APROBADO`, productos e imágenes). El alta de productos la hace el comerciante en la fase 4; esta fase solo expone la lectura pública.

- [x] `GET /api/v1/products/search` con query `q`, `price_min`, `price_max`, `currency` (`BOB`|`USD`), `days` (códigos repetibles), `sort_by` (`RELEVANCE` por defecto, `PRICE_ASC`, `PRICE_DESC`, `NEWEST`), `page` y `limit`.
- [x] Validar `q`: obligatorio, de 1 a 30 palabras y como máximo 300 caracteres. Vacío → **400** "Ingrese un término para buscar." Más de 30 palabras → **400** "El texto de búsqueda no debe superar las 30 palabras."
- [x] Validar precios: `0 <= price_min <= price_max` cuando ambos vienen. Cada extremo suelto solo exige `>= 0`. Si `price_min > price_max` → **400** "El precio mínimo no puede ser mayor al precio máximo."
- [x] Aplicar un filtro o un orden por precio dentro de una sola moneda. Si falta `currency` en ese caso, usar `BOB` y excluir la otra moneda. `RELEVANCE` y `NEWEST` sin filtro de precio devuelven `BOB` y `USD`.
- [x] Filtrar `days` por unión: el puesto atiende al menos uno de los códigos enviados.
- [x] Restringir el catálogo público a negocios `APROBADO` y productos con `activo = 1`. `AGOTADO` sí se muestra.
- [x] Orden `RELEVANCE` con los índices `FULLTEXT` de producto (`titulo`, `descripcion`) y de negocio (`nombre`, `descripcion_corta`). MySQL ignora tokens de menos de 3 caracteres; en ese caso completar con `LIKE`.
- [x] Paginar: `page` por defecto 1, `limit` por defecto 10 y máximo 50. Responder `total_results`, `page`, `limit`, `total_pages` y `data`.
- [x] Armar el puesto embebido con el teléfono de 8 dígitos. `whatsapp_url` = `https://wa.me/591{whatsapp}?text=` más el texto "Hola, me interesa el producto {titulo} que vi en Feria 16." `google_maps_url` con la latitud y la longitud guardadas. Esas URLs no se persisten.
- [x] `image_url` es la imagen de menor `orden`, o `null`.
- [x] `GET /api/v1/products/:id`: la misma ficha, más `images` (URLs ordenadas) y `type`. **404** `PRODUCT_NOT_FOUND` si no existe, si `activo = 0` o si el negocio no está `APROBADO`.

## Fase 4 — Panel del comerciante

Depende de la fase 2 (JWT `VENDOR` y negocio todavía `APROBADO` en la base) y de las entidades de producto de la fase 1. Un producto de otro puesto responde **404**.

- [x] `GET /api/v1/vendor/me`: perfil sin `password_hash` (nombre, categoría, descripción, logo, teléfono, email, sector, pasillo, coordenadas, días y estado).
- [x] `PATCH /api/v1/vendor/me`: permitir cambiar descripción, logo, email, teléfono, sector, pasillo, coordenadas, días y contraseña. El cambio de contraseña exige `current_password` y `new_password` con las mismas reglas del alta. No puede cambiar `estado` ni `categoria_id`. Teléfono y email siguen siendo únicos (**409**).
- [x] `GET /api/v1/vendor/products`: listar los productos del puesto autenticado, incluidos `activo = 0` y `AGOTADO`.
- [x] `POST /api/v1/vendor/products`: crear con `title` (1 a 150), `description` opcional, `price` `>= 0`, `currency` (`BOB` por defecto o `USD`), `type` (`PRODUCTO` por defecto o `SERVICIO`), `availability_status` (`DISPONIBLE` por defecto o `AGOTADO`) e `image_urls` (0 a 8 URLs `http`/`https`). `orden` único por producto, desde 1. Responder **201**. El producto hereda el rubro del negocio; no lleva categoría propia.
- [x] `PATCH /api/v1/vendor/products/:id`: actualizar esos campos. Si viene `image_urls`, reemplazar la galería completa.
- [x] `DELETE /api/v1/vendor/products/:id`: poner `activo = 0` y responder **200**. No borrar la fila.

## Fase 5 — Backoffice y chat de recomendaciones

Depende de la fase 2 (login de backoffice y guards por rol), de la máquina de estados de `negocios` y del catálogo aprobado de la fase 3 (`FULLTEXT`, categorías y `configuraciones_sistema`).

### Revisión de puestos

- [x] `GET /api/v1/admin/vendors`: listar sin `password_hash`, con `status` opcional y paginación `page`/`limit`. Tanto `ADMIN` como `OPERADOR` pueden revisar puestos.
- [x] `PATCH /api/v1/admin/vendors/:id/status` con el body `{ status, rejection_reason }`. `rejection_reason` es obligatorio solo para `RECHAZADO` (3 a 255 caracteres). **404** si el negocio no existe. **409** `INVALID_STATUS_TRANSITION` si la transición no está permitida.
- [x] Implementar solo estas transiciones: `PENDIENTE_VALIDACION` → `APROBADO` o `RECHAZADO`; `RECHAZADO` → `PENDIENTE_VALIDACION` (reabre el caso y limpia `motivo_rechazo`); `APROBADO` → `SUSPENDIDO`; `SUSPENDIDO` → `APROBADO` (conserva `fecha_aprobacion`).
- [x] La primera vez que el estado pasa a `APROBADO`, completar `aprobado_por_id` y `fecha_aprobacion`.

### Chat

- [x] Emitir la cookie `feria_sid` (`HttpOnly`, `SameSite=Lax`, `Path=/`) con el `id` de `sesiones_usuario`. Una cookie desconocida se descarta y se emite otra. Guardar IP y user-agent solo para auditoría: no son la clave del límite.
- [x] Leer `MAX_CONSULTAS_SESION`, `TIEMPO_BLOQUEO_MINUTOS` y `MAX_NEGOCIOS_SUGERIDOS` de `configuraciones_sistema`. Si falta una fila, usar 20, 60 y 5.
- [x] `POST /api/v1/chat/recommend` con `prompt` y `category_id` opcional. Rechazar más de 100 palabras (**422** `WORD_LIMIT_EXCEEDED`) o más de 2000 caracteres. Si `category_id` viene y no existe o está inactiva: **400** `INVALID_CATEGORY`, sin consumir cupo.
- [x] Cupo por cookie. Si `bloqueado_hasta` es futuro, responder **429** `RATE_LIMIT_EXCEEDED` (con `retry_after_seconds` y cabecera `Retry-After`) y no incrementar el contador. Si el bloqueo ya venció, `consultas_realizadas` vuelve a 0. Un prompt que se procesa (éxito, sin resultados o fuera de contexto) incrementa el contador. Al llegar al máximo, la siguiente petición fija `bloqueado_hasta = ahora + TIEMPO_BLOQUEO_MINUTOS` y responde **429** sin llamar al modelo. Un **422** o un **400** de validación de campo no consume cupo.
- [x] Si el texto no va de productos, servicios o puestos de la feria, responder **400** `OUT_OF_CONTEXT` (este caso sí consume cupo).
- [x] Armar candidatos solo con negocios `APROBADO`, categoría opcional y texto contra el `FULLTEXT` de productos y de negocios. Si no hay candidatos, responder **200** `no_results` con el mensaje fijo y no llamar al modelo.
- [x] Si hay candidatos, el modelo solo puede citar ids de esa lista; descartar cualquier id ajeno. Rellenar `recommended_vendors` con filas de `negocios` (`id`, `name`, `sector`, `logo_url`), como máximo `MAX_NEGOCIOS_SUGERIDOS`.
- [x] Persistir cada consulta procesada en `consultas` y los puestos citados, en el orden devuelto, en `consulta_negocios_sugeridos`.
