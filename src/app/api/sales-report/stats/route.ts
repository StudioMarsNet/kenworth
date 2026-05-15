import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const kpiRows: any[] = await query(`
      SELECT
        COUNT(*)                                                                    AS total_registros,
        SUM(cantidad_surtida)                                                       AS total_cantidad_surtida,
        SUM(cantidad_por_facturar)                                                  AS total_por_facturar,
        COUNT(DISTINCT id_docto_cargo)                                              AS total_documentos,
        COUNT(DISTINCT numero_articulo)                                             AS total_articulos_distintos,
        COUNT(DISTINCT DATE(fecha))                                                 AS dias_activos,
        SUM(CASE WHEN estado_venta = 'Facturada' THEN 1 ELSE 0 END)                AS facturadas,
        SUM(CASE WHEN estado_venta = 'Devuelta' THEN 1 ELSE 0 END)                 AS devueltas,
        SUM(CASE WHEN estado_venta LIKE '%Parcialmente%' THEN 1 ELSE 0 END)        AS parciales,
        SUM(CASE WHEN estado_venta = 'Sin Imprimir' THEN 1 ELSE 0 END)             AS sin_imprimir,
        SUM(CASE WHEN estado_venta = 'Impresa' THEN 1 ELSE 0 END)                  AS impresas,
        SUM(CASE WHEN folio_factura IS NOT NULL AND folio_factura != '' THEN 1 ELSE 0 END) AS con_factura
      FROM ventas_reporte
    `);
    const kpis = kpiRows[0] || {};

    const porEstado: any[] = await query(`
      SELECT estado_venta, COUNT(*) AS count, SUM(cantidad_surtida) AS cantidad
      FROM ventas_reporte
      GROUP BY estado_venta
      ORDER BY count DESC
    `);

    const porMes: any[] = await query(`
      SELECT DATE_FORMAT(fecha, '%Y-%m') AS mes, COUNT(*) AS count, SUM(cantidad_surtida) AS cantidad
      FROM ventas_reporte
      WHERE fecha IS NOT NULL
      GROUP BY mes
      ORDER BY mes ASC
    `);

    const topArticulos: any[] = await query(`
      SELECT numero_articulo, descripcion, SUM(cantidad_surtida) AS cantidad_total, COUNT(*) AS num_transacciones
      FROM ventas_reporte
      GROUP BY numero_articulo, descripcion
      ORDER BY cantidad_total DESC
      LIMIT 15
    `);

    const topUsuarios: any[] = await query(`
      SELECT usuario_alta, COUNT(*) AS count, SUM(cantidad_surtida) AS cantidad
      FROM ventas_reporte
      WHERE usuario_alta IS NOT NULL AND usuario_alta != ''
      GROUP BY usuario_alta
      ORDER BY count DESC
      LIMIT 10
    `);

    const rescatesVinculados: any[] = await query(`
      SELECT COUNT(DISTINCT r.id) AS rescates_con_venta
      FROM rescates r
      WHERE EXISTS (SELECT 1 FROM ventas_reporte v WHERE CAST(v.id_docto_cargo AS CHAR) = r.folio_interno)
    `);

    return NextResponse.json({ success: true, data: { kpis, porEstado, porMes, topArticulos, topUsuarios, rescatesVinculados: rescatesVinculados[0] || {} } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
