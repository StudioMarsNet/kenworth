import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET - list rescue events with item count, filters, pagination
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tipo = searchParams.get("tipo");
    const q = searchParams.get("q");
    const fecha_desde = searchParams.get("fecha_desde");
    const fecha_hasta = searchParams.get("fecha_hasta");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, parseInt(searchParams.get("limit") || "20"));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];

    if (tipo) { conditions.push("e.tipo = ?"); params.push(tipo); }
    if (fecha_desde) { conditions.push("e.fecha >= ?"); params.push(fecha_desde); }
    if (fecha_hasta) { conditions.push("e.fecha <= ?"); params.push(fecha_hasta); }
    if (q) {
      conditions.push("(e.folio_interno LIKE ? OR e.destino LIKE ? OR e.tecnico LIKE ? OR e.unidad LIKE ? OR e.vales LIKE ? OR EXISTS (SELECT 1 FROM rescue_items ri WHERE ri.event_id = e.id AND (ri.numero_articulo LIKE ? OR ri.descripcion LIKE ?)))");
      const lk = `%${q}%`;
      params.push(lk, lk, lk, lk, lk, lk, lk);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRows: any[] = await query(`SELECT COUNT(*) AS total FROM rescue_events e ${where}`, params);
    const total = Number(countRows[0]?.total || 0);

    const rows: any[] = await query(`
      SELECT e.*,
        COUNT(ri.id)                                       AS num_items,
        SUM(ri.cantidad_pendiente)                         AS total_pendiente,
        GROUP_CONCAT(DISTINCT ri.status_kw SEPARATOR '|') AS statuses_kw,
        (SELECT COUNT(*) FROM ventas_reporte v WHERE CAST(v.id_docto_cargo AS CHAR) = e.folio_interno) AS ventas_count
      FROM rescue_events e
      LEFT JOIN rescue_items ri ON ri.event_id = e.id
      ${where}
      GROUP BY e.id
      ORDER BY e.fecha DESC, e.id DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    return NextResponse.json({ success: true, data: rows, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - create a rescue event with items
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event, items = [] } = body;

    if (!event?.fecha || !event?.tipo) {
      return NextResponse.json({ success: false, error: "fecha y tipo son requeridos" }, { status: 400 });
    }

    // Insert event header
    const result: any = await query(
      `INSERT INTO rescue_events (fecha, folio_interno, tipo, destino, tecnico, unidad, bisonte, kw, vales, observaciones, imagen_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [event.fecha, event.folio_interno || null, event.tipo,
       event.destino || null, event.tecnico || null, event.unidad || null,
       event.bisonte || null, event.kw || null, event.vales || null,
       event.observaciones || null, event.imagen_url || null]
    );
    const eventId = result.insertId;

    // Insert items
    for (const item of items) {
      await query(
        `INSERT INTO rescue_items
          (event_id, numero_articulo, descripcion, cantidad_entregada, cantidad_devuelta, cantidad_usada, cantidad_pendiente, status_bisonte, status_kw,
           cantidad_surtida, cantidad_por_facturar, id_docto_cargo, folio_factura, serie_factura, tipo_documento, estado_venta, fecha_vencimiento, usuario_alta, oc_cliente, no_docto_venta)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [eventId, item.numero_articulo || null, item.descripcion || null,
         item.cantidad_entregada || 0, item.cantidad_devuelta || 0, item.cantidad_usada || 0, item.cantidad_pendiente || 0,
         item.status_bisonte || null, item.status_kw || null,
         item.cantidad_surtida || 0, item.cantidad_por_facturar || 0,
         item.id_docto_cargo || null, item.folio_factura || null, item.serie_factura || null,
         item.tipo_documento || null, item.estado_venta || null, item.fecha_vencimiento || null,
         item.usuario_alta || null, item.oc_cliente || null, item.no_docto_venta || null]
      );
    }

    const [created] = await query("SELECT * FROM rescue_events WHERE id = ?", [eventId]) as any[];
    return NextResponse.json({ success: true, data: { ...created, items_created: items.length } }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
