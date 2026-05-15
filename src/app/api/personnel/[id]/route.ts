import { NextResponse, NextRequest } from "next/server";
import { query } from "@/lib/db";
import { z } from "zod";

const UpdateSchema = z.object({
  nombre: z.string().min(1).optional(),
  rol: z.enum(["vendedor", "almacenista", "gerente_almacen", "gerente_ventas"]).optional(),
  activo: z.number().min(0).max(1).optional(),
});

// PUT - update personnel
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateSchema.parse(body);

    const fields: string[] = [];
    const values: any[] = [];
    if (parsed.nombre) { fields.push("nombre = ?"); values.push(parsed.nombre); }
    if (parsed.rol) { fields.push("rol = ?"); values.push(parsed.rol); }
    if (parsed.activo !== undefined) { fields.push("activo = ?"); values.push(parsed.activo); }

    if (fields.length === 0) {
      return NextResponse.json({ success: false, error: "Sin campos" }, { status: 400 });
    }
    values.push(id);
    await query(`UPDATE personnel SET ${fields.join(", ")} WHERE id = ?`, values);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - soft-delete (set activo=0)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await query("UPDATE personnel SET activo = 0 WHERE id = ?", [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
