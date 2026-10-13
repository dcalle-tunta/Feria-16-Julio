# Especificación de Requerimientos Backend - Aplicación Feria 16 de Julio

Contrato del backend de la **Feria 16 de Julio** (El Alto / La Paz, Bolivia). El modelo físico normativo está en [schema.sql](schema.sql). Si un campo de este documento y una columna del SQL discrepan, manda el SQL y este archivo se corrige para igualarlo.

Stack previsto: NestJS, class-validator, class-transformer, MySQL 8, contraseñas con bcrypt.

---

## 1. Convenciones

- IDs públicos numéricos (`INT UNSIGNED`). No son UUID.
- JSON de la API en `snake_case`.
- Timestamps de respuesta en ISO-8601 UTC.
- Moneda persistida con código ISO: `BOB` o `USD`. La etiqueta visual "BS" del cliente corresponde a `BOB` y no se guarda.
- Días de atención: códigos `JUEVES`, `DOMINGO`, `OTROS`.
- Un puesto tiene un solo rubro (`negocios.categoria_id`). Los productos heredan ese rubro; no llevan categoría propia.
- El registro de dos pasos es del cliente. La API recibe el alta completa en un solo `POST`.
- `password_hash` se genera con bcrypt (cost 12). No se descifra: el login compara el texto con el hash. Nunca se selecciona en respuestas ni en logs.
- El token JWT lleva `sub` (id) y `role` (`VENDOR`, `ADMIN` u `OPERADOR`). `sub` se busca en `negocios` o en `usuarios_backoffice` según `role`. En cada ruta autenticada se vuelve a leer el estado en la base; un token viejo no autoriza a un negocio suspendido.
- Variables de entorno, sin valores en el repositorio: `JWT_SECRET`, `JWT_EXPIRES_IN` (por defecto `12h`), `AI_API_KEY`, `AI_MODEL`, y la conexión MySQL.
- Catálogo público y chat solo usan negocios `APROBADO` y productos con `activo = 1`. `AGOTADO` sí se muestra.
- Fuera de esta versión: recuperación de contraseña, subida binaria de archivos (las imágenes son URLs `http`/`https`), pagos y conversión BOB/USD.

### Sobre de error

Todo `4xx` y `5xx` usa este JSON. `details` va vacío cuando el error no es de un campo.

```json
{
  "error": "STRING_ERROR_CODE",
  "message": "Descripción amigable para el cliente",
  "details": [
    {
      "field": "phone",
      "message": "Ingresa un número de celular boliviano válido (8 dígitos)."
    }
  ],
  "timestamp": "2026-10-12T16:00:00Z"
}
```

Conteo de palabras, igual en chat y búsqueda: `trim`, partir por espacios (`/\s+/`) y contar los trozos no vacíos. El chat además rechaza más de 2000 caracteres; la búsqueda, más de 300.

---

## 2. Modelo

### 2.1. `negocios`

Cuenta del comerciante y datos del puesto.

| Columna | Regla |
| --- | --- |
| `categoria_id` | Obligatoria. Categoría activa existente. |
| `nombre` | 3 a 50 caracteres. |
| `descripcion_corta` | Opcional, máximo 200. |
| `logo_url` | Opcional, URL `http`/`https`, máximo 500. |
| `whatsapp` | Exactamente 8 dígitos, regex `^[67]\d{7}$`, único. Se guarda sin `591`. |
| `email` | Opcional. Si viene vacío se guarda `NULL`. Único si existe. |
| `password_hash` | Obligatoria. El alta recibe `password`: mínimo 8, máximo 72, al menos una letra y un número. |
| `sector`, `pasillo_puesto` | Obligatorios, 1 a 100 caracteres. |
| `latitud`, `longitud` | Obligatorias. Latitud -90 a 90, longitud -180 a 180. |
| `terminos_aceptados` | Solo se inserta en `1`, con `terminos_aceptados_en`. |
| `estado` | Lo asigna el servidor: `PENDIENTE_VALIDACION` al crear. |
| `motivo_rechazo` | Obligatorio cuando el backoffice pasa a `RECHAZADO`. |
| `aprobado_por_id`, `fecha_aprobacion` | Se completan la primera vez que el estado pasa a `APROBADO`. |

Transiciones que puede hacer el backoffice:

- `PENDIENTE_VALIDACION` → `APROBADO` o `RECHAZADO`
- `RECHAZADO` → `PENDIENTE_VALIDACION` (reabre el caso y limpia `motivo_rechazo`)
- `APROBADO` → `SUSPENDIDO`
- `SUSPENDIDO` → `APROBADO` (conserva `fecha_aprobacion`)

Alta pública: al menos un día en `negocio_dias_atencion`.

### 2.2. `productos_servicios` y `producto_imagenes`

| Columna | Regla |
| --- | --- |
| `negocio_id` | Obligatoria. El producto pertenece a un solo puesto. |
| `titulo` | Obligatorio, 1 a 150 caracteres. |
| `descripcion` | Opcional. |
| `precio` | Obligatorio, `>= 0`. |
| `moneda` | `BOB` (defecto) o `USD`. |
| `tipo` | `PRODUCTO` (defecto) o `SERVICIO`. |
| `estado_disponibilidad` | `DISPONIBLE` (defecto) o `AGOTADO`. |
| `activo` | `1` visible, `0` baja lógica. |
| `imagen_url` + `orden` | Cero a ocho URLs. `orden` único por producto, desde 1. |

### 2.3. Catálogos, chat y backoffice

- `categorias` y `dias_semana` salen del semillado de `schema.sql`. No hay CRUD público de esos catálogos.
- `sesiones_usuario` cuenta el cupo del chat. La clave `id` la emite el servidor en la cookie `feria_sid` (`HttpOnly`, `SameSite=Lax`, `Path=/`). Una cookie desconocida se descarta y se emite otra. La IP se guarda para auditoría y no es la clave del límite: la feria comparte red. Quien borre la cookie reinicia su cupo; es el límite por sesión pedido para esta versión.
- `consultas` y `consulta_negocios_sugeridos` guardan cada consulta que sí se procesó, en el orden devuelto.
- `configuraciones_sistema`: `MAX_CONSULTAS_SESION` (20), `TIEMPO_BLOQUEO_MINUTOS` (60), `MAX_NEGOCIOS_SUGERIDOS` (5). Si falta una fila, se usan esos mismos defaults.
- `usuarios_backoffice` es otra cuenta, con `rol` `ADMIN` u `OPERADOR`. No se auto-registra. La primera fila se inserta en operación.

---

## 3. Catálogos públicos

### `GET /api/v1/categories`

Categorías con `activo = 1`.

```json
{
  "data": [
    { "id": 1, "name": "Deportes", "slug": "deportes" }
  ]
}
```

### `GET /api/v1/opening-days`

```json
{
  "data": [
    { "code": "JUEVES", "name": "Jueves" },
    { "code": "DOMINGO", "name": "Domingo" },
    { "code": "OTROS", "name": "Otros" }
  ]
}
```

---

## 4. Chat de recomendaciones

### Reglas

1. El prompt no pasa de 100 palabras ni de 2000 caracteres.
2. Si el texto no va de productos, servicios o puestos de la feria, responder `400` `OUT_OF_CONTEXT`.
3. El modelo no inventa puestos. El backend arma la lista de candidatos (`APROBADO`, categoría opcional, texto contra el `FULLTEXT` de productos y de negocios). Si no hay candidatos, responde `no_results` y no llama al modelo. Si hay, el modelo solo puede citar ids de esa lista; cualquier id ajeno se descarta. La respuesta pública se rellena con filas de `negocios`.
4. Cupo por cookie `feria_sid`. Si `bloqueado_hasta` es futuro, `429` y no se incrementa el contador. Si el bloqueo ya venció, `consultas_realizadas` vuelve a 0. Un prompt que se procesa (éxito, sin resultados o fuera de contexto) incrementa el contador. Al llegar a `MAX_CONSULTAS_SESION`, la siguiente petición fija `bloqueado_hasta = ahora + TIEMPO_BLOQUEO_MINUTOS` y responde `429` sin llamar al modelo. Un `422` o un `400` de validación de campo no consume cupo.
5. Cada consulta procesada se inserta en `consultas`. Los puestos citados, en `consulta_negocios_sugeridos`, como máximo `MAX_NEGOCIOS_SUGERIDOS`.

### `POST /api/v1/chat/recommend`

```json
{
  "prompt": "busco una chamarra de cuero",
  "category_id": 1
}
```

`category_id` es opcional. Si viene y no existe o la categoría está inactiva: `400` `INVALID_CATEGORY`, sin consumir cupo.

Respuestas:

- **200** con recomendaciones:

```json
{
  "status": "success",
  "message": "Texto generado por la IA.",
  "recommended_vendors": [
    {
      "id": 4,
      "name": "Kevin Motors",
      "sector": "Sector Rieles",
      "logo_url": null
    }
  ]
}
```

- **200** sin coincidencias: `status` `no_results` y el mensaje "No se encontraron productos ni negocios relacionados con tu búsqueda en la feria."
- **400** `OUT_OF_CONTEXT`: "Tu consulta no está relacionada con los productos o comercios de la Feria 16 de Julio. Por favor, intenta con otra búsqueda."
- **422** `WORD_LIMIT_EXCEEDED`: "El mensaje no puede superar las 100 palabras."
- **429** `RATE_LIMIT_EXCEEDED`: "Se alcanzó el límite de usos, por favor espere antes de intentar nuevamente." Incluir `retry_after_seconds` y la cabecera `Retry-After`.

---

## 5. Catálogo y búsqueda

### Reglas

1. `q` es obligatorio, de 1 a 30 palabras.
2. Precios: `0 <= price_min <= price_max` cuando ambos vienen. Cada extremo suelto solo exige `>= 0`.
3. Un filtro o un orden por precio se aplica dentro de una sola moneda. Si falta `currency` en ese caso, se usa `BOB` y se excluye la otra moneda. `RELEVANCE` y `NEWEST` sin filtro de precio devuelven `BOB` y `USD`.
4. `days` usa unión: el puesto atiende al menos uno de los códigos enviados.
5. `RELEVANCE` usa los índices `FULLTEXT` de producto y de negocio (título, descripción, nombre y descripción corta). MySQL ignora tokens de menos de 3 caracteres; en ese caso el servicio completa con `LIKE`.
6. El puesto embebido incluye el teléfono de 8 dígitos. `whatsapp_url` se arma como `https://wa.me/591{whatsapp}?text={mensaje}` con el texto "Hola, me interesa el producto {titulo} que vi en Feria 16." `google_maps_url` se arma con la latitud y la longitud guardadas. Esas URLs no se persisten.
7. `page` por defecto 1. `limit` por defecto 10, máximo 50.

### `GET /api/v1/products/search`

Query: `q`, `price_min`, `price_max`, `currency` (`BOB`|`USD`), `days` (códigos repetibles), `sort_by` (`RELEVANCE` por defecto, `PRICE_ASC`, `PRICE_DESC`, `NEWEST`), `page`, `limit`.

- `q` vacío: `400`, "Ingrese un término para buscar."
- `q` de más de 30 palabras: `400`, "El texto de búsqueda no debe superar las 30 palabras."
- `price_min > price_max`: `400`, "El precio mínimo no puede ser mayor al precio máximo."

```json
{
  "total_results": 12,
  "page": 1,
  "limit": 10,
  "total_pages": 2,
  "data": [
    {
      "id": 15,
      "title": "Chamarra de cuero",
      "description": "Talle único, cuero vacuno.",
      "price": 150.0,
      "currency": "BOB",
      "availability_status": "DISPONIBLE",
      "image_url": null,
      "updated_at": "2026-10-01T12:00:00Z",
      "vendor": {
        "id": 3,
        "name": "Puesto de Doña Juana",
        "phone": "71234567",
        "sector": "Sector Rieles",
        "aisle_number": "Pasillo 4, Puesto 12",
        "latitude": -16.5,
        "longitude": -68.15,
        "whatsapp_url": "https://wa.me/59171234567?text=Hola%2C%20me%20interesa%20el%20producto%20Chamarra%20de%20cuero%20que%20vi%20en%20Feria%2016.",
        "google_maps_url": "https://www.google.com/maps/search/?api=1&query=-16.50000000,-68.15000000"
      }
    }
  ]
}
```

`image_url` es la imagen de menor `orden`, o `null`.

### `GET /api/v1/products/:id`

Misma ficha, más `images` (URLs ordenadas) y `type`. Sirve al modal de detalle. `404` `PRODUCT_NOT_FOUND` si no existe, si `activo = 0` o si el negocio no está `APROBADO`.

---

## 6. Registro y login del comerciante

### `POST /api/v1/auth/register`

```json
{
  "name": "Novedades María",
  "category_id": 1,
  "short_description": "Venta de ropa calientita",
  "phone": "71234567",
  "email": null,
  "opening_days": ["JUEVES", "DOMINGO"],
  "sector": "Sector Rieles",
  "aisle_number": "Pasillo 4, Puesto 12",
  "latitude": -16.4951,
  "longitude": -68.1623,
  "password": "Password123",
  "terms_accepted": true
}
```

El cliente no envía `status` ni `password_hash`. `terms_accepted` tiene que ser `true`. `opening_days` no puede ir vacío y cada código tiene que existir.

- **201**: `{ "id": 3, "status": "PENDIENTE_VALIDACION", "message": "¡Registro Recibido! Tu puesto ha sido enviado a validación con éxito." }`
- **409** `DUPLICATE_CONTACT`: "El número de WhatsApp o correo ingresado ya se encuentra registrado."
- **400** de validación, con `details` por campo.

### `POST /api/v1/auth/login`

```json
{
  "login_identifier": "71234567",
  "password": "Password123"
}
```

`login_identifier` es el WhatsApp de 8 dígitos o el email. Primero se compara la contraseña. Si no coincide, la respuesta es siempre **401** `INVALID_CREDENTIALS` ("Credenciales inválidas."), también cuando el estado no es `APROBADO`.

Si la contraseña coincide:

- `APROBADO`: **200** con `access_token`, `token_type` `Bearer` y `user` (`id`, `name`, `status`, `role` = `VENDOR`).
- `PENDIENTE_VALIDACION`: **403** `ACCOUNT_PENDING_APPROVAL`. Mensaje: "Tu registro se encuentra en proceso de revisión por nuestro equipo. Te notificaremos por WhatsApp en un máximo de 24 horas hábiles."
- `RECHAZADO`: **403** `ACCOUNT_REJECTED`, incluye `rejection_reason`.
- `SUSPENDIDO`: **403** `ACCOUNT_SUSPENDED`.

---

## 7. Panel del comerciante

Rutas con JWT `VENDOR` y negocio todavía `APROBADO` en la base. Un producto de otro puesto responde `404`.

### `GET /api/v1/vendor/me`

Perfil sin `password_hash`: nombre, categoría, descripción, logo, teléfono, email, sector, pasillo, coordenadas, días, estado.

### `PATCH /api/v1/vendor/me`

Puede cambiar descripción, logo, email, teléfono, sector, pasillo, coordenadas, días y contraseña. El cambio de contraseña exige `current_password` y `new_password` (mismas reglas del alta). No puede cambiar `estado` ni `categoria_id`. Teléfono y email siguen siendo únicos (`409`).

### Productos `/api/v1/vendor/products`

- `GET` lista los suyos, incluidos `activo = 0` y `AGOTADO`.
- `POST` crea. **201**. Body: `title`, `description`, `price`, `currency`, `type`, `availability_status`, `image_urls` (0 a 8).
- `PATCH /:id` actualiza esos campos. Si viene `image_urls`, reemplaza la galería.
- `DELETE /:id` pone `activo = 0`. **200**. No borra la fila.

---

## 8. Backoffice

`POST /api/v1/admin/auth/login` con `email` y `password`. **200** con JWT `ADMIN` u `OPERADOR`. **401** si no coincide. Ambos roles revisan puestos.

- `GET /api/v1/admin/vendors?status=&page=&limit=` lista sin `password_hash`. `status` es opcional.
- `PATCH /api/v1/admin/vendors/:id/status`

```json
{ "status": "RECHAZADO", "rejection_reason": "El número de puesto no coincide con el plano." }
```

`rejection_reason` es obligatorio solo para `RECHAZADO` (3 a 255 caracteres). Una transición no listada en la sección 2.1 responde **409** `INVALID_STATUS_TRANSITION`. `404` si el negocio no existe.

---

## 9. Módulos NestJS previstos

`AuthModule`, `CatalogModule`, `ChatModule`, `VendorModule`, `AdminModule`. DTOs con class-validator. Un filtro de excepciones arma el sobre de la sección 1. `ValidationPipe` con `whitelist` y `forbidNonWhitelisted` para rechazar `status`, `password_hash` o `role` colados en el body.
