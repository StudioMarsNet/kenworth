import { NextResponse, NextRequest } from "next/server";
import { query } from "@/lib/db";
import { z } from "zod";

const UpdateRescueSchema = z.object({
  fecha: z.string().optional(),
  folio_interno: z.string().optional().nullable(),
  tipo: z.enum(["RESCATE", "MTTO"]).optional(),
  destino: z.string().optional().nullable(),
  item: z.string().optional().nullable(),
  descripcion: z.string().optional().nullable(),
  cantidad_entregada: z.number().optional(),
  cantidad_devuelta: z.number().optional(),
  cantidad_usada: z.number().optional(),
  cantidad_pendiente: z.number().optional(),
  status_bisonte: z.string().optional().nullable(),
  status_kw: z.string().optional().nullable(),
  tecnico: z.string().optional().nullable(),
  unidad: z.string().optional().nullable(),
  bisonte: z.string().optional().nullable(),
  kw: z.string().optional().nullable(),
  vales: z.string().optional().nullable(),
  observaciones: z.string().optional().nullable(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rows: any[] = await query("SELECT * FROM rescates WHERE id = ?", [id]);
    if (!rows.length) return NextResponse.json({ success: false, error: "No encontrado" }, { status: 404 });
    const rescate = rows[0];
    let ventasRelacionadas: any[] = [];
    if (rescate.folio_interno) {
      ventasRelacionadas = await query(
        `SELECT * FROM ventas_reporte WHERE CAST(id_docto_cargo AS CHAR) = ? ORDER BY fecha DESC`,
        [String(rescate.folio_interno)]
      );
    }
    return NextResponse.json({ success: true, data: { ...rescate, ventas_relacionadas: ventasRelacionadas } });
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
    const parsed = UpdateRescueSchema.parse(body);
    const fields = Object.keys(parsed) as (keyof typeof parsed)[];
    if (!fields.length) return NextResponse.json({ success: false, error: "Sin cambios" }, { status: 400 });
    const setClauses = fields.map(f => `${f} = ?`).join(", ");
    const values = fields.map(f => parsed[f] ?? null);
    await query(`UPDATE rescates SET ${setClauses} WHERE id = ?`, [...values, id]);
    const [updated] = await query("SELECT * FROM rescates WHERE id = ?", [id]) as any[];
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
    await query("DELETE FROM rescates WHERE id = ?", [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
