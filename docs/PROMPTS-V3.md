# KW Inventory System — PROMPTS V3 (Basado en DB real)

> Base analizada desde carpeta sql del repo.
> Ruta revisada: sql/daily_consumption.sql, sql/quotes.sql, sql/quote_items.sql, sql/personnel.sql, sql/u244760700_KW.sql

---

## Analisis de DB actual (resultado)

1. La tabla daily_consumption ya tiene todo lo necesario para Prompt 1, 2 y 3:
   - id, fecha, val_almacen, numero_articulo, descripcion, cantidad, precio_unitario, warehouse_id, uploaded_by.
2. La tabla quotes y quote_items ya soportan flujo de cotizaciones sin cambios estructurales para esta etapa.
3. La tabla personnel ya tiene roles y bandera activo.
4. No es necesario borrar tablas para implementar borrado/edicion de consumo.
5. Para esta fase, no se requiere migracion obligatoria.

---

## Estado de ejecucion

- Prompt 1: implementado (API borrado parcial/total de consumo)
- Prompt 2: implementado (UI borrado parcial/total de consumo en /quotes)
- Prompt 3: implementado (edicion completa de consumo en /quotes)

---

## PROMPT 1 — Borrado parcial y total de Consumo (API)

```txt
Objetivo:
Habilitar DELETE en /api/consumption para borrado parcial y total.

Requisitos:
1) DELETE parcial por ids:
   body: { ids: number[] }

2) DELETE total:
   body: {
     mode: "all",
     fecha_inicio?: "YYYY-MM-DD",
     fecha_fin?: "YYYY-MM-DD",
     warehouse_id?: number,
     confirm_all?: boolean
   }

3) Reglas:
   - Si mode=all sin filtros, exigir confirm_all=true.
   - Responder total eliminado.
   - Manejo de error claro.
```

---

## PROMPT 2 — Borrado parcial y total de Consumo (UI /quotes)

```txt
Objetivo:
Agregar controles visuales en /quotes para borrar consumo sin salir de la pagina.

Requisitos:
1) Checkbox por registro en la tabla de consumo expandida.
2) Botones:
   - "Borrar Consumo Seleccionado"
   - "Borrar Consumo" (por filtros activos o total)
3) Confirmacion previa obligatoria.
4) Toast con cantidad borrada.
5) Recarga de historial y cards despues de borrar.
```

---

## PROMPT 3 — Edicion completa de Consumo (API + UI)

```txt
Objetivo:
Permitir editar cualquier registro de consumo dentro de /quotes.

Requisitos:
1) API /api/consumption/[id]:
   - PUT para editar fecha, val_almacen, numero_articulo, descripcion, cantidad, precio_unitario, warehouse_id, uploaded_by.
   - DELETE individual por id.

2) UI en /quotes:
   - Boton "Editar" por fila de consumo.
   - Dialog con formulario completo.
   - Guardar con validaciones.

3) Validaciones:
   - fecha obligatoria
   - numero_articulo obligatorio
   - cantidad > 0
   - precio_unitario >= 0
   - uploaded_by obligatorio
```

---

## SQL opcional recomendado (no obligatorio)

Si quieres mejor rendimiento en filtros y borrados por fecha/almacen:

```sql
ALTER TABLE daily_consumption
  ADD INDEX idx_consumo_fecha_warehouse (fecha, warehouse_id);
```

No borra datos y no cambia logica, solo mejora consultas grandes.

---

## PROMPTS extra para mejorar OTRAS paginas

## PROMPT 4 — Dashboard operativo de carga y correcciones

```txt
Mejorar /dashboard con indicadores de operacion diaria:
1) Cargas de consumo del dia (conteo de registros y monto).
2) Correcciones del dia (conteo de ediciones y borrados).
3) Alertas de articulos con alto consumo de los ultimos 7 dias.
4) Widget "Pendientes" para cotizaciones en borrador.
```

## PROMPT 5 — Reports con trazabilidad de cambios

```txt
Mejorar /reports:
1) Reporte de registros borrados de consumo por rango de fechas.
2) Reporte de cambios en consumo (antes/despues) si existe auditoria.
3) Exportar reportes a Excel con filtros aplicados.
4) Agregar resumen por usuario que sube/edita.
```

## PROMPT 6 — Inventory con consumo proyectado

```txt
Mejorar /inventory:
1) Mostrar columna "dias de cobertura" = existencia / consumo promedio diario.
2) Semaforo visual: bajo, medio, sano.
3) Filtro rapido "riesgo de quiebre".
4) Boton de sugerencia de requisicion basada en consumo mensual.
```

## PROMPT 7 — Precios con simulador comercial

```txt
Mejorar /pricing:
1) Simulador de margen por cliente con IVA.
2) Escenarios por tipo de cambio.
3) Guardar escenarios como plantillas.
4) Exportar cotizacion simulada a /quotes con un click.
```

## PROMPT 8 — Requisitions con aprobacion escalonada

```txt
Mejorar /requisitions:
1) Flujo de estatus: borrador -> enviada -> aprobada -> surtida -> cerrada.
2) Validar stock disponible antes de aprobar.
3) Historial de aprobaciones con usuario y fecha.
4) Alertas automaticas cuando una requisicion queda detenida.
```

## PROMPT 9 — Transfers con validaciones fuertes

```txt
Mejorar /transfers:
1) Validar existencia en origen antes de confirmar.
2) Confirmacion de recepcion en destino.
3) Diferencias de recepcion (faltantes/sobrantes).
4) Reporte de transferencias por periodo y almacen.
```

## PROMPT 10 — Users y permisos por accion critica

```txt
Mejorar /users y seguridad:
1) Matriz de permisos por rol (ver, crear, editar, borrar, exportar).
2) Bloquear borrado total de consumo/cotizaciones a roles no autorizados.
3) Bitacora de acciones criticas por usuario.
4) Politica de sesion: expiracion y cierre forzado.
```

## PROMPT 11 — Forecast conectado a consumo real

```txt
Mejorar /forecast:
1) Usar consumo real historico como señal principal.
2) Proyeccion por articulo y almacen.
3) Escenario optimista/base/pesimista.
4) Boton para convertir pronostico a requisicion sugerida.
```

---

## Orden recomendado de implementacion futura

1. Prompt 4 (Dashboard)
2. Prompt 6 (Inventory)
3. Prompt 7 (Pricing)
4. Prompt 8 (Requisitions)
5. Prompt 9 (Transfers)
6. Prompt 10 (Users)
7. Prompt 5 (Reports)
8. Prompt 11 (Forecast)
