-- ================================================================
-- KW INVENTORY - SQL MIGRACIÓN v2
-- Nuevas tablas: rescue_events + rescue_items
-- Migración desde tabla rescates existente
-- Fecha: 2026-05-15
-- EJECUTAR EN ORDEN: Sección 1 → 2 → 3 (migración opcional)
-- ================================================================

SET NAMES utf8mb4;
SET time_zone = '-06:00';

-- ================================================================
-- SECCIÓN 1: CREAR TABLA rescue_events (cabecera del evento)
-- ================================================================
CREATE TABLE IF NOT EXISTS `rescue_events` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY                                   COMMENT 'Identificador único autoincremental del evento de rescate',
  `fecha`           DATE NOT NULL                                                    COMMENT 'Fecha en que ocurrió el rescate o mantenimiento',
  `folio_interno`   VARCHAR(30)                                                      COMMENT 'Folio SITIC del evento, enlace con ventas_reporte.id_docto_cargo',
  `tipo`            ENUM('RESCATE','MTTO') NOT NULL DEFAULT 'RESCATE'                COMMENT 'RESCATE: unidad varada en carretera | MTTO: mantenimiento programado',
  `destino`         VARCHAR(120)                                                     COMMENT 'Ciudad o lugar al que se envió el material',
  `tecnico`         VARCHAR(100)                                                     COMMENT 'Nombre del técnico responsable del rescate',
  `unidad`          VARCHAR(50)                                                      COMMENT 'Número económico de la unidad vehicular (ej. T-691)',
  `bisonte`         VARCHAR(100)                                                     COMMENT 'Nombre del representante Bisonte responsable del evento',
  `kw`              VARCHAR(100)                                                     COMMENT 'Nombre del vendedor KW responsable (ej. MARIO RICO, YONA COBOS)',
  `vales`           VARCHAR(200)                                                     COMMENT 'Número(s) de vale(s) Bisonte asociados al evento',
  `observaciones`   TEXT                                                             COMMENT 'Notas adicionales del evento: cotizaciones, facturas, pagos',
  `imagen_url`      TEXT                                                             COMMENT 'URL de la imagen de evidencia subida a Cloudinary',
  `created_at`      TIMESTAMP DEFAULT CURRENT_TIMESTAMP                             COMMENT 'Fecha de creación del registro',
  `updated_at`      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha de última modificación',
  INDEX `idx_re_folio`  (`folio_interno`),
  INDEX `idx_re_fecha`  (`fecha`),
  INDEX `idx_re_tipo`   (`tipo`),
  INDEX `idx_re_tecnico`(`tecnico`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Cabecera de eventos de rescate y mantenimiento - Bisonte SLP / Consigna Kenworth';

-- ================================================================
-- SECCIÓN 2: CREAR TABLA rescue_items (artículos del evento)
-- ================================================================
CREATE TABLE IF NOT EXISTS `rescue_items` (
  `id`                    INT AUTO_INCREMENT PRIMARY KEY              COMMENT 'Identificador único del artículo',
  `event_id`              INT NOT NULL                                COMMENT 'FK al evento padre en rescue_events',
  `numero_articulo`       VARCHAR(60)                                 COMMENT 'SKU o número de parte del artículo',
  `descripcion`           TEXT                                        COMMENT 'Descripción completa del artículo',
  `cantidad_entregada`    DECIMAL(10,4) DEFAULT 0                    COMMENT 'Piezas enviadas al destino',
  `cantidad_devuelta`     DECIMAL(10,4) DEFAULT 0                    COMMENT 'Piezas devueltas al almacén',
  `cantidad_usada`        DECIMAL(10,4) DEFAULT 0                    COMMENT 'Piezas efectivamente utilizadas',
  `cantidad_pendiente`    DECIMAL(10,4) DEFAULT 0                    COMMENT 'Piezas pendientes de devolución o cobro',
  `status_bisonte`        VARCHAR(150)                                COMMENT 'Estado del artículo según Bisonte: VALE ENTREGADO POR BISONTE | SE REGRESA MATERIAL | PENDIENTE',
  `status_kw`             VARCHAR(150)                                COMMENT 'Estado KW: Devuelta | Facturada | Impresa | Parcialmente Devuelta | Parcialmente Devuelta y Parcialmente Facturada | Parcialmente Facturada | Sin Imprimir',
  -- Campos adicionales de exportación SITIC (para carga masiva CSV)
  `cantidad_surtida`      DECIMAL(10,4) DEFAULT 0                    COMMENT 'Cantidad surtida según SITIC (viene del CSV de ventas)',
  `cantidad_por_facturar` DECIMAL(10,4) DEFAULT 0                    COMMENT 'Cantidad pendiente de facturar según SITIC',
  `id_docto_cargo`        BIGINT                                      COMMENT 'ID del documento de cargo en SITIC',
  `folio_factura`         BIGINT                                      COMMENT 'Número de folio de la factura generada',
  `serie_factura`         VARCHAR(60)                                 COMMENT 'Serie de la factura (ej. ARLF)',
  `tipo_documento`        VARCHAR(100)                                COMMENT 'Tipo de movimiento SITIC (ej. Salidas en Vale)',
  `estado_venta`          VARCHAR(120)                                COMMENT 'Estado de la venta según SITIC',
  `fecha_vencimiento`     DATETIME                                    COMMENT 'Fecha límite de pago o devolución del vale',
  `usuario_alta`          VARCHAR(100)                                COMMENT 'Usuario SITIC que generó el registro',
  `oc_cliente`            VARCHAR(100)                                COMMENT 'Número de orden de compra del cliente Bisonte',
  `no_docto_venta`        INT                                         COMMENT 'Número de documento de venta interno KW',
  `created_at`            TIMESTAMP DEFAULT CURRENT_TIMESTAMP        COMMENT 'Fecha de creación del registro',
  `updated_at`            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha de última modificación',
  INDEX `idx_ri_event`    (`event_id`),
  INDEX `idx_ri_sku`      (`numero_articulo`),
  INDEX `idx_ri_status_kw`(`status_kw`),
  CONSTRAINT `fk_ri_event` FOREIGN KEY (`event_id`) REFERENCES `rescue_events`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Artículos individuales de cada evento de rescate - Bisonte SLP / Consigna Kenworth';

-- ================================================================
-- SECCIÓN 3: MIGRACIÓN DESDE TABLA rescates EXISTENTE (OPCIONAL)
-- Solo ejecutar si quieres migrar los datos históricos.
-- Requiere que rescates tenga datos y rescue_events esté vacía.
-- ================================================================

-- 3a. Migrar cabeceras (un evento por folio_interno único + tipo)
INSERT INTO `rescue_events`
  (fecha, folio_interno, tipo, destino, tecnico, unidad, bisonte, kw, vales, observaciones)
SELECT
  MIN(r.fecha)         AS fecha,
  r.folio_interno,
  r.tipo,
  MIN(r.destino)       AS destino,
  MIN(r.tecnico)       AS tecnico,
  MIN(r.unidad)        AS unidad,
  MIN(r.bisonte)       AS bisonte,
  MIN(r.kw)            AS kw,
  MIN(r.vales)         AS vales,
  MIN(r.observaciones) AS observaciones
FROM `rescates` r
WHERE r.folio_interno IS NOT NULL AND r.folio_interno != ''
GROUP BY r.folio_interno, r.tipo

UNION ALL

-- Registros sin folio → un evento por fila individual
SELECT
  r.fecha,
  NULL            AS folio_interno,
  r.tipo,
  r.destino,
  r.tecnico,
  r.unidad,
  r.bisonte,
  r.kw,
  r.vales,
  r.observaciones
FROM `rescates` r
WHERE r.folio_interno IS NULL OR r.folio_interno = '';

-- 3b. Migrar artículos hacia rescue_items ligados a sus eventos
-- Para registros con folio_interno:
INSERT INTO `rescue_items`
  (event_id, numero_articulo, descripcion,
   cantidad_entregada, cantidad_devuelta, cantidad_usada, cantidad_pendiente,
   status_bisonte, status_kw)
SELECT
  re.id,
  r.item,
  r.descripcion,
  COALESCE(r.cantidad_entregada, 0),
  COALESCE(r.cantidad_devuelta, 0),
  COALESCE(r.cantidad_usada, 0),
  COALESCE(r.cantidad_pendiente, 0),
  r.status_bisonte,
  r.status_kw
FROM `rescates` r
JOIN `rescue_events` re
  ON re.folio_interno = r.folio_interno
  AND re.tipo         = r.tipo
WHERE r.folio_interno IS NOT NULL AND r.folio_interno != '';

-- Para registros sin folio (match por fecha + tipo + tecnico + unidad):
INSERT INTO `rescue_items`
  (event_id, numero_articulo, descripcion,
   cantidad_entregada, cantidad_devuelta, cantidad_usada, cantidad_pendiente,
   status_bisonte, status_kw)
SELECT
  re.id,
  r.item,
  r.descripcion,
  COALESCE(r.cantidad_entregada, 0),
  COALESCE(r.cantidad_devuelta, 0),
  COALESCE(r.cantidad_usada, 0),
  COALESCE(r.cantidad_pendiente, 0),
  r.status_bisonte,
  r.status_kw
FROM `rescates` r
JOIN `rescue_events` re
  ON  re.fecha   = r.fecha
  AND re.tipo    = r.tipo
  AND COALESCE(re.tecnico,'') = COALESCE(r.tecnico,'')
  AND COALESCE(re.unidad,'')  = COALESCE(r.unidad,'')
  AND (re.folio_interno IS NULL OR re.folio_interno = '')
WHERE r.folio_interno IS NULL OR r.folio_interno = '';

-- ================================================================
-- VERIFICACIÓN (ejecutar para confirmar migración)
-- ================================================================
-- SELECT COUNT(*) AS total_eventos  FROM rescue_events;
-- SELECT COUNT(*) AS total_items    FROM rescue_items;
-- SELECT COUNT(*) AS total_rescates FROM rescates;
