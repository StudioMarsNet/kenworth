import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { z } from "zod";

const UpdateSchema = z.object({
  nombre: z.string().min(1).max(100).optional(),
  parent_warehouse_id: z.coerce.number().int().positive().nullable().optional(),
  ubicacion: z.string().max(200).nullable().optional(),
  descripcion: z.string().nullable().optional(),
  activo: z.coerce.number().int().min(0).max(1).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const fields = parsed.data;
    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ success: false, error: "No hay campos para actualizar" }, { status: 400 });
    }

    const existing: any[] = await query("SELECT id FROM sub_warehouses WHERE id = ?", [id]);
    if (existing.length === 0) {
      return NextResponse.json({ success: false, error: "Sub-almacén no encontrado" }, { status: 404 });
    }

    const setClauses = Object.keys(fields).map((k) => `${k} = ?`);
    const values = [...Object.values(fields), id];
    await query(`UPDATE sub_warehouses SET ${setClauses.join(", ")} WHERE id = ?`, values);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Soft-delete
    await query("UPDATE sub_warehouses SET activo = 0 WHERE id = ?", [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
