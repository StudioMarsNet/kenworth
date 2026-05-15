import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { z } from "zod";

const CreateSchema = z.object({
  nombre: z.string().min(1).max(100),
  parent_warehouse_id: z.coerce.number().int().positive().nullable().optional(),
  ubicacion: z.string().max(200).optional().nullable(),
  descripcion: z.string().optional().nullable(),
});

export async function GET() {
  try {
    const rows = await query(`
      SELECT sw.*, w.name AS parent_warehouse_name
      FROM sub_warehouses sw
      LEFT JOIN warehouses w ON sw.parent_warehouse_id = w.id
      WHERE sw.activo = 1
      ORDER BY sw.nombre ASC
    `);
    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { nombre, parent_warehouse_id, ubicacion, descripcion } = parsed.data;

    const existing: any[] = await query(
      "SELECT id FROM sub_warehouses WHERE nombre = ? AND activo = 1",
      [nombre]
    );
    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: "Ya existe un sub-almacén con ese nombre" },
        { status: 400 }
      );
    }

    const result: any = await query(
      "INSERT INTO sub_warehouses (nombre, parent_warehouse_id, ubicacion, descripcion) VALUES (?, ?, ?, ?)",
      [nombre, parent_warehouse_id ?? null, ubicacion ?? null, descripcion ?? null]
    );
    return NextResponse.json({ success: true, data: { id: result.insertId } }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
