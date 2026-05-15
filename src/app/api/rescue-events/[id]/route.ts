import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rows: any[] = await query("SELECT * FROM rescue_events WHERE id = ?", [id]);
    if (!rows.length) return NextResponse.json({ success: false, error: "Evento no encontrado" }, { status: 404 });
    const event = rows[0];

    const items: any[] = await query("SELECT * FROM rescue_items WHERE event_id = ? ORDER BY id ASC", [id]);

    let ventasRelacionadas: any[] = [];
    if (event.folio_interno) {
      ventasRelacionadas = await query(
        `SELECT * FROM ventas_reporte WHERE CAST(id_docto_cargo AS CHAR) = ? ORDER BY fecha DESC`,
        [String(event.folio_interno)]
      );
    }

    return NextResponse.json({ success: true, data: { ...event, items, ventas_relacionadas: ventasRelacionadas } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const allowed = ["fecha", "folio_interno", "tipo", "destino", "tecnico", "unidad", "bisonte", "kw", "vales", "observaciones", "imagen_url"];
    const fields = Object.keys(body).filter(k => allowed.includes(k));
    if (!fields.length) return NextResponse.json({ success: false, error: "Sin campos válidos" }, { status: 400 });
    const set = fields.map(f => `${f} = ?`).join(", ");
    const vals = fields.map(f => body[f] ?? null);
    await query(`UPDATE rescue_events SET ${set} WHERE id = ?`, [...vals, id]);
    const [updated] = await query("SELECT * FROM rescue_events WHERE id = ?", [id]) as any[];
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await query("DELETE FROM rescue_events WHERE id = ?", [id]); // CASCADE deletes items
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
