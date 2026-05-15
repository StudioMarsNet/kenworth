import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subWarehouseId = searchParams.get("sub_warehouse_id");
    const search = searchParams.get("search");

    let sql = `
      SELECT
        base.sub_warehouse_id,
        base.sub_warehouse_name,
        base.parent_warehouse_name,
        base.numero_articulo,
        base.descripcion,
        base.existencia_sub,
        COALESCE(c.consumo_promedio_diario, 0) AS consumo_promedio_diario,
        CASE
          WHEN COALESCE(c.consumo_promedio_diario, 0) <= 0 THEN NULL
          ELSE ROUND(base.existencia_sub / c.consumo_promedio_diario, 1)
        END AS dias_cobertura,
        CASE
          WHEN COALESCE(c.consumo_promedio_diario, 0) <= 0 THEN 'sano'
          WHEN (base.existencia_sub / c.consumo_promedio_diario) < 7 THEN 'alto'
          WHEN (base.existencia_sub / c.consumo_promedio_diario) < 21 THEN 'medio'
          ELSE 'sano'
        END AS riesgo_quiebre,
        base.precio_traxion
      FROM (
        SELECT
          sw.id AS sub_warehouse_id,
          sw.nombre AS sub_warehouse_name,
          w.name AS parent_warehouse_name,
          i.numero_articulo,
          i.descripcion,
          MAX(i.precio_traxion) AS precio_traxion,
          (
            COALESCE(SUM(CASE WHEN r.to_sub_warehouse_id = sw.id THEN r.quantity ELSE 0 END), 0)
            -
            COALESCE(SUM(CASE WHEN r.from_sub_warehouse_id = sw.id THEN r.quantity ELSE 0 END), 0)
          ) AS existencia_sub
        FROM sub_warehouses sw
        LEFT JOIN warehouses w ON sw.parent_warehouse_id = w.id
        JOIN requisitions r
          ON (
            r.to_sub_warehouse_id = sw.id
            OR r.from_sub_warehouse_id = sw.id
          )
         AND r.status IN ('Completed', 'Closed')
        JOIN inventory_items i ON i.id = r.item_id
        WHERE sw.activo = 1
        GROUP BY
          sw.id,
          sw.nombre,
          w.name,
          i.numero_articulo,
          i.descripcion
      ) base
      LEFT JOIN (
        SELECT
          numero_articulo,
          SUM(cantidad) / GREATEST(COUNT(DISTINCT fecha), 1) AS consumo_promedio_diario
        FROM daily_consumption
        WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY numero_articulo
      ) c ON c.numero_articulo = base.numero_articulo
      WHERE base.existencia_sub > 0
    `;

    const params: any[] = [];

    if (subWarehouseId) {
      sql += " AND base.sub_warehouse_id = ?";
      params.push(Number(subWarehouseId));
    }

    if (search) {
      sql += " AND (base.numero_articulo LIKE ? OR base.descripcion LIKE ? OR base.sub_warehouse_name LIKE ?)";
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    sql += " ORDER BY base.sub_warehouse_name ASC, base.numero_articulo ASC";

    const rows: any[] = await query(sql, params);

    const summaryRows: any[] = await query(`
      SELECT
        COUNT(DISTINCT sw.id) AS sub_warehouses_con_stock,
        COALESCE(SUM(t.valor), 0) AS total_value
      FROM sub_warehouses sw
      LEFT JOIN (
        SELECT
          x.sub_warehouse_id,
          SUM(x.existencia_sub * x.precio_traxion) AS valor
        FROM (
          SELECT
            sw.id AS sub_warehouse_id,
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
          GROUP BY sw.id, i.numero_articulo
          HAVING existencia_sub > 0
        ) x
        GROUP BY x.sub_warehouse_id
      ) t ON t.sub_warehouse_id = sw.id
      WHERE sw.activo = 1 AND t.valor IS NOT NULL
    `);

    const summary = {
      sub_warehouses_con_stock: Number(summaryRows[0]?.sub_warehouses_con_stock || 0),
      total_value: Number(summaryRows[0]?.total_value || 0),
    };

    return NextResponse.json({ success: true, data: rows, summary });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
