import { NextRequest, NextResponse } from "next/server";
import { getConnection, query } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fechaInicio = searchParams.get("fecha_inicio");
    const fechaFin = searchParams.get("fecha_fin");
    const warehouseId = searchParams.get("warehouse_id");
    const subWarehouseId = searchParams.get("sub_warehouse_id");
    const fecha = searchParams.get("fecha");

    let sql = `
      SELECT cd.*, w.name AS warehouse_name, sw.nombre AS sub_warehouse_name
      FROM daily_consumption cd
      LEFT JOIN warehouses w ON cd.warehouse_id = w.id
      LEFT JOIN sub_warehouses sw ON cd.sub_warehouse_id = sw.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (fecha) {
      sql += ` AND cd.fecha = ?`;
      params.push(fecha);
    }
    if (fechaInicio) {
      sql += ` AND cd.fecha >= ?`;
      params.push(fechaInicio);
    }
    if (fechaFin) {
      sql += ` AND cd.fecha <= ?`;
      params.push(fechaFin);
    }
    if (warehouseId) {
      sql += ` AND cd.warehouse_id = ?`;
      params.push(warehouseId);
    }
    if (subWarehouseId) {
      sql += ` AND cd.sub_warehouse_id = ?`;
      params.push(subWarehouseId);
    }

    sql += ` ORDER BY cd.fecha DESC, cd.id DESC`;

    const rows = await query(sql, params);

    // Also get daily totals
    let totalSql = `
      SELECT fecha,
        SUM(cantidad) AS total_piezas,
        SUM(cantidad * precio_unitario) AS total_monto,
        COUNT(DISTINCT numero_articulo) AS articulos_distintos
      FROM daily_consumption
      WHERE 1=1
    `;
    const totalParams: any[] = [];

    if (fecha) {
      totalSql += ` AND fecha = ?`;
      totalParams.push(fecha);
    }
    if (fechaInicio) {
      totalSql += ` AND fecha >= ?`;
      totalParams.push(fechaInicio);
    }
    if (fechaFin) {
      totalSql += ` AND fecha <= ?`;
      totalParams.push(fechaFin);
    }
    if (warehouseId) {
      totalSql += ` AND warehouse_id = ?`;
      totalParams.push(warehouseId);
    }
    if (subWarehouseId) {
      totalSql += ` AND sub_warehouse_id = ?`;
      totalParams.push(subWarehouseId);
    }

    totalSql += ` GROUP BY fecha ORDER BY fecha DESC`;

    const totals = await query(totalSql, totalParams);

    return NextResponse.json({ success: true, data: rows, totals });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const conn = await getConnection();
  try {
    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids)
      ? body.ids.map((id: any) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0)
      : [];
    const mode = String(body?.mode || "");

    const fechaInicio = body?.fecha_inicio ? String(body.fecha_inicio) : null;
    const fechaFin = body?.fecha_fin ? String(body.fecha_fin) : null;
    const warehouseId = body?.warehouse_id ? Number(body.warehouse_id) : null;
    const subWarehouseId = body?.sub_warehouse_id ? Number(body.sub_warehouse_id) : null;

    const shouldDeleteAllByFilter = mode === "all";
    const hasFilters = Boolean(
      fechaInicio || fechaFin ||
      (warehouseId && Number.isFinite(warehouseId)) ||
      (subWarehouseId && Number.isFinite(subWarehouseId))
    );
    const changedBy = body?.changed_by ? String(body.changed_by) : "system";

    if (ids.length === 0 && !shouldDeleteAllByFilter) {
      return NextResponse.json(
        { success: false, error: "Debes enviar ids para borrado parcial o mode=all para borrado total" },
        { status: 400 }
      );
    }

    if (shouldDeleteAllByFilter && !hasFilters && body?.confirm_all !== true) {
      return NextResponse.json(
        { success: false, error: "Para borrado global total envía confirm_all=true" },
        { status: 400 }
      );
    }

    await conn.beginTransaction();

    let deleted = 0;

    if (ids.length > 0) {
      const placeholders = ids.map(() => "?").join(",");
      const [result]: any = await conn.execute(`DELETE FROM daily_consumption WHERE id IN (${placeholders})`, ids);
      deleted = Number(result?.affectedRows || 0);

      if (deleted > 0) {
        try {
          await conn.execute(
            `INSERT INTO consumption_corrections_log (action, record_id, records_affected, changed_by, details)
             VALUES ('delete', NULL, ?, ?, ?)`,
            [deleted, changedBy, `Borrado parcial por ids (${ids.length})`]
          );
        } catch {}
      }
    } else {
      let sql = "DELETE FROM daily_consumption WHERE 1=1";
      const params: any[] = [];
      if (fechaInicio) {
        sql += " AND fecha >= ?";
        params.push(fechaInicio);
      }
      if (fechaFin) {
        sql += " AND fecha <= ?";
        params.push(fechaFin);
      }
      if (warehouseId && Number.isFinite(warehouseId)) {
        sql += " AND warehouse_id = ?";
        params.push(warehouseId);
      }
      if (subWarehouseId && Number.isFinite(subWarehouseId)) {
        sql += " AND sub_warehouse_id = ?";
        params.push(subWarehouseId);
      }
      const [result]: any = await conn.execute(sql, params);
      deleted = Number(result?.affectedRows || 0);

      if (deleted > 0) {
        try {
          await conn.execute(
            `INSERT INTO consumption_corrections_log (action, record_id, records_affected, changed_by, details)
             VALUES ('delete', NULL, ?, ?, ?)`,
            [deleted, changedBy, hasFilters ? "Borrado por filtros" : "Borrado total global"]
          );
        } catch {}
      }
    }

    await conn.commit();
    return NextResponse.json({ success: true, data: { deleted } });
  } catch (error: any) {
    await conn.rollback();
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    conn.release();
  }
}
