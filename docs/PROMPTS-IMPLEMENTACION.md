# ATB Inventory Optimizer — Lista de Prompts de Implementación

> **Proyecto:** ATB Inventory Optimizer (Kenworth)
> **Stack:** Next.js 15, React 19, Tailwind CSS, Shadcn/Radix UI, Recharts, Genkit AI, MySQL (Hostinger/phpMyAdmin)
> **Fecha de análisis:** 30 de marzo de 2026

---

## ANÁLISIS COMPLETO DEL ESTADO ACTUAL

### Arquitectura existente
- **Frontend:** Next.js 15 App Router con componentes Shadcn UI (Radix primitives + Tailwind)
- **IA:** Google Genkit con Gemini 2.5 Flash para forecasting de comisiones
- **Datos:** 100% mock data estático en `src/lib/mock-data.ts` (sin conexión a BD)
- **Hosting:** Firebase App Hosting configurado (`apphosting.yaml`)
- **Almacenes registrados:** Bisonte SLP, Exclusa SLP, Eje 132, Querétaro
- **Tipos de datos:** `InventoryItem` (id, name, warehouse, quantity, value, movement) y `Requisition` (id, type, item, quantity, from, to, status, date)

### Brechas críticas identificadas
1. **Sin driver MySQL** — No hay `mysql2` ni ORM instalado
2. **Sin API Routes** — Todo el backend es mock, no hay endpoints CRUD
3. **Sin carga de archivos real** — El botón Upload en inventario no procesa Excel/CSV
4. **Sin traspasos funcionales** — El formulario New Request no guarda datos
5. **Sin autenticación** — Usuario hardcodeado, no hay login
6. **Sin validación server-side** — Solo validación básica en forecast
7. **Sin schema de BD** — No existen tablas creadas en MySQL

---

## FASE 0 — INFRAESTRUCTURA Y BASE DE DATOS

### Prompt 0.1 — Instalar dependencias MySQL y Excel
```
Instala las dependencias necesarias para conectar Next.js a MySQL y para parsear archivos Excel:
- mysql2 (driver nativo con soporte Promise)
- xlsx (para parsear archivos Excel .xlsx/.xls/.csv)

Ejecuta: npm install mysql2 xlsx
Luego, crea el archivo src/lib/db.ts con un pool de conexiones MySQL que lea las credenciales del .env existente (DB_HOST, DB_USER, DB_PASSWORD, DB_DATABASE). Usa mysql2/promise con un pool (connectionLimit: 10). Incluye una función helper "query" que acepte SQL parametrizado para prevenir SQL injection.
```

### Prompt 0.2 — Crear schema SQL de la base de datos
```
Crea el archivo docs/schema.sql con las tablas necesarias para ATB Inventory Optimizer en MySQL:

1. **warehouses** — id (INT AUTO_INCREMENT PK), name (VARCHAR 100 UNIQUE), location (VARCHAR 255), created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
   - INSERT los almacenes: 'Bisonte SLP', 'Exclusa SLP', 'Eje 132', 'Querétaro'

2. **inventory_items** — id (INT AUTO_INCREMENT PK), product_id (VARCHAR 20 UNIQUE NOT NULL), name (VARCHAR 255 NOT NULL), warehouse_id (INT FK→warehouses.id), quantity (INT DEFAULT 0), unit_value (DECIMAL 10,2), movement (ENUM 'high','medium','low'), created_at, updated_at (ON UPDATE CURRENT_TIMESTAMP)

3. **requisitions** — id (INT AUTO_INCREMENT PK), request_id (VARCHAR 20 UNIQUE NOT NULL), type (ENUM 'Requisition','Transfer'), item_id (INT FK→inventory_items.id), quantity (INT NOT NULL), from_warehouse_id (INT FK→warehouses.id NULL), to_warehouse_id (INT FK→warehouses.id), to_destination (VARCHAR 255), status (ENUM 'Pending','Approved','In Transit','Completed','Rejected' DEFAULT 'Pending'), notes (TEXT), created_at, updated_at

4. **upload_history** — id (INT AUTO_INCREMENT PK), filename (VARCHAR 255), rows_processed (INT), rows_succeeded (INT), rows_failed (INT), uploaded_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP), status (ENUM 'processing','completed','failed')

5. **transfer_log** — id (INT AUTO_INCREMENT PK), requisition_id (INT FK→requisitions.id), from_warehouse_id (INT FK), to_warehouse_id (INT FK), item_id (INT FK), quantity (INT), transferred_at (TIMESTAMP), confirmed_by (VARCHAR 100)

Agrega índices en: inventory_items(warehouse_id), inventory_items(movement), requisitions(status), requisitions(type), transfer_log(requisition_id).
```

### Prompt 0.3 — Script de inicialización y seed
```
Crea src/lib/db-seed.ts con un script que:
1. Lea la conexión MySQL desde src/lib/db.ts
2. Ejecute el schema.sql para crear las tablas (si no existen)
3. Inserte datos seed basados en la mock-data actual (los 10 inventory items y las 6 requisitions de src/lib/mock-data.ts) mapeados a las tablas relacionales
4. Agrega un script en package.json: "db:seed": "tsx src/lib/db-seed.ts"

También crea src/lib/db-test.ts que simplemente haga un SELECT 1 para verificar la conexión a la BD y lo imprima en consola, con script "db:test": "tsx src/lib/db-test.ts"
```

---

## FASE 1 — API ROUTES (CRUD COMPLETO)

### Prompt 1.1 — API de inventario (CRUD)
```
Crea las siguientes API routes en src/app/api/inventory/:

GET  /api/inventory — Obtener todos los items con JOIN a warehouses. Soportar query params: ?warehouse=id&movement=high|medium|low&search=texto
POST /api/inventory — Crear un nuevo item (validar con Zod: product_id requerido y único, name requerido, warehouse_id válido, quantity >= 0, unit_value >= 0)  
PUT  /api/inventory/[id]/route.ts — Actualizar un item por ID (validar parcialmente con Zod)
DELETE /api/inventory/[id]/route.ts — Eliminar un item por ID (soft delete o verificar que no tenga requisitions activas)

Cada endpoint debe:
- Usar consultas parametrizadas (prevenir SQL injection)
- Retornar JSON con estructura { success: boolean, data?: any, error?: string }
- Manejar errores con try/catch y devolver status codes apropiados (200, 201, 400, 404, 500)
```

### Prompt 1.2 — API de requisiciones y traspasos (CRUD)
```
Crea las API routes en src/app/api/requisitions/:

GET  /api/requisitions — Obtener todas las requisiciones con JOINs a inventory_items y warehouses. Soportar filtros: ?type=Requisition|Transfer&status=Pending|Approved|etc
POST /api/requisitions — Crear nueva requisición o traspaso. Validar con Zod:
  - Si type='Transfer': from_warehouse_id y to_warehouse_id son requeridos y deben ser diferentes
  - Si type='Requisition': to_destination es requerido
  - quantity debe ser > 0 y no exceder stock disponible del item
  - Generar request_id automáticamente (R### o T### según tipo)
PUT  /api/requisitions/[id]/route.ts — Actualizar estado. Cuando status cambie a 'Completed' en un Transfer:
  - Descontar quantity del from_warehouse (inventory_items)
  - Sumar quantity al to_warehouse (crear row si no existe el item en ese almacén, o sumar si ya existe)
  - Registrar en transfer_log
  - Esto debe ser una TRANSACCIÓN MySQL
DELETE /api/requisitions/[id]/route.ts — Solo permitir eliminar si status es 'Pending'
```

### Prompt 1.3 — API de almacenes
```
Crea las API routes en src/app/api/warehouses/:

GET  /api/warehouses — Listar todos los almacenes con conteo de items y valor total del inventario (subquery o JOIN aggregate)
POST /api/warehouses — Crear nuevo almacén (name único, requerido)
PUT  /api/warehouses/[id]/route.ts — Actualizar nombre/location
DELETE /api/warehouses/[id]/route.ts — Solo eliminar si no tiene inventory_items asociados
```

### Prompt 1.4 — API de carga de Excel/CSV
```
Crea src/app/api/upload/route.ts:

POST /api/upload — Recibir un archivo FormData (Excel o CSV):
1. Parsear el archivo con la librería xlsx
2. Validar que tenga las columnas esperadas: ProductID, Name, Warehouse, Quantity, UnitValue, Movement (case-insensitive, flexible)
3. Para cada fila:
   - Buscar si el product_id ya existe en la BD
   - Si existe: UPDATE quantity y unit_value
   - Si no existe: INSERT nuevo registro
   - Resolver warehouse_id buscando por nombre en tabla warehouses (crear si no existe)
4. Registrar en upload_history: filename, rows procesadas, exitosas, fallidas
5. Retornar resumen: { success: true, processed: N, created: X, updated: Y, errors: [...] }
6. Toda la operación dentro de una TRANSACCIÓN

Manejar errores por fila individualmente (no abortar todo por una fila mala).
```

---

## FASE 2 — CONECTAR FRONTEND CON LA BD

### Prompt 2.1 — Refactorizar página de Inventario
```
Refactoriza src/app/(app)/inventory/page.tsx para:

1. Eliminar la importación de mock-data
2. Hacer fetch al API /api/inventory en el componente (usar hooks de React con fetch o Server Components con async/await)
3. Implementar la funcionalidad del botón Upload:
   - Al seleccionar archivo y hacer click en Upload, enviar FormData al POST /api/upload
   - Mostrar toast de progreso y resultado (éxito con summary, o error)
   - Refrescar la tabla automáticamente después de cargar
4. Agregar búsqueda en tiempo real (input de texto que filtre la tabla por nombre o ID)
5. Agregar tabs dinámicos para cada almacén (obtener lista de warehouses desde /api/warehouses en vez de hardcodear)
6. Agregar botones de acción en cada fila: Editar (abre dialog para editar quantity/value) y Eliminar (con confirmación AlertDialog)
7. Agregar paginación (10, 25, 50 items por página)
8. Mantener todos los componentes Shadcn UI existentes
```

### Prompt 2.2 — Refactorizar página de Requisiciones y Traspasos
```
Refactoriza src/app/(app)/requisitions/page.tsx para:

1. Eliminar la importación de mock-data  
2. Hacer fetch al API /api/requisitions
3. Hacer funcional el Dialog "New Request":
   - El select de Type (Requisition/Transfer) debe cambiar dinámicamente los campos mostrados
   - Si Transfer: mostrar selects de "From Warehouse" y "To Warehouse" (cargados desde /api/warehouses)
   - Si Requisition: mostrar input "Destination"
   - Select de Item debe cargar desde /api/inventory
   - Quantity no debe exceder stock disponible (validación client-side)
   - Submit hace POST a /api/requisitions, muestra toast de éxito/error, cierra dialog, refresca tabla
4. Agregar botones de acción por fila:
   - "Approve" (cambia status a Approved, visible solo si Pending)
   - "Mark In Transit" (cambia a In Transit, visible solo si Approved)
   - "Complete" (cambia a Completed, visible solo si In Transit — en traspasos esto ejecuta la lógica de mover inventario)
   - "Reject" (cambia a Rejected, visible si Pending o Approved)
5. Agregar filtros por tipo y por status (tabs o selects)
6. Agregar paginación
```

### Prompt 2.3 — Refactorizar Dashboard con datos reales
```
Refactoriza src/app/(app)/dashboard/page.tsx para:

1. Eliminar imports de mock-data
2. Crear un endpoint GET /api/dashboard/stats que retorne en una sola llamada:
   - totalInventoryValue (SUM de quantity * unit_value)
   - lowMovementCount (COUNT WHERE movement = 'low')
   - openRequisitionsCount (COUNT WHERE status IN ('Pending','Approved','In Transit'))
   - warehouseDistribution (array con { name, value } por almacén)
   - recentActivity (últimas 10 requisiciones con tipo, item name, quantity, status, date)
3. Consumir ese endpoint desde el dashboard
4. Mantener las cards KPI, gráfico de barras de actividad reciente, y pie chart de distribución
5. Agregar un card adicional: "Transfers This Month" con conteo de traspasos del mes actual
6. Agregar un mini-table de "Recent Transfers" con las últimas 5 del transfer_log
```

### Prompt 2.4 — Refactorizar Reports con datos reales
```
Refactoriza src/app/(app)/reports/page.tsx para:

1. Crear endpoint GET /api/reports/commission que calcule proyección de comisión basada en datos reales de la BD
2. Agregar filtros: rango de fechas, almacén específico o todos
3. Agregar una sección de "Inventory Health Report":
   - Tabla con items de bajo movimiento (movement='low') y su valor total
   - Porcentaje que representan del inventario total
4. Agregar botón "Export to Excel" que llame a un endpoint GET /api/reports/export que genere un archivo .xlsx descargable con el reporte actual
5. Mantener el gráfico de línea de proyección de comisión
```

---

## FASE 3 — MÓDULO DE TRASPASOS (FEATURE CLAVE)

### Prompt 3.1 — Página dedicada de Traspasos
```
Crea una nueva página src/app/(app)/transfers/page.tsx dedicada exclusivamente a traspasos entre almacenes:

1. Header: "Material Transfers" con descripción
2. Sección superior: Formulario "New Transfer"
   - Select "From Warehouse" y "To Warehouse" (no puede ser el mismo)
   - Tabla filtrable de items disponibles en el almacén origen (con checkbox para seleccionar)
   - Input de cantidad por cada item seleccionado (validar <= stock disponible)
   - Vista previa del traspaso antes de confirmar
   - Botón "Create Transfer" que hace POST a /api/requisitions con type='Transfer'
3. Sección inferior: "Transfer History"
   - Tabla con todos los traspasos (GET /api/requisitions?type=Transfer)
   - Timeline visual del status (Pending → Approved → In Transit → Completed)
   - Botón para avanzar al siguiente status
4. Card sidebar: Resumen visual de stock por almacén (mini bar charts comparativos)

Agregar la ruta al main-nav.tsx con icono Truck de lucide-react entre Requisitions y Reports.
```

### Prompt 3.2 — Lógica de transacción de traspasos
```
Implementa la lógica completa de traspasos en el backend:

1. Cuando un traspaso se marca como "Completed" en PUT /api/requisitions/[id]:
   - Iniciar TRANSACCIÓN MySQL
   - Verificar que el item siga teniendo stock suficiente en el almacén origen
   - Descontar del almacén origen (UPDATE inventory_items SET quantity = quantity - X WHERE product_id AND warehouse_id)
   - Si el item ya existe en el almacén destino: UPDATE sumar quantity
   - Si el item NO existe en el almacén destino: INSERT nueva fila copiando name, unit_value, movement del origen
   - Insertar registro en transfer_log
   - COMMIT si todo ok, ROLLBACK si hay error
   - Retornar resultado con detalle de lo que se movió

2. Agregar endpoint GET /api/transfers/summary que retorne:
   - Total de traspasos por mes (últimos 6 meses)
   - Items más transferidos
   - Almacenes con más entradas vs más salidas
```

---

## FASE 4 — UPLOAD DE EXCEL AVANZADO

### Prompt 4.1 — Componente de Upload avanzado
```
Crea un componente reutilizable src/components/excel-upload.tsx:

1. Zona de drag & drop (con borde dashed y icono) + botón de selección de archivo
2. Aceptar archivos .xlsx, .xls, .csv
3. Vista previa: al seleccionar archivo, mostrar las primeras 5 filas en una tabla
4. Mapeo de columnas: permitir al usuario mapear las columnas del Excel a los campos de la BD con selects (ProductID → columna A, Name → columna B, etc.)
5. Indicador de progreso durante la carga
6. Resultado: mostrar resumen (filas procesadas, creadas, actualizadas, errores) con opción de descargar reporte de errores
7. Usar este componente en la página de Inventory reemplazando el upload actual
```

### Prompt 4.2 — Historial de cargas
```
Agrega una sección en la página de Inventory (o como tab adicional) que muestre:

1. Historial de archivos subidos (de upload_history)
2. Por cada upload: fecha, nombre de archivo, filas procesadas/exitosas/fallidas, status
3. Opción de "revertir" la última carga (solo si fue la más reciente y no han pasado más de 24h)
```

---

## FASE 5 — UX/UI PROFESIONAL

### Prompt 5.1 — Mejoras de UX/UI globales
```
Implementa las siguientes mejoras de UX/UI en toda la aplicación:

1. Loading states: Agregar Skeleton loaders en todas las tablas y cards mientras se cargan los datos
2. Empty states: Cuando no hay datos, mostrar ilustración/icono + texto amigable + CTA (ej: "No inventory items yet. Upload an Excel file to get started.")
3. Confirmación de acciones destructivas: Todos los DELETE deben usar AlertDialog de Shadcn
4. Toast notifications: Éxito (verde), Error (rojo), Info (azul) para todas las operaciones CRUD
5. Responsive: Verificar que todas las tablas tengan scroll horizontal en móvil, que los dialogs se adapten
6. Breadcrumbs: Agregar breadcrumbs debajo del header en cada página
7. Animaciones sutiles: Fade-in al cargar datos, transiciones suaves en tabs, hover effects en filas de tabla
```

### Prompt 5.2 — Dark mode y consistencia visual
```
1. Verificar que el dark mode funciona de acuerdo con las CSS variables ya definidas en globals.css
2. Agregar toggle de Dark/Light mode en el header (junto al avatar)
3. Asegurar que todos los colores de badges, charts, y componentes sean consistentes con el tema Kenworth:
   - Primary: Deep Red #B71C1C
   - Accent: Gold #FFD700
   - Background: Light Gray #F5F5F5
4. Revisar contraste WCAG AA en todos los textos
```

### Prompt 5.3 — Dashboard mejorado con KPIs animados
```
Mejora el Dashboard:
1. Cards KPI con animación de conteo (counter animation) al cargar
2. Agregar sparklines pequeñas en cada KPI card mostrando tendencia de los últimos 7 días
3. Indicadores de cambio: ↑ +5.2% o ↓ -3.1% comparado con el periodo anterior
4. Gráfico de barras apiladas (stacked bar) mostrando movimiento por almacén
5. Tabla de "Low Movement Alerts" con los items de bajo movimiento y acción sugerida (Transfer/Reduce)
```

---

## FASE 6 — FUNCIONALIDADES ADICIONALES

### Prompt 6.1 — Búsqueda global
```
Implementa un componente de búsqueda global en el header de la aplicación:
1. Input con Cmd+K / Ctrl+K shortcut
2. Buscar en inventario (por nombre o product_id) y requisiciones (por ID)
3. Mostrar resultados en un dropdown con link directo al item
4. Usar dialog/command palette estilo Shadcn
```

### Prompt 6.2 — Notificaciones y alertas
```
Implementa un sistema de alertas:
1. Alerta cuando un item tiene quantity < 5 (stock bajo)
2. Alerta cuando hay requisiciones Pending hace más de 48 horas
3. Icono de campana en el header con badge de conteo
4. Dropdown con lista de notificaciones al hacer click
5. Endpoint GET /api/notifications que calcule las alertas desde la BD
```

### Prompt 6.3 — Autenticación básica
```
Implementa autenticación básica:
1. Crear tabla users en MySQL (id, email, password_hash, name, role ENUM 'admin','manager','viewer', created_at)
2. Página de login en src/app/login/page.tsx
3. Usar NextAuth.js o una implementación custom con JWT en cookies httpOnly
4. Middleware para proteger las rutas del (app) group
5. En el header, mostrar nombre del usuario logueado y logout funcional
6. Role-based: solo admin puede eliminar items, viewer no puede crear/editar
```

---

## FASE 7 — OPTIMIZACIÓN Y DEPLOY

### Prompt 7.1 — Optimización de rendimiento
```
1. Implementar Server Components donde sea posible (dashboard stats, listas)
2. Implementar revalidación con revalidateTag/revalidatePath después de mutaciones
3. Agregar caché a las queries pesadas (dashboard stats) con unstable_cache o headers
4. Optimizar las queries SQL: verificar que usan los índices creados
5. Lazy load de componentes pesados (charts) con next/dynamic
```

### Prompt 7.2 — Preparar para deploy
```
1. Verificar que todas las variables de entorno estén documentadas en un .env.example (sin valores sensibles)
2. Actualizar apphosting.yaml si es necesario para las variables de entorno de BD
3. Verificar build: npm run build sin errores
4. Crear un README.md actualizado con:
   - Instrucciones de setup local
   - Variables de entorno necesarias
   - Cómo ejecutar el seed de la BD
   - Estructura del proyecto actualizada
```

---

## ORDEN DE EJECUCIÓN RECOMENDADO

| Prioridad | Prompts | Descripción |
|-----------|---------|-------------|
| **1 - Crítica** | 0.1, 0.2, 0.3 | Infraestructura BD + conexión + schema |
| **2 - Core** | 1.1, 1.2, 1.3, 1.4 | Todos los API Routes CRUD |
| **3 - Integración** | 2.1, 2.2, 2.3, 2.4 | Conectar frontend a BD real |
| **4 - Feature clave** | 3.1, 3.2 | Módulo de traspasos dedicado |
| **5 - Upload** | 4.1, 4.2 | Excel upload avanzado |
| **6 - UX/UI** | 5.1, 5.2, 5.3 | Mejoras visuales y profesionales |
| **7 - Extras** | 6.1, 6.2, 6.3 | Búsqueda, notificaciones, auth |
| **8 - Deploy** | 7.1, 7.2 | Optimización y producción |

---

## NOTAS TÉCNICAS

- **SQL Injection prevention:** SIEMPRE usar consultas parametrizadas con `?` placeholders en mysql2
- **Validación:** Usar Zod en todas las API routes para validar inputs
- **Transacciones:** Usar `connection.beginTransaction()` para traspasos y uploads masivos
- **Tipos:** Mantener tipado TypeScript estricto en todo el proyecto
- **Componentes:** Reutilizar Shadcn UI existentes, no instalar librerías de UI adicionales
- **Estado:** Usar React hooks nativos (useState, useEffect, useActionState) — no instalar Redux ni Zustand a menos que sea necesario

