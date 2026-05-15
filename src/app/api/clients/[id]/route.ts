import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { z } from "zod";

const UpdateClienteSchema = z.object({
  nombre: z.string().min(1).max(100).optional(),
  porcentaje_markup: z.coerce.number().min(0).max(100).optional(),
  contacto: z.string().max(255).optional(),
  notas: z.string().optional(),
  activo: z.boolean().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateClienteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const fields = parsed.data;
    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ success: false, error: "No hay campos para actualizar" }, { status: 400 });
    }

    const existing = await query("SELECT id FROM clients WHERE id = ?", [id]);
    if ((existing as any[]).length === 0) {
      return NextResponse.json({ success: false, error: "Cliente no encontrado" }, { status: 404 });
    }

    const setClauses: string[] = [];
    const values: any[] = [];
    for (const [key, value] of Object.entries(fields)) {
      setClauses.push(`${key} = ?`);
      values.push(value);
    }
    values.push(id);

    await query(`UPDATE clients SET ${setClauses.join(", ")} WHERE id = ?`, values);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result: any = await query("DELETE FROM clients WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return NextResponse.json({ success: false, error: "Cliente no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
