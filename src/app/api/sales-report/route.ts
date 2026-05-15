import { NextResponse, NextRequest } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const estado = searchParams.get("estado");
    const numero_articulo = searchParams.get("numero_articulo");
    const usuario = searchParams.get("usuario");
    const fecha_desde = searchParams.get("fecha_desde");
    const fecha_hasta = searchParams.get("fecha_hasta");
    const q = searchParams.get("q");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(200, parseInt(searchParams.get("limit") || "50"));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];

    if (estado) { conditions.push("estado_venta = ?"); params.push(estado); }
    if (numero_articulo) { conditions.push("numero_articulo LIKE ?"); params.push(`%${numero_articulo}%`); }
    if (usuario) { conditions.push("usuario_alta LIKE ?"); params.push(`%${usuario}%`); }
    if (fecha_desde) { conditions.push("DATE(fecha) >= ?"); params.push(fecha_desde); }
    if (fecha_hasta) { conditions.push("DATE(fecha) <= ?"); params.push(fecha_hasta); }
    if (q) {
      conditions.push("(numero_articulo LIKE ? OR descripcion LIKE ? OR folio_factura LIKE ? OR observaciones LIKE ?)");
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const countRows: any[] = await query(`SELECT COUNT(*) AS total FROM ventas_reporte ${where}`, params);
    const total = Number(countRows[0]?.total || 0);
    const rows = await query(
      `SELECT v.*,
         (SELECT COUNT(*) FROM rescates r WHERE r.folio_interno = CAST(v.id_docto_cargo AS CHAR)) AS tiene_rescate
       FROM ventas_reporte v ${where} ORDER BY v.fecha DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return NextResponse.json({ success: true, data: rows, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
