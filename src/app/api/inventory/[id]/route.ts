import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { z } from "zod";

const UpdateItemSchema = z.object({
  descripcion: z.string().min(1).max(500).optional(),
  ubicacion: z.string().max(100).optional(),
  stand: z.string().max(50).optional(),
  tipo_articulo: z.string().max(50).optional(),
  existencia: z.coerce.number().int().min(0).optional(),
  precio_traxion: z.coerce.number().min(0).optional(),
  warehouse_id: z.coerce.number().int().positive().optional(),
  sucursal: z.string().max(100).optional(),
  movement: z.enum(["high", "medium", "low"]).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const fields = parsed.data;
    if (Object.keys(fields).length === 0) {
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 }
      );
    }

    // Check item exists
    const existing = await query(
      "SELECT id FROM inventory_items WHERE id = ?",
      [id]
    );
    if ((existing as any[]).length === 0) {
      return NextResponse.json(
        { success: false, error: "Item not found" },
        { status: 404 }
      );
    }

    const setClauses: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(fields)) {
      setClauses.push(`${key} = ?`);
      values.push(value);
    }
    values.push(id);

    await query(
      `UPDATE inventory_items SET ${setClauses.join(", ")} WHERE id = ?`,
      values
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check for active requisitions
    const activeReqs = await query(
      `SELECT id FROM requisitions WHERE item_id = ? AND status IN ('Pending','Approved','In Transit')`,
      [id]
    );
    if ((activeReqs as any[]).length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot delete: item has active requisitions",
        },
        { status: 400 }
      );
    }

    const result: any = await query(
      "DELETE FROM inventory_items WHERE id = ?",
      [id]
    );
    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: "Item not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
