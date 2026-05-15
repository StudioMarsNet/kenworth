import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fechaInicio = searchParams.get("fecha_inicio");
    const fechaFin = searchParams.get("fecha_fin");

    const consumoWhere: string[] = [];
    const consumoParams: any[] = [];
    if (fechaInicio) {
      consumoWhere.push("fecha >= ?");
      consumoParams.push(fechaInicio);
    }
    if (fechaFin) {
      consumoWhere.push("fecha <= ?");
      consumoParams.push(fechaFin);
    }
    const consumoClause = consumoWhere.length > 0 ? ` WHERE ${consumoWhere.join(" AND ")}` : "";

    // Inventory health: movement distribution
    const movementDist = await query<{ movement: string; count: number; total_value: number }>(
      `SELECT movement, COUNT(*) as count, SUM(existencia * precio_traxion) as total_value
       FROM inventory_items GROUP BY movement`
    );

    // Inventory KPI summary
    const invSummaryRows: any[] = await query(
      `SELECT COUNT(*) AS total_skus,
              COALESCE(SUM(existencia), 0) AS total_unidades,
              COALESCE(SUM(existencia * precio_traxion), 0) AS valor_total,
              COALESCE(SUM(CASE WHEN existencia > 0 THEN 1 ELSE 0 END), 0) AS skus_con_stock,
              COALESCE(SUM(CASE WHEN existencia = 0 THEN 1 ELSE 0 END), 0) AS skus_sin_stock,
              COALESCE(AVG(precio_traxion), 0) AS precio_promedio
       FROM inventory_items`
    );
    const inventarioResumen = {
      total_skus: Number(invSummaryRows[0]?.total_skus || 0),
      total_unidades: Number(invSummaryRows[0]?.total_unidades || 0),
      valor_total: Number(invSummaryRows[0]?.valor_total || 0),
      skus_con_stock: Number(invSummaryRows[0]?.skus_con_stock || 0),
      skus_sin_stock: Number(invSummaryRows[0]?.skus_sin_stock || 0),
      precio_promedio: Number(invSummaryRows[0]?.precio_promedio || 0),
    };

    // Quotes summary
    const quotesSummaryRows: any[] = await query(
      `SELECT 
         COUNT(*) AS total_cotizaciones,
         COALESCE(SUM(CASE WHEN estatus='borrador' THEN 1 ELSE 0 END), 0) AS borradores,
         COALESCE(SUM(CASE WHEN estatus='enviada' THEN 1 ELSE 0 END), 0) AS enviadas,
         COALESCE(SUM(CASE WHEN estatus='aceptada' THEN 1 ELSE 0 END), 0) AS aceptadas,
         COALESCE(SUM(CASE WHEN estatus='rechazada' THEN 1 ELSE 0 END), 0) AS rechazadas,
         COALESCE(SUM(total), 0) AS monto_total,
         COALESCE(SUM(CASE WHEN estatus='aceptada' THEN total ELSE 0 END), 0) AS monto_aceptado,
         COALESCE(SUM(CASE WHEN estatus='borrador' THEN total ELSE 0 END), 0) AS monto_pendiente
       FROM quotes`
    );
    const cotizacionesResumen = {
      total_cotizaciones: Number(quotesSummaryRows[0]?.total_cotizaciones || 0),
      borradores: Number(quotesSummaryRows[0]?.borradores || 0),
      enviadas: Number(quotesSummaryRows[0]?.enviadas || 0),
      aceptadas: Number(quotesSummaryRows[0]?.aceptadas || 0),
      rechazadas: Number(quotesSummaryRows[0]?.rechazadas || 0),
      monto_total: Number(quotesSummaryRows[0]?.monto_total || 0),
      monto_aceptado: Number(quotesSummaryRows[0]?.monto_aceptado || 0),
      monto_pendiente: Number(quotesSummaryRows[0]?.monto_pendiente || 0),
    };

    // Requisitions summary
    const reqSummaryRows: any[] = await query(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN status IN ('Pending','Approved','In Transit') THEN 1 ELSE 0 END), 0) AS abiertas,
              COALESCE(SUM(CASE WHEN status='Completed' THEN 1 ELSE 0 END), 0) AS completadas,
              COALESCE(SUM(CASE WHEN type='Transfer' THEN 1 ELSE 0 END), 0) AS transferencias
       FROM requisitions`
    );
    const requisicionesResumen = {
      total: Number(reqSummaryRows[0]?.total || 0),
      abiertas: Number(reqSummaryRows[0]?.abiertas || 0),
      completadas: Number(reqSummaryRows[0]?.completadas || 0),
      transferencias: Number(reqSummaryRows[0]?.transferencias || 0),
    };

    // Top consumo artículos with sub-warehouse
    const topConsumoConSub = await query(
      `SELECT c.numero_articulo, c.descripcion,
              COALESCE(sw.nombre, '—') AS sub_almacen,
              SUM(c.cantidad) AS total_piezas,
              SUM(c.cantidad * c.precio_unitario) AS total_monto
       FROM daily_consumption c
       LEFT JOIN sub_warehouses sw ON c.sub_warehouse_id = sw.id
       ${consumoClause ? consumoClause.replace(/\bfecha\b/g, "c.fecha") : "WHERE c.fecha >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)"}
       GROUP BY c.numero_articulo, c.descripcion, COALESCE(sw.nombre, '—')
       ORDER BY total_piezas DESC LIMIT 15`,
      consumoParams
    );

    // Inventory by warehouse
    const warehouseReport = await query<{ warehouse: string; items: number; total_qty: number; total_value: number }>(
      `SELECT w.name as warehouse, COUNT(i.id) as items, 
              COALESCE(SUM(i.existencia),0) as total_qty, 
              COALESCE(SUM(i.existencia * i.precio_traxion),0) as total_value
       FROM warehouses w LEFT JOIN inventory_items i ON w.id = i.warehouse_id
       GROUP BY w.id, w.name ORDER BY total_value DESC`
    );

    // Requisitions summary by status
    const requisitionsByStatus = await query<{ status: string; count: number }>(
      `SELECT status, COUNT(*) as count FROM requisitions GROUP BY status`
    );

    // Transfers per month (last 6 months)
    const transfersByMonth = await query<{ month: string; transfers: number; items_moved: number }>(
      `SELECT DATE_FORMAT(transferred_at, '%Y-%m') as month, 
              COUNT(*) as transfers, SUM(quantity) as items_moved
       FROM transfer_log
       WHERE transferred_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY month ORDER BY month`
    );

    // Top 10 highest-value items
    const topItems = await query<{ descripcion: string; numero_articulo: string; warehouse: string; existencia: number; precio_traxion: number; precio_bisonte: number; total: number }>(
      `SELECT i.descripcion, i.numero_articulo, w.name as warehouse,
              i.existencia, i.precio_traxion, 
              i.precio_bisonte, (i.existencia * i.precio_traxion) as total
       FROM inventory_items i 
       JOIN warehouses w ON i.warehouse_id = w.id
       ORDER BY total DESC LIMIT 10`
    );

    // Commission projection (based on low-movement item reduction)
    const lowMovementRows = await query<{ total_value: number }[]>(
      `SELECT COALESCE(SUM(existencia * precio_traxion), 0) as total_value 
       FROM inventory_items WHERE movement = 'Low'`
    );
    const lowMovementValue = lowMovementRows[0]?.total_value || 0;
    const baseCommission = 15000;
    const commissionProjection = [0, 5, 10, 15, 20, 25, 30].map((reduction) => {
      const recovered = lowMovementValue * (reduction / 100);
      const bonus = recovered * 0.03;
      return { reduction, commission: Math.round(baseCommission + bonus) };
    });

    // --- Consumo Reports ---
    // Consumo por mes (últimos 6 meses)
    const consumoMensual = await query(
      `SELECT DATE_FORMAT(fecha, '%Y-%m') AS mes, 
              SUM(cantidad) AS total_piezas, 
              SUM(cantidad * precio_unitario) AS total_monto
       FROM daily_consumption 
       ${consumoClause || "WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)"}
       GROUP BY mes ORDER BY mes`
      ,
      consumoParams
    );

    // Top 10 artículos más consumidos (últimos 3 meses)
    const topConsumoArticulos = await query(
      `SELECT numero_articulo, descripcion, 
              SUM(cantidad) AS total_piezas, 
              SUM(cantidad * precio_unitario) AS total_monto
       FROM daily_consumption 
       ${consumoClause || "WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)"}
       GROUP BY numero_articulo, descripcion
       ORDER BY total_piezas DESC LIMIT 10`,
      consumoParams
    );

    // Consumo por almacén
    const consumoPorAlmacen = await query(
      `SELECT COALESCE(w.name, 'Sin Almacén') AS almacen, 
              SUM(c.cantidad) AS total_piezas, 
              SUM(c.cantidad * c.precio_unitario) AS total_monto
       FROM daily_consumption c
       LEFT JOIN warehouses w ON c.warehouse_id = w.id
       ${consumoClause ? consumoClause.replace(/\bfecha\b/g, "c.fecha") : "WHERE c.fecha >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)"}
       GROUP BY COALESCE(w.name, 'Sin Almacén') ORDER BY total_monto DESC`,
      consumoParams
    );

    const consumoPorSubAlmacen = await query(
      `SELECT COALESCE(sw.nombre, 'Sin Sub-Almacén') AS sub_almacen,
              SUM(c.cantidad) AS total_piezas,
              SUM(c.cantidad * c.precio_unitario) AS total_monto
       FROM daily_consumption c
       LEFT JOIN sub_warehouses sw ON c.sub_warehouse_id = sw.id
       ${consumoClause ? consumoClause.replace(/\bfecha\b/g, "c.fecha") : "WHERE c.fecha >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)"}
       GROUP BY COALESCE(sw.nombre, 'Sin Sub-Almacén')
       ORDER BY total_monto DESC`,
      consumoParams
    );

    // Existencia vs Consumo comparativo (top 10 por consumo)
    const comparativoStock = await query(
      `SELECT c.numero_articulo, c.descripcion,
              SUM(c.cantidad) AS consumo_3m,
              COALESCE((SELECT SUM(i.existencia) FROM inventory_items i WHERE i.numero_articulo = c.numero_articulo), 0) AS existencia_actual
       FROM daily_consumption c
       ${consumoClause ? consumoClause.replace(/\bfecha\b/g, "c.fecha") : "WHERE c.fecha >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)"}
       GROUP BY c.numero_articulo, c.descripcion
       ORDER BY consumo_3m DESC LIMIT 10`,
      consumoParams
    );

    // Trazabilidad de correcciones (si existe tabla)
    let correccionesResumen = { ediciones: 0, borrados: 0, total_afectado: 0 };
    let correccionesPorUsuario: { usuario: string; ediciones: number; borrados: number; total: number }[] = [];
    let correccionesDetalle: any[] = [];

    const logExists: any[] = await query("SHOW TABLES LIKE 'consumption_corrections_log'");
    if (logExists.length > 0) {
      const logWhere: string[] = [];
      const logParams: any[] = [];
      if (fechaInicio) {
        logWhere.push("DATE(created_at) >= ?");
        logParams.push(fechaInicio);
      }
      if (fechaFin) {
        logWhere.push("DATE(created_at) <= ?");
        logParams.push(fechaFin);
      }
      const logClause = logWhere.length > 0 ? `WHERE ${logWhere.join(" AND ")}` : "";

      const resumenRows: any[] = await query(
        `SELECT
            COALESCE(SUM(CASE WHEN action='edit' THEN records_affected ELSE 0 END),0) AS ediciones,
            COALESCE(SUM(CASE WHEN action='delete' THEN records_affected ELSE 0 END),0) AS borrados,
            COALESCE(SUM(records_affected),0) AS total_afectado
         FROM consumption_corrections_log ${logClause}`,
        logParams
      );
      correccionesResumen = {
        ediciones: Number(resumenRows[0]?.ediciones || 0),
        borrados: Number(resumenRows[0]?.borrados || 0),
        total_afectado: Number(resumenRows[0]?.total_afectado || 0),
      };

      correccionesPorUsuario = await query(
        `SELECT
            COALESCE(changed_by, 'system') AS usuario,
            SUM(CASE WHEN action='edit' THEN records_affected ELSE 0 END) AS ediciones,
            SUM(CASE WHEN action='delete' THEN records_affected ELSE 0 END) AS borrados,
            SUM(records_affected) AS total
         FROM consumption_corrections_log
         ${logClause}
         GROUP BY COALESCE(changed_by, 'system')
         ORDER BY total DESC`,
        logParams
      );

      correccionesDetalle = await query(
        `SELECT id, action, record_id, records_affected, changed_by, details, created_at
         FROM consumption_corrections_log
         ${logClause}
         ORDER BY created_at DESC
         LIMIT 100`,
        logParams
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        movementDistribution: movementDist,
        inventarioResumen,
        cotizacionesResumen,
        requisicionesResumen,
        warehouseReport,
        requisitionsByStatus,
        transfersByMonth,
        topItems,
        commissionProjection,
        consumoMensual,
        topConsumoArticulos,
        topConsumoConSub,
        consumoPorAlmacen,
        consumoPorSubAlmacen,
        comparativoStock,
        correccionesResumen,
        correccionesPorUsuario,
        correccionesDetalle,
      },
    });
  } catch (error) {
    console.error("Reports API error:", error);
    return NextResponse.json({ success: false, error: "Failed to load reports" }, { status: 500 });
  }
}
