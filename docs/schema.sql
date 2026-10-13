-- ==========================================
-- FERIA 16 DE JULIO - MySQL 8.0+
-- Fuente de verdad física del backend.
-- Motor InnoDB, utf8mb4. Timestamps en UTC.
-- dbdiagram.io puede importar este DDL.
-- Ejecutar sobre una base vacía.
-- ==========================================

SET NAMES utf8mb4;

-- ------------------------------------------
-- Backoffice (no es la cuenta del comerciante)
-- ------------------------------------------
CREATE TABLE usuarios_backoffice (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM('ADMIN', 'OPERADOR') NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_backoffice_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- N y T del chat, y el tope de negocios que puede devolver una recomendación.
CREATE TABLE configuraciones_sistema (
  clave VARCHAR(50) NOT NULL,
  valor VARCHAR(255) NOT NULL,
  descripcion TEXT NULL,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (clave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rubro del puesto. Un negocio tiene una sola categoría.
CREATE TABLE categorias (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  icono_url VARCHAR(500) NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categorias_slug (slug),
  UNIQUE KEY uq_categorias_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Días de atención que el producto ofrece (no es el calendario ISO).
CREATE TABLE dias_semana (
  id TINYINT UNSIGNED NOT NULL,
  codigo VARCHAR(10) NOT NULL,
  nombre VARCHAR(15) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_dias_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cuenta y puesto del comerciante. El password vive aquí, no en el backoffice.
CREATE TABLE negocios (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  categoria_id INT UNSIGNED NOT NULL,
  nombre VARCHAR(50) NOT NULL,
  descripcion_corta VARCHAR(200) NULL,
  logo_url VARCHAR(500) NULL,
  whatsapp VARCHAR(8) NOT NULL,
  email VARCHAR(150) NULL,
  password_hash VARCHAR(255) NOT NULL,
  sector VARCHAR(100) NOT NULL,
  pasillo_puesto VARCHAR(100) NOT NULL,
  latitud DECIMAL(10, 8) NOT NULL,
  longitud DECIMAL(11, 8) NOT NULL,
  terminos_aceptados TINYINT(1) NOT NULL,
  terminos_aceptados_en TIMESTAMP NOT NULL,
  estado ENUM(
    'PENDIENTE_VALIDACION',
    'APROBADO',
    'RECHAZADO',
    'SUSPENDIDO'
  ) NOT NULL DEFAULT 'PENDIENTE_VALIDACION',
  motivo_rechazo VARCHAR(255) NULL,
  aprobado_por_id INT UNSIGNED NULL,
  fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_aprobacion TIMESTAMP NULL DEFAULT NULL,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_negocios_whatsapp (whatsapp),
  UNIQUE KEY uq_negocios_email (email),
  KEY idx_negocios_categoria (categoria_id),
  KEY idx_negocios_estado_fecha (estado, fecha_registro),
  FULLTEXT KEY ft_negocios_texto (nombre, descripcion_corta),
  CONSTRAINT chk_negocios_nombre CHECK (CHAR_LENGTH(nombre) BETWEEN 3 AND 50),
  CONSTRAINT chk_negocios_whatsapp CHECK (whatsapp REGEXP '^[67][0-9]{7}'),
  CONSTRAINT chk_negocios_latitud CHECK (latitud BETWEEN -90 AND 90),
  CONSTRAINT chk_negocios_longitud CHECK (longitud BETWEEN -180 AND 180),
  CONSTRAINT chk_negocios_terminos CHECK (terminos_aceptados = 1),
  CONSTRAINT fk_negocios_categoria FOREIGN KEY (categoria_id) REFERENCES categorias (id),
  CONSTRAINT fk_negocios_aprobador FOREIGN KEY (aprobado_por_id) REFERENCES usuarios_backoffice (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE negocio_dias_atencion (
  negocio_id INT UNSIGNED NOT NULL,
  dia_id TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (negocio_id, dia_id),
  CONSTRAINT fk_nda_negocio FOREIGN KEY (negocio_id) REFERENCES negocios (id) ON DELETE CASCADE,
  CONSTRAINT fk_nda_dia FOREIGN KEY (dia_id) REFERENCES dias_semana (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- El producto hereda el rubro del negocio. No tiene categoria_id propio.
CREATE TABLE productos_servicios (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  negocio_id INT UNSIGNED NOT NULL,
  titulo VARCHAR(150) NOT NULL,
  descripcion TEXT NULL,
  precio DECIMAL(10, 2) NOT NULL,
  moneda ENUM('BOB', 'USD') NOT NULL DEFAULT 'BOB',
  tipo ENUM('PRODUCTO', 'SERVICIO') NOT NULL DEFAULT 'PRODUCTO',
  estado_disponibilidad ENUM('DISPONIBLE', 'AGOTADO') NOT NULL DEFAULT 'DISPONIBLE',
  activo TINYINT(1) NOT NULL DEFAULT 1,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_productos_catalogo (negocio_id, activo, moneda, precio),
  KEY idx_productos_creado (creado_en),
  FULLTEXT KEY ft_productos_texto (titulo, descripcion),
  CONSTRAINT chk_productos_titulo CHECK (CHAR_LENGTH(titulo) BETWEEN 1 AND 150),
  CONSTRAINT chk_productos_precio CHECK (precio >= 0),
  CONSTRAINT fk_productos_negocio FOREIGN KEY (negocio_id) REFERENCES negocios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE producto_imagenes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  producto_id INT UNSIGNED NOT NULL,
  imagen_url VARCHAR(500) NOT NULL,
  orden SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_producto_orden (producto_id, orden),
  CONSTRAINT fk_imagenes_producto FOREIGN KEY (producto_id) REFERENCES productos_servicios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cupo del chat. La clave es el id emitido por el servidor (cookie), no la IP:
-- en la feria mucha gente sale por la misma red.
CREATE TABLE sesiones_usuario (
  id CHAR(36) NOT NULL,
  ip_direccion VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  consultas_realizadas INT UNSIGNED NOT NULL DEFAULT 0,
  ultima_consulta_at TIMESTAMP NULL DEFAULT NULL,
  bloqueado_hasta TIMESTAMP NULL DEFAULT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE consultas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  sesion_id CHAR(36) NOT NULL,
  categoria_id INT UNSIGNED NULL,
  pregunta_usuario TEXT NOT NULL,
  respuesta_feria16 TEXT NOT NULL,
  fecha_hora TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_consultas_sesion_fecha (sesion_id, fecha_hora),
  CONSTRAINT fk_consultas_sesion FOREIGN KEY (sesion_id) REFERENCES sesiones_usuario (id),
  CONSTRAINT fk_consultas_categoria FOREIGN KEY (categoria_id) REFERENCES categorias (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE consulta_negocios_sugeridos (
  consulta_id INT UNSIGNED NOT NULL,
  negocio_id INT UNSIGNED NOT NULL,
  orden SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (consulta_id, negocio_id),
  CONSTRAINT fk_cns_consulta FOREIGN KEY (consulta_id) REFERENCES consultas (id) ON DELETE CASCADE,
  CONSTRAINT fk_cns_negocio FOREIGN KEY (negocio_id) REFERENCES negocios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------
-- Datos semilla
-- ------------------------------------------
INSERT INTO configuraciones_sistema (clave, valor, descripcion) VALUES
  ('MAX_CONSULTAS_SESION', '20', 'Consultas de chat por sesión antes de bloquear'),
  ('TIEMPO_BLOQUEO_MINUTOS', '60', 'Minutos de bloqueo al superar el máximo'),
  ('MAX_NEGOCIOS_SUGERIDOS', '5', 'Tope de negocios devueltos por una recomendación');

INSERT INTO categorias (nombre, slug) VALUES
  ('Deportes', 'deportes'),
  ('Automóviles', 'automoviles'),
  ('Comida & bebidas', 'comida-bebidas'),
  ('Mascotas', 'mascotas');

INSERT INTO dias_semana (id, codigo, nombre) VALUES
  (1, 'JUEVES', 'Jueves'),
  (2, 'DOMINGO', 'Domingo'),
  (3, 'OTROS', 'Otros');
