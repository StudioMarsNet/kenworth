import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET all items of an event
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const items = await query("SELECT * FROM rescue_items WHERE event_id = ? ORDER BY id ASC", [id]);
    return NextResponse.json({ success: true, data: items });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST add one item to event
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const item = await req.json();
    const result: any = await query(
      `INSERT INTO rescue_items
        (event_id, numero_articulo, descripcion, cantidad_entregada, cantidad_devuelta, cantidad_usada, cantidad_pendiente,
         status_bisonte, status_kw, cantidad_surtida, cantidad_por_facturar, id_docto_cargo, folio_factura,
         serie_factura, tipo_documento, estado_venta, fecha_vencimiento, usuario_alta, oc_cliente, no_docto_venta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, item.numero_articulo || null, item.descripcion || null,
       item.cantidad_entregada || 0, item.cantidad_devuelta || 0, item.cantidad_usada || 0, item.cantidad_pendiente || 0,
       item.status_bisonte || null, item.status_kw || null,
       item.cantidad_surtida || 0, item.cantidad_por_facturar || 0,
       item.id_docto_cargo || null, item.folio_factura || null, item.serie_factura || null,
       item.tipo_documento || null, item.estado_venta || null, item.fecha_vencimiento || null,
       item.usuario_alta || null, item.oc_cliente || null, item.no_docto_venta || null]
    );
    const [created] = await query("SELECT * FROM rescue_items WHERE id = ?", [result.insertId]) as any[];
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
