# Spec de Requerimientos Frontend - Aplicación Feria 16 de Julio

Este documento contiene la especificación exclusiva de **Frontend, Interfaz de Usuario (UI), Manejo de Estados, Validaciones Client-side y Componentes** para ser interpretado por herramientas de IA (Cursor / Claude).

---

## 1. Vistas y Arquitectura de Rutas (Navegación)

| Ruta / View | Nombre de Pantalla | Descripción / Propósito |
| :--- | :--- | :--- |
| `/chat` | Chat de Recomendaciones | Asistente IA conversacional con selector de categorías y chips interactivos. |
| `/explorar` | Catálogo y Búsqueda | Búsqueda por palabras clave, filtros (precio, día, moneda), paginación y modales. |
| `/login` | Iniciar Sesión | Autenticación de comerciantes por teléfono/correo y contraseña. |
| `/registro` | Registro de Negocio | Wizard en 2 pasos para alta de puestos con geolocalización GPS. |
| `/estado-registro` | Estado de Solicitud | Pantalla informativa para cuentas en revisión (`PENDIENTE_VALIDACION`). |

---

## 2. Tipos de Datos y Contratos Frontend (TypeScript)

```typescript
// --- Módulo 1: Chat ---
export type CategoryOption = 'Deportes' | 'Automóviles' | 'Comida & bebidas' | 'Mascotas';

export interface RecommendedBusinessChip {
  id: string;
  name: string;
  avatarUrl?: string;
  locationSummary?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  recommendedChips?: RecommendedBusinessChip[];
  timestamp: Date;
  isError?: boolean;
}

// --- Módulo 2: Catálogo & Productos ---
export type Currency = 'BS' | 'USD';
export type DayOfWeek = 'jueves' | 'Domingo' | 'Otros';
export type SortOption = 'relevancia' | 'precio_asc' | 'precio_desc' | 'recientes';
export type StockStatus = 'Disponible' | 'Agotado';

export interface ProductItem {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: Currency;
  stockStatus: StockStatus;
  imageUrl: string;
  updatedAt: string;
  vendor: {
    id: string;
    name: string;
    phoneWhatsApp: string;
    sector: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  };
}

export interface CatalogFilterState {
  query: string;
  currency: Currency;
  minPrice?: number;
  maxPrice?: number;
  selectedDays: DayOfWeek[];
  sortBy: SortOption;
  page: number;
}

// --- Módulo 3: Autenticación & Registro ---
export type AccountStatus = 'PENDIENTE_VALIDACION' | 'APROBADO' | 'RECHAZADO';

export interface RegisterStep1Form {
  businessName: string; // 3-50 chars
  businessType: string;
  shortDescription?: string; // Max 200 chars
  whatsappPhone: string; // 8 dígitos bolivianos (inicia en 6 o 7)
  openDays: DayOfWeek[]; // Al menos 1 seleccionado
}

export interface RegisterStep2Form {
  sectorPasilloNro: string;
  gpsLocation: {
    lat: number;
    lng: number;
  };
  password: string; // Min 8 chars, alfanumérico (letras + números)
  acceptTerms: boolean; // Debe ser true
}
```

---

## 3. Módulo 1: Chat de Recomendaciones (`/chat`)

### 3.1. Componentes Visuales y Estados
*   **Header Navigation Tabs:**
    *   Botón "Explorar": Píldora blanca. Redirige a `/explorar`.
    *   Botón "Negocio": Píldora translúcida oscura.
*   **Input Bar (Prompt Input):**
    *   Contenedor gris oscuro.
    *   Placeholder: `"Que deseas encontrar en la Feria16"`.
    *   Estados: `Normal`, `Active/Focus`, `Error` (borde rojo sutil en fallo de validación).
*   **Selector de Categorías (`+` Trigger):**
    *   Ubicado a la izquierda del Input text.
    *   Al presionar `+`, conmuta un Menú Flotante / Dropdown con opciones: `Deportes`, `Automóviles`, `Comida & bebidas`, `Mascotas`.
*   **Botón de Envío (`↑` Submit):**
    *   Círculo interactivo.
    *   Estado `Disabled`: Cuando el input está vacío o contiene solo espacios.
    *   Estado `Enabled`: Círculo gris claro / activo cuando se ingresa $\ge 1$ carácter válido.
*   **Chips de Negocios (Resultados):**
    *   Card redondeada interactiva con ícono de perfil/ubicación y nombre del comercio.
    *   Estados: `Normal`, `Hover` (cambio de opacidad o elevación).

### 3.2. Reglas de Validación Client-Side
1.  **Límite de Palabras:** Máximo estricto de **100 palabras** por mensaje.
    *   *Comportamiento UI:* Bloquear escritura adicional al alcanzar 100 palabras y mostrar advertencia.
2.  **Validación Vacía:** Botón de envío deshabilitado si `trim(input) === ""`.

### 3.3. Eventos y Flujo de Interacción
*   **Clic en `+`:** Alterna visibilidad del menú flotante de categorías.
*   **Selección de Categoría:** Rellena/concatena el texto en el prompt o aplica filtro directo.
*   **Clic en `↑` (Enviar):**
    1. Executa validación de conteo de palabras ($\le 100$).
    2. Limpia el campo de entrada.
    3. Añade el mensaje del usuario al historial del chat.
    4. Muestra un estado de respuesta en progreso / typing indicator.
*   **Clic en Chip de Comercio:** Abre modal o redirige al perfil del negocio seleccionado.

### 3.4. Mensajes del Sistema (UI Feedback)
*   **Error de contexto:** `"Tu consulta no está relacionada con los productos o comercios de la Feria 16 de Julio. Por favor, intenta con otra búsqueda."`
*   **Exceso de palabras:** `"El mensaje no puede superar las 100 palabras."`
*   **Sin coincidencias:** `"No se encontraron productos ni negocios relacionados con tu búsqueda en la feria."`
*   **Límite de uso excedido:** `"Se alcanzó el límite de N usos, por favor espere N segundos/minutos/horas/días."`

---

## 4. Módulo 2: Búsqueda, Catálogo y Detalles (`/explorar`)

### 4.1. Componentes Visuales y Estados
*   **Input de Búsqueda:** Acepta hasta 30 palabras máximo. Estados: `Normal`, `Hover`, `Focus`, `Error`.
*   **Botón Lupa:** Ejecuta la consulta de búsqueda.
*   **Toggle Filtros:** Despliega / oculta la barra superior de "Ajustar búsqueda".
*   **Selector de Moneda (Segmented Toggle):** Opciones `BS` (por defecto) o `USD`.
*   **Rango de Precios (Inputs Mínimo / Máximo):** Campos numéricos ($\ge 0$).
*   **Checkboxes Días de Atención:** Selección para `jueves`, `Domingo`, `Otros`.
*   **Selector de Ordenamiento (Dropdown):**
    *   `Relevancia`
    *   `Precio: menor a mayor`
    *   `Precio: mayor a menor`
    *   `Más recientes`
*   **Contador de Resultados:** Texto dinámico (ej: `"12 resultados encontrados"`).
*   **Badge Estado de Disponibilidad:**
    *   Verde: `Disponible`
    *   Rojo: `Agotado`
*   **Botón "Cargar más":** Paginación asíncrona. Estados: `Normal`, `Hover`, `Loading (Spinner)`, `Disabled`.
*   **Botón WhatsApp:** Directo en tarjeta/modal. Abre integración `wa.me`.
*   **Botón Google Maps:** Redirige a enlace externo de geolocalización.

### 4.2. Reglas de Validación Client-Side
1.  **Límite de Palabras de Búsqueda:** Máximo **30 palabras** (separadas por espacio).
2.  **Inconsistencia de Precios:** `Precio Minimo` debe ser $\le$ `Precio Máximo`.
3.  **Comportamiento del Producto Agotado:** Badge en Rojo (`Agotado`) y desactiva o atenúa el botón principal de contacto por WhatsApp.

### 4.3. Eventos y Links Externos
*   **Clic en Tarjeta de Producto:** Abre Modal de Detalle con imágenes, precio, disponibilidad y puesto.
*   **Clic en Contactar por WhatsApp:** Redirige a:
    `https://wa.me/<numero_vendedor>?text=<mensaje_predeterminado>`
*   **Clic en Ver en Google Maps:** Redirige a:
    `https://www.google.com/maps/search/?api=1&query=<latitud>,<longitud>`
*   **Clic en "Cargar más":** Petición asíncrona que anexa los siguientes $N$ ítems al final de la lista.

### 4.4. Mensajes del Sistema (UI Feedback)
*   **Búsqueda vacía:** `"Ingrese un término para buscar."`
*   **Límite de palabras excedido:** `"El texto de búsqueda no debe superar las 30 palabras."`
*   **Error en rango de precio:** `"El precio mínimo no puede ser mayor al precio máximo."`
*   **Sin resultados:** `"No se encontraron resultados."` (Muestra opción / botón para restablecer filtros).
*   **Indicador de paginación:** `"Mostrando [X] de [Y] resultados."`

---

## 5. Módulo 3: Autenticación y Registro (`/login`, `/registro`)

### 5.1. Flujo de Registro en 2 Pasos (Wizard `/registro`)

#### Paso 1: Información del Negocio
*   **Nombre de Negocio:** Input alfanumérico. **Obligatorio**. Mínimo 3, máximo 50 caracteres.
*   **Tipo de Negocio:** Dropdown / Selector. **Obligatorio**.
*   **Descripción Corta:** Textarea libre con contador visible. **Opcional**. Máximo 200 caracteres.
*   **Celular WhatsApp:** Input numérico. **Obligatorio**. Formato boliviano (8 dígitos iniciando en 6 o 7).
*   **Días de Apertura:** Checkboxes (`jueves`, `Domingo`, `Otros`). **Obligatorio** seleccionar al menos 1.
*   **Botón "Siguiente Paso":** Ejecuta validaciones client-side del Paso 1 antes de avanzar.

#### Paso 2: Ubicación y Credenciales
*   **Sector / Pasillo / Nro:** Inputs alfanuméricos. **Obligatorios**.
*   **Ubicación GPS:** Componente Selector de Mapa para fijar punto $(lat, lng)$. **Obligatorio**.
*   **Contraseña:** Input string con ícono de "ojo" para conmutar visibilidad (`Masked`/`Unmasked`). **Obligatorio**.
    *   *Regla:* Mínimo 8 caracteres. Debe incluir al menos una letra y un número.
*   **Términos y Políticas:** Checkbox. **Obligatorio** estar marcado (`true`).
*   **Botón "Finalizar Registro":** Envía el formulario y redirige a `/estado-registro`.

### 5.2. Pantalla de Login (`/login`)
*   **Input Correo / Celular:** Numérico o texto simple. **Obligatorio**.
*   **Input Contraseña:** Con conmutador visual de máscara (ojo). **Obligatorio**.
*   **Enlace "¿Olvidaste tu contraseña?":** Redirige a recuperación por mensaje.
*   **Botón "Entrar a mi Cuenta":**
    *   Si la cuenta es `APROBADO` $\rightarrow$ Redirige a `/explorar` (o Panel).
    *   Si la cuenta es `PENDIENTE_VALIDACION` $\rightarrow$ Redirige a `/estado-registro`.
*   **Enlace "Registrar negocio gratis":** Redirige a `/registro`.

### 5.3. Pantalla Estado de Registro (`/estado-registro`)
*   Muestra tarjeta informativa con icono de reloj/revisión y el título `"¡Registro Recibido!"`.
*   Mensaje explicativo: `"Tu registro se encuentra en proceso de revisión por nuestro equipo. Te notificaremos por WhatsApp en un máximo de 24 horas hábiles."`
*   **Botón "Entendido, volver al inicio":** Redirige a `/explorar`.

### 5.4. Mensajes de Validación e Interfaz para Registro/Login
*   **Teléfono inválido:** `"Ingresa un número de celular boliviano válido (8 dígitos)."`
*   **Teléfono duplicado:** `"El número de WhatsApp o correo ingresado ya se encuentra registrado."`
*   **Nombre inválido:** `"El nombre debe tener entre 3 y 50 caracteres."`
*   **Descripción excedida:** `"La descripción no puede superar los 200 caracteres."`
*   **Sin días seleccionados:** `"Debes seleccionar al menos un día de apertura."`
*   **Contraseña débil:** `"La contraseña debe tener al menos 8 caracteres, combinando letras y números."`
*   **Términos no aceptados:** `"Debes aceptar los términos y políticas para continuar."`