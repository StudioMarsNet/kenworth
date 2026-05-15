# KW Inventory System — Lista de Prompts de Implementación

> **Proyecto:** Kenworth Control de Ventas, Inventario y Reportes  
> **Stack:** Next.js 15 · React 19 · MySQL (Hostinger) · Tailwind · Shadcn UI  
> **Fecha:** 31 de marzo de 2026  
> **Formato:** Copiar y pegar cada prompt en orden. Cada uno es independiente pero secuencial.

---

## PROMPT 1 — Eliminar toda referencia a "ATB" y rebranding

```
Elimina TODAS las referencias a "ATB" en todo el proyecto. Reemplázalas según el contexto:

Archivos a modificar (busca con grep "ATB" en todo el proyecto):

1. src/app/layout.tsx — title y description del metadata:
   - title: "KW Inventory System"
   - description: "Sistema de control de inventario, ventas y reportes para Kenworth."

2. src/app/login/page.tsx — textos visibles:
   - "ATB Inventory Optimizer" → "KW Inventory"
   - "Kenworth ATB · Sistema de Control de Inventario" → "Kenworth · Sistema de Control de Inventario"

3. src/app/(app)/layout.tsx — header y sidebar:
   - El texto "ATB" grande → "KW"
   - "Kenworth ATB Inventory" → "Kenworth Inventory"

4. docs/schema-v2.sql, docs/schema.sql, docs/blueprint.md, README.md — solo cambiar comentarios/títulos, no afecta funcionalidad.

NO modifiques package-lock.json. Solo archivos de código fuente y documentación.
Después de hacer los cambios, corre npm run build para verificar.
```

---

## PROMPT 2 — Reestructurar tabla inventory_items y página /inventory

```
Necesito que el frontend y backend de /inventory estén alineados y muestren exactamente estas columnas en este orden:

| # | Columna en UI       | Campo en DB         | Notas                                                    |
|---|---------------------|----------------------|----------------------------------------------------------|
| 1 | Núm. Parte          | numero_articulo      | Ya existe                                                |
| 2 | Descripción         | descripcion          | Ya existe                                                |
| 3 | Ubicación           | ubicacion            | Ya existe                                                |
| 4 | Stand               | stand                | Ya existe                                                |
| 5 | Tipo Artículo       | tipo_articulo        | NUEVO — VARCHAR(50), default 'Normal'                    |
| 6 | Almacén             | warehouse_name       | JOIN con warehouses (ya existe)                          |
| 7 | Sucursal            | sucursal             | NUEVO — VARCHAR(100), viene del Excel de Kenworth        |
| 8 | Exist. Actual       | existencia           | Ya existe                                                |

Cambios necesarios:

1. Genera un SQL migration (docs/migration-v3.sql) que agregue las columnas nuevas:
   ALTER TABLE inventory_items ADD COLUMN tipo_articulo VARCHAR(50) DEFAULT 'Normal' AFTER stand;
   ALTER TABLE inventory_items ADD COLUMN sucursal VARCHAR(100) DEFAULT '' AFTER warehouse_id;

2. Actualiza el API GET /api/inventory para devolver tipo_articulo y sucursal.
3. Actualiza el API POST /api/inventory para aceptar tipo_articulo y sucursal.
4. Actualiza el API PUT /api/inventory/[id] para aceptar tipo_articulo y sucursal.
5. Actualiza el API POST /api/upload (upload de Excel/CSV) para mapear:
   - "Tipo Artículo" o "tipoarticulo" → tipo_articulo
   - "Sucursal" o "sucursal" → sucursal
   - "Núm. Parte" o "numpart" → numero_articulo
   - "Exist. Actual" o "existactual" → existencia
   - "PrecioLista" o "preciolista" → precio_traxion
   (el Excel de Kenworth tiene estas columnas exactas)

6. Actualiza src/app/(app)/inventory/page.tsx:
   - La tabla debe mostrar EXACTAMENTE las 8 columnas del orden de arriba
   - El type InventoryItem debe incluir tipo_articulo y sucursal
   - El dialog de edición debe incluir tipo_articulo y sucursal

7. Corre npm run build para verificar.
```

---

## PROMPT 3 — Página de Consumo Diario (Cotizaciones)

```
Necesito una nueva página /consumo para registrar el consumo diario de refacciones.

CONTEXTO: Cada día genero una cotización de lo que se consumió de la consigna en los almacenes de Kenworth. El formato de la cotización tiene estas columnas:
- VAL (código de almacén, ej: 40219, 40226, 40228, etc.)
- ARTÍCULO (número de parte, ej: TZ370065A, BF4515GDHD100SPI)
- DESCRIPCIÓN
- CANTIDAD (unidades consumidas)
- PRECIO (precio unitario)
- TOTAL (CANTIDAD × PRECIO)

Quiero poder subir este archivo como Excel o CSV y que se guarde en la base de datos como consumo de ese día.

IMPLEMENTACIÓN:

1. Crea una nueva tabla en docs/migration-consumo.sql:
   CREATE TABLE consumo_diario (
     id INT AUTO_INCREMENT PRIMARY KEY,
     fecha DATE NOT NULL,
     val_almacen VARCHAR(20),
     numero_articulo VARCHAR(50) NOT NULL,
     descripcion VARCHAR(500),
     cantidad INT NOT NULL,
     precio_unitario DECIMAL(12,2) NOT NULL,
     total DECIMAL(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
     warehouse_id INT,
     uploaded_by VARCHAR(100),
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT fk_consumo_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL,
     INDEX idx_consumo_fecha (fecha),
     INDEX idx_consumo_articulo (numero_articulo)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

2. Crea API POST /api/consumo/upload — recibe archivo Excel/CSV + fecha del consumo:
   - Parsea el archivo con xlsx
   - Mapea columnas: VAL→val_almacen, ARTÍCULO→numero_articulo, DESCRIPCIÓN→descripcion, CANTIDAD→cantidad, PRECIO→precio_unitario
   - Inserta todas las filas con la fecha seleccionada
   - Auto-mapea val_almacen a warehouse_id si es posible (crear una tabla de mapeo simple)
   - Devuelve resumen: filas procesadas, monto total del día

3. Crea API GET /api/consumo — query params: fecha_inicio, fecha_fin, warehouse_id
   - Devuelve listado agrupable por fecha
   - Incluye totales por día

4. Crea página src/app/(app)/consumo/page.tsx:
   - Sección superior: Selector de fecha + botón para subir archivo Excel/CSV del día
   - Card con resumen del día: total de piezas, monto total, número de artículos distintos
   - Tabla con las columnas: VAL, Artículo, Descripción, Cantidad, Precio, Total
   - Filtros: rango de fechas, almacén
   - Vista de historial: lista de días con totales, click para expandir detalle

5. Agrega "Consumo" al menú de navegación (main-nav.tsx) con icono ShoppingCart, después de "Inventario".

6. Corre npm run build para verificar.
```

---

## PROMPT 4 — Página de Lista de Precios por Cliente

```
Necesito una nueva página /precios para manejar los precios de artículos según el cliente.

CONTEXTO: Vendo las mismas refacciones a distintos clientes pero a diferentes precios. Ejemplos:
- A "Traxion" le vendo a precio unitario (precio base / precio lista)
- A "ATB" le vendo a precio base + 7.5% de comisión
- Otros clientes pueden tener otros porcentajes de markup

Necesito poder seleccionar un cliente y ver automáticamente los precios calculados.

IMPLEMENTACIÓN:

1. Crea las tablas en docs/migration-precios.sql:

   CREATE TABLE clientes (
     id INT AUTO_INCREMENT PRIMARY KEY,
     nombre VARCHAR(100) NOT NULL UNIQUE,
     porcentaje_markup DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Porcentaje adicional sobre precio base. 0 = precio base, 7.5 = +7.5%',
     contacto VARCHAR(255),
     notas TEXT,
     activo BOOLEAN DEFAULT TRUE,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

   INSERT INTO clientes (nombre, porcentaje_markup, contacto) VALUES
     ('Traxion', 0.00, 'Judith Elizabeth Díaz Lamas'),
     ('ATB', 7.50, ''),
     ('Mostrador', 0.00, '');

2. Crea API CRUD /api/clientes — GET (listar), POST (crear)
3. Crea API CRUD /api/clientes/[id] — PUT (editar), DELETE

4. Crea API GET /api/precios?cliente_id=X — devuelve:
   - Todos los artículos de inventory_items con columnas: numero_articulo, descripcion, precio_base (precio_traxion), porcentaje_markup del cliente, precio_cliente (calculado: precio_base * (1 + porcentaje/100))
   - Si no se pasa cliente_id, devuelve precio base

5. Crea página src/app/(app)/precios/page.tsx:
   - Selector de cliente en la parte superior (dropdown)
   - Al seleccionar cliente, muestra su porcentaje de markup
   - Tabla con columnas: Núm. Parte, Descripción, Precio Base, Markup %, Precio Cliente, Precio + IVA (16%)
   - Buscador para filtrar por número de parte o descripción
   - Botón para exportar la lista de precios como Excel/CSV
   - Card con CRUD de clientes: crear nuevo cliente con nombre y porcentaje

6. Agrega "Precios" al menú de navegación (main-nav.tsx) con icono DollarSign, después de "Consumo".

7. Corre npm run build para verificar.
```

---

## PROMPT 5 — Integración del Excel de Kenworth (Sincronización de Inventario)

```
Necesito que el sistema pueda importar el Excel que descargo del sistema de Kenworth para sincronizar el inventario.

CONTEXTO: Periódicamente descargo un Excel del sistema de Kenworth que tiene TODAS las columnas del inventario actual. El archivo tiene más de 50 columnas pero solo necesito guardar estas:
- Núm. Parte → numero_articulo
- Descripción → descripcion
- Ubicacion → ubicacion
- Stand → stand
- Tipo Artículo → tipo_articulo
- Almacén → mapear al warehouse_id (ej: "BISONTE SAN LUIS POTOSÍ" = warehouse "Bisonte SLP")
- Sucursal → sucursal
- Exist. Actual → existencia
- PrecioLista → precio_traxion (precio base)
- Moneda → moneda (nueva columna, "Pesos" o "Dólares")
- Tipo de Cambio Cat → si moneda es "Dólares", multiplicar PrecioLista × tipo_cambio para obtener precio en pesos

El archivo de referencia está en docs/Invetario Bisonte SLP.xlsx (no lo modifiques, solo lee los headers para mapeo).

IMPLEMENTACIÓN:

1. Crea docs/migration-moneda.sql:
   ALTER TABLE inventory_items ADD COLUMN moneda VARCHAR(20) DEFAULT 'Pesos' AFTER precio_bisonte;
   ALTER TABLE inventory_items ADD COLUMN tipo_cambio DECIMAL(8,4) DEFAULT 1.0000 AFTER moneda;

2. Modifica/crea API POST /api/inventory/sync — endpoint específico para importar el Excel de Kenworth:
   - Recibe el archivo Excel
   - Lee SOLO las columnas que necesitamos (las 10 listadas arriba)
   - Mapea "Almacén" a warehouse_id:
     "BISONTE SAN LUIS POTOSÍ" → Bisonte SLP (id 1)
     "EXCLUSA SAN LUIS POTOSÍ" → Exclusa SLP (id 2)
     (crear mapeo configurable para otros almacenes)
   - Si moneda es "Dólares": precio_en_pesos = PrecioLista × Tipo de Cambio Cat
   - UPSERT: si (numero_articulo, warehouse_id) ya existe → UPDATE, sino → INSERT
   - Devuelve resumen: creados, actualizados, errores

3. En la página /inventory, agrega un segundo botón de upload: "Sincronizar desde Kenworth"
   - Diferente del upload normal
   - Abre un dialog explicando que este Excel viene del sistema de Kenworth
   - Muestra el resumen después de procesar

4. Corre npm run build para verificar.
```

---

## PROMPT 6 — Dashboard mejorado y reportes de consumo

```
Actualiza el dashboard (/dashboard) y reportes (/reports) para incluir datos de consumo:

1. Dashboard — agregar cards:
   - Consumo del día: total piezas y monto (de consumo_diario WHERE fecha = TODAY)
   - Consumo del mes: total acumulado del mes actual
   - Gráfica de consumo últimos 30 días (línea)
   - Top 5 artículos más consumidos del mes

2. Reports — agregar sección:
   - Reporte de consumo por rango de fechas
   - Consumo por artículo (cuáles se venden más)
   - Consumo por almacén
   - Comparativo: existencia actual vs consumo mensual (para detectar artículos que se quedan sin stock)
   - Reporte de ventas por cliente (usando la tabla de consumo + clientes)

3. Todas las monedas en formato MXN (ya están pero verificar).
4. Corre npm run build para verificar.
```

---

## PROMPT 7 — Preparar para agente de AI de ventas (futuro)

```
Prepara la infraestructura para un agente de AI de ventas automatizado (no implementar el agente todavía, solo la base):

1. Crea una tabla para registrar interacciones de ventas:
   CREATE TABLE ai_sales_log (
     id INT AUTO_INCREMENT PRIMARY KEY,
     cliente_id INT,
     articulos JSON COMMENT 'Array de {numero_articulo, cantidad, precio}',
     total DECIMAL(12,2),
     status ENUM('draft','sent','confirmed','cancelled') DEFAULT 'draft',
     generated_by ENUM('manual','ai') DEFAULT 'manual',
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT fk_sales_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id)
   );

2. Crea API CRUD /api/sales — para generar cotizaciones manualmente o vía AI
3. Crea página /cotizaciones — lista de cotizaciones generadas, con opción de crear nueva manualmente
4. El formato de la cotización debe ser similar al de la imagen de referencia (KENWORTH DEL BAJÍO header, datos del cliente, tabla de artículos, subtotal, IVA 16%, total)
5. Botón para exportar cotización como PDF

Esto será la base sobre la cual después se conectará el agente de AI.
```

---

## Orden de ejecución recomendado

1. **PROMPT 1** — Rebranding (rápido, limpia el proyecto)
2. **PROMPT 2** — Inventory restructure (base para todo lo demás)
3. **PROMPT 5** — Sync Kenworth Excel (necesita PROMPT 2)
4. **PROMPT 4** — Precios por cliente (independiente pero necesita inventory)
5. **PROMPT 3** — Consumo diario (necesita inventory + precios)
6. **PROMPT 6** — Dashboard/Reportes mejorados (necesita consumo)
7. **PROMPT 7** — Base para AI de ventas (último, futuro)
