import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

const toYMD = (d: Date) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawInicio = searchParams.get("fecha_inicio");
    const rawFin = searchParams.get("fecha_fin");

    const today = new Date();
    const defaultEnd = toYMD(today);
    const defaultStartDate = new Date();
    defaultStartDate.setDate(today.getDate() - 29);
    const defaultStart = toYMD(defaultStartDate);

    let fechaInicio = rawInicio;
    let fechaFin = rawFin;

    if (!fechaInicio && !fechaFin) {
      fechaInicio = defaultStart;
      fechaFin = defaultEnd;
    } else if (fechaInicio && !fechaFin) {
      fechaFin = defaultEnd;
    } else if (!fechaInicio && fechaFin) {
      const end = new Date(fechaFin);
      const start = new Date(end);
      start.setDate(end.getDate() - 29);
      fechaInicio = toYMD(start);
    }

    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
      const swap = fechaInicio;
      fechaInicio = fechaFin;
      fechaFin = swap;
    }

    const periodParams: any[] = [fechaInicio, fechaFin];
    // Table-qualified period clauses to avoid ambiguity in JOINs
    const reqPeriod = " AND DATE(r.created_at) >= ? AND DATE(r.created_at) <= ?";
    const quotePeriod = " AND DATE(q.created_at) >= ? AND DATE(q.created_at) <= ?";
    const transferPeriod = " AND DATE(tl.transferred_at) >= ? AND DATE(tl.transferred_at) <= ?";

    const consumoClause = " WHERE fecha >= ? AND fecha <= ?";
    const consumoParams: any[] = [fechaInicio, fechaFin];

    // Inventory health summary
    const healthRows: any[] = await query(`
      SELECT
        COUNT(*) AS skus,
        COALESCE(SUM(i.existencia), 0) AS units,
        COALESCE(SUM(CASE WHEN i.existencia > 0 THEN 1 ELSE 0 END), 0) AS skus_with_stock,
        COALESCE(SUM(CASE WHEN i.warehouse_id IS NULL OR w.id IS NULL THEN 1 ELSE 0 END), 0) AS orphan_items
      FROM inventory_items i
      LEFT JOIN warehouses w ON w.id = i.warehouse_id
    `);
    const inventoryHealth = {
      skus: Number(healthRows[0]?.skus || 0),
      units: Number(healthRows[0]?.units || 0),
      skus_with_stock: Number(healthRows[0]?.skus_with_stock || 0),
      orphan_items: Number(healthRows[0]?.orphan_items || 0),
    };

    // Total inventory value
    const valResult: any[] = await query(
      "SELECT COALESCE(SUM(existencia * precio_traxion), 0) AS total FROM inventory_items"
    );
    const totalInventoryValue = Number(valResult[0]?.total || 0);

    // Low movement count
    const lowResult: any[] = await query(
      "SELECT COUNT(*) AS cnt FROM inventory_items WHERE LOWER(COALESCE(movement, '')) = 'low'"
    );
    const lowMovementCount = Number(lowResult[0]?.cnt || 0);

    // Open requisitions
    const openResult: any[] = await query(
      `SELECT COUNT(*) AS cnt FROM requisitions r
       WHERE r.status IN ('Pending','Approved','In Transit')${reqPeriod}`,
      periodParams
    );
    const openRequisitionsCount = Number(openResult[0]?.cnt || 0);

    // Transfers in selected period
    const transferResult: any[] = await query(
      `SELECT COUNT(*) AS cnt FROM requisitions r WHERE r.type = 'Transfer'${reqPeriod}`,
      periodParams
    );
    const transfersThisMonth = Number(transferResult[0]?.cnt || 0);

    // Warehouse distribution
    const warehouseDistribution: any[] = await query(`
      SELECT
        COALESCE(w.name, 'Sin almacén') AS name,
        COALESCE(SUM(i.existencia * i.precio_traxion), 0) AS value
      FROM inventory_items i
      LEFT JOIN warehouses w ON w.id = i.warehouse_id
      GROUP BY COALESCE(w.name, 'Sin almacén')
      ORDER BY value DESC
    `);

    // Sub-warehouse inventory distribution from net movements (completed/closed)
    let subWarehouseDistribution: any[] = await query(`
      SELECT
        base.sub_warehouse_name AS name,
        SUM(base.existencia_sub * base.precio_traxion) AS value
      FROM (
        SELECT
          sw.id AS sub_warehouse_id,
          sw.nombre AS sub_warehouse_name,
          i.numero_articulo,
          MAX(i.precio_traxion) AS precio_traxion,
          (
            COALESCE(SUM(CASE WHEN r.to_sub_warehouse_id = sw.id THEN r.quantity ELSE 0 END), 0)
            -
            COALESCE(SUM(CASE WHEN r.from_sub_warehouse_id = sw.id THEN r.quantity ELSE 0 END), 0)
          ) AS existencia_sub
        FROM sub_warehouses sw
        JOIN requisitions r
          ON (r.to_sub_warehouse_id = sw.id OR r.from_sub_warehouse_id = sw.id)
         AND r.status IN ('Completed', 'Closed')
        JOIN inventory_items i ON i.id = r.item_id
        WHERE sw.activo = 1
        GROUP BY sw.id, sw.nombre, i.numero_articulo
        HAVING existencia_sub > 0
      ) base
      GROUP BY base.sub_warehouse_id, base.sub_warehouse_name
      ORDER BY value DESC
    `);

    // Fallback: estimate sub-warehouse distribution using consumption records in selected period
    let subWarehouseDistributionSource: "movements" | "consumption" | "none" = "movements";
    if (!subWarehouseDistribution.length) {
      const consumoAsSubDist: any[] = await query(
        `SELECT
           sw.nombre AS name,
           SUM(c.cantidad * c.precio_unitario) AS value
         FROM daily_consumption c
         JOIN sub_warehouses sw ON sw.id = c.sub_warehouse_id
         WHERE c.sub_warehouse_id IS NOT NULL
           AND c.fecha >= ? AND c.fecha <= ?
         GROUP BY sw.id, sw.nombre
         ORDER BY value DESC`,
        consumoParams
      );
      if (consumoAsSubDist.length) {
        subWarehouseDistribution = consumoAsSubDist;
        subWarehouseDistributionSource = "consumption";
      } else {
        subWarehouseDistributionSource = "none";
      }
    }

    const subInvSummaryRows: any[] = await query(`
      SELECT
        COUNT(*) AS activos
      FROM sub_warehouses sw
      WHERE sw.activo = 1
    `);
    const distTotal = subWarehouseDistribution.reduce((acc, row) => acc + Number(row.value || 0), 0);
    const subWarehouseStats = {
      activos: Number(subInvSummaryRows[0]?.activos || 0),
      con_stock: subWarehouseDistribution.length,
      total_value: distTotal,
    };

    // Recent activity (last 10 requisitions)
    const recentActivity: any[] = await query(`
      SELECT r.request_id, r.type, r.quantity, r.status, r.created_at,
             i.descripcion AS item_name
      FROM requisitions r
      JOIN inventory_items i ON r.item_id = i.id
      WHERE 1=1 ${reqPeriod}
      ORDER BY r.created_at DESC
      LIMIT 10`, periodParams);

    // Recent transfers
    const recentTransfers: any[] = await query(`
      SELECT tl.quantity, tl.transferred_at,
             i.descripcion AS item_name,
             COALESCE(fw.name, 'Sin almacén') AS from_warehouse,
             COALESCE(tw.name, 'Sin almacén') AS to_warehouse
      FROM transfer_log tl
      JOIN inventory_items i ON tl.item_id = i.id
      LEFT JOIN warehouses fw ON tl.from_warehouse_id = fw.id
      LEFT JOIN warehouses tw ON tl.to_warehouse_id = tw.id
      WHERE 1=1 ${transferPeriod}
      ORDER BY tl.transferred_at DESC
      LIMIT 5`, periodParams);

    // --- Consumo stats ---
    // Consumo en periodo
    const consumoHoy: any[] = await query(
      `SELECT COALESCE(SUM(cantidad), 0) AS piezas, COALESCE(SUM(cantidad * precio_unitario), 0) AS monto
       FROM daily_consumption${consumoClause}`,
      consumoParams
    );
    const consumoDia = { piezas: Number(consumoHoy[0]?.piezas || 0), monto: Number(consumoHoy[0]?.monto || 0) };

    // Consumo acumulado en periodo
    const consumoMes: any[] = await query(
      `SELECT COALESCE(SUM(cantidad), 0) AS piezas, COALESCE(SUM(cantidad * precio_unitario), 0) AS monto
       FROM daily_consumption${consumoClause}`,
      consumoParams
    );
    const consumoMesData = { piezas: Number(consumoMes[0]?.piezas || 0), monto: Number(consumoMes[0]?.monto || 0) };

    // Consumo últimos 30 días (por día)
    const consumo30Dias: any[] = await query(`
      SELECT DATE_FORMAT(fecha, '%d/%m') AS dia, 
             COALESCE(SUM(cantidad * precio_unitario), 0) AS monto
      FROM daily_consumption
      ${consumoClause}
      GROUP BY fecha
      ORDER BY fecha ASC
    `, consumoParams);

    // Top 5 artículos más consumidos del mes
    const topConsumo: any[] = await query(`
      SELECT numero_articulo, descripcion, SUM(cantidad) AS total_piezas, 
             SUM(cantidad * precio_unitario) AS total_monto
      FROM daily_consumption
      ${consumoClause}
      GROUP BY numero_articulo, descripcion
      ORDER BY total_piezas DESC
      LIMIT 5
    `, consumoParams);

    // Cargas de consumo en periodo
    const cargasConsumoHoyRows: any[] = await query(
      `SELECT COUNT(*) AS registros, COALESCE(SUM(cantidad * precio_unitario), 0) AS monto
       FROM daily_consumption${consumoClause}`,
      consumoParams
    );
    const cargasConsumoHoy = {
      registros: Number(cargasConsumoHoyRows[0]?.registros || 0),
      monto: Number(cargasConsumoHoyRows[0]?.monto || 0),
    };

    // Correcciones del periodo (si existe tabla de log)
    let correccionesDia = { ediciones: 0, borrados: 0 };
    try {
      const existsRows: any[] = await query(`SHOW TABLES LIKE 'consumption_corrections_log'`);
      if (existsRows.length > 0) {
        const correccionesRows: any[] = await query(`
          SELECT
            COALESCE(SUM(CASE WHEN action = 'edit' THEN records_affected ELSE 0 END), 0) AS ediciones,
            COALESCE(SUM(CASE WHEN action = 'delete' THEN records_affected ELSE 0 END), 0) AS borrados
          FROM consumption_corrections_log
          WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
        `, [fechaInicio, fechaFin]);
        correccionesDia = {
          ediciones: Number(correccionesRows[0]?.ediciones || 0),
          borrados: Number(correccionesRows[0]?.borrados || 0),
        };
      }
    } catch {
      correccionesDia = { ediciones: 0, borrados: 0 };
    }

    // Alertas: artículos con alto consumo en periodo
    const alertasConsumo7Dias: any[] = await query(`
      SELECT
        numero_articulo,
        MAX(descripcion) AS descripcion,
        SUM(cantidad) AS total_piezas,
        SUM(cantidad * precio_unitario) AS total_monto
      FROM daily_consumption
      ${consumoClause}
      GROUP BY numero_articulo
      HAVING SUM(cantidad) >= 10
      ORDER BY total_piezas DESC
      LIMIT 8
    `, consumoParams);

    // Cotizaciones pendientes (borrador)
    const cotizacionesPendientesRows: any[] = await query(`
      SELECT COUNT(*) AS total, COALESCE(SUM(total), 0) AS monto
      FROM quotes q
      WHERE q.estatus = 'borrador'${quotePeriod}
    `, periodParams);
    const cotizacionesPendientes = {
      total: Number(cotizacionesPendientesRows[0]?.total || 0),
      monto: Number(cotizacionesPendientesRows[0]?.monto || 0),
    };

    return NextResponse.json({
      success: true,
      data: {
        totalInventoryValue,
        inventoryHealth,
        lowMovementCount,
        openRequisitionsCount,
        transfersThisMonth,
        warehouseDistribution,
        subWarehouseDistribution,
        subWarehouseDistributionSource,
        subWarehouseStats,
        recentActivity,
        recentTransfers,
        consumoDia,
        consumoMes: consumoMesData,
        consumo30Dias,
        topConsumo,
        cargasConsumoHoy,
        correccionesDia,
        alertasConsumo7Dias,
        cotizacionesPendientes,
        periodo: { fecha_inicio: fechaInicio, fecha_fin: fechaFin },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
