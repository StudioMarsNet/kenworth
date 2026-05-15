import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// PUT - update individual item (status fields + quantities)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params;
    const body = await req.json();
    const allowed = [
      "numero_articulo", "descripcion",
      "cantidad_entregada", "cantidad_devuelta", "cantidad_usada", "cantidad_pendiente",
      "status_bisonte", "status_kw",
      "cantidad_surtida", "cantidad_por_facturar", "id_docto_cargo", "folio_factura",
      "serie_factura", "tipo_documento", "estado_venta", "fecha_vencimiento",
      "usuario_alta", "oc_cliente", "no_docto_venta"
    ];
    const fields = Object.keys(body).filter(k => allowed.includes(k));
    if (!fields.length) return NextResponse.json({ success: false, error: "Sin campos válidos" }, { status: 400 });
    const set = fields.map(f => `${f} = ?`).join(", ");
    const vals = fields.map(f => body[f] ?? null);
    await query(`UPDATE rescue_items SET ${set} WHERE id = ? AND event_id = ?`, [...vals, itemId, id]);
    const [updated] = await query("SELECT * FROM rescue_items WHERE id = ?", [itemId]) as any[];
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - remove individual item
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params;
    await query("DELETE FROM rescue_items WHERE id = ? AND event_id = ?", [itemId, id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
