-- ============================================================
-- MIGRATION: Consumo orientado a Sub-Almacenes + reset de pruebas
-- Entorno: PRUEBAS (destructivo)
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1) Extender consumo diario para trabajar con sub-almacén
ALTER TABLE daily_consumption
  ADD COLUMN IF NOT EXISTS sub_warehouse_id INT NULL AFTER warehouse_id,
  ADD INDEX IF NOT EXISTS idx_daily_consumption_sub_warehouse (sub_warehouse_id);

-- FK opcional (idempotente): crear solo si no existe
SET @has_fk_daily_subwh := (
  SELECT COUNT(*)
  FROM information_schema.REFERENTIAL_CONSTRAINTS rc
  WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
    AND rc.CONSTRAINT_NAME = 'fk_daily_consumption_sub_warehouse'
);

SET @sql := IF(
  @has_fk_daily_subwh = 0,
  'ALTER TABLE daily_consumption ADD CONSTRAINT fk_daily_consumption_sub_warehouse FOREIGN KEY (sub_warehouse_id) REFERENCES sub_warehouses(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt_fk_daily FROM @sql;
EXECUTE stmt_fk_daily;
DEALLOCATE PREPARE stmt_fk_daily;

-- 2) Tabla de mapeo VAL -> sub-almacén
CREATE TABLE IF NOT EXISTS sub_warehouse_val_map (
  id INT PRIMARY KEY AUTO_INCREMENT,
  val_code VARCHAR(30) NOT NULL,
  sub_warehouse_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_subwh_val_code (val_code),
  CONSTRAINT fk_subwh_val_map_sw
    FOREIGN KEY (sub_warehouse_id) REFERENCES sub_warehouses(id)
    ON DELETE CASCADE
);

-- 3) Dejar un solo almacén padre: KENWORTH
--    (todos los sub-almacenes activos quedarán como hijos de este almacén)
INSERT INTO warehouses (name, location)
SELECT 'KENWORTH', 'Matriz'
WHERE NOT EXISTS (SELECT 1 FROM warehouses WHERE name = 'KENWORTH');

SET @kenworth_id := (SELECT id FROM warehouses WHERE name = 'KENWORTH' LIMIT 1);

UPDATE sub_warehouses
SET parent_warehouse_id = @kenworth_id
WHERE activo = 1;

-- Mantener compatibilidad de mapeos legacy VAL -> warehouse
-- (si existe la tabla, forzamos todos los warehouse_id al padre KENWORTH)
SET @has_legacy_map := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'warehouse_val_map'
);

SET @sql := IF(
  @has_legacy_map > 0,
  CONCAT('UPDATE warehouse_val_map SET warehouse_id = ', @kenworth_id),
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Eliminar almacenes padre sobrantes
DELETE FROM warehouses
WHERE id <> @kenworth_id;

-- 4) Limpieza total de datos operativos (solo pruebas)
--    IMPORTANTE: usar DELETE (no TRUNCATE) para evitar errores por FKs en phpMyAdmin
DELETE FROM transfer_log;
DELETE FROM requisition_approvals_log;
DELETE FROM quote_items;
DELETE FROM requisitions;
DELETE FROM quotes;
DELETE FROM daily_consumption;
DELETE FROM consumption_corrections_log;
DELETE FROM audit_log;
DELETE FROM inventory_items;

-- Reiniciar contadores AUTO_INCREMENT (opcional, útil en pruebas)
ALTER TABLE transfer_log AUTO_INCREMENT = 1;
ALTER TABLE requisition_approvals_log AUTO_INCREMENT = 1;
ALTER TABLE requisitions AUTO_INCREMENT = 1;
ALTER TABLE quote_items AUTO_INCREMENT = 1;
ALTER TABLE quotes AUTO_INCREMENT = 1;
ALTER TABLE daily_consumption AUTO_INCREMENT = 1;
ALTER TABLE consumption_corrections_log AUTO_INCREMENT = 1;
ALTER TABLE audit_log AUTO_INCREMENT = 1;
ALTER TABLE inventory_items AUTO_INCREMENT = 1;

-- 5) Si quieres reiniciar también catálogos auxiliares
-- TRUNCATE TABLE clients;
-- TRUNCATE TABLE personnel;

-- 6) Tabla legacy opcional (si ya migraste VAL al nuevo esquema)
-- DROP TABLE IF EXISTS warehouse_val_map;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- NOTAS
-- - Este script NO elimina la tabla warehouses porque sigue siendo
--   clave para inventario/precios y compatibilidad actual.
-- - Si deseas eliminar warehouses totalmente, hay que refactorizar
--   APIs de inventario, consumo, pricing y reportes.
-- ============================================================
