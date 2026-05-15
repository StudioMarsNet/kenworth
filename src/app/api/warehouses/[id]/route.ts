import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { z } from "zod";

const UpdateWarehouseSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  location: z.string().max(255).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateWarehouseSchema.safeParse(body);

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

    // Check uniqueness if name is being updated
    if (fields.name) {
      const dup = await query(
        "SELECT id FROM warehouses WHERE name = ? AND id != ?",
        [fields.name, id]
      );
      if ((dup as any[]).length > 0) {
        return NextResponse.json(
          { success: false, error: "Warehouse name already exists" },
          { status: 400 }
        );
      }
    }

    const setClauses: string[] = [];
    const values: any[] = [];
    for (const [key, value] of Object.entries(fields)) {
      setClauses.push(`${key} = ?`);
      values.push(value);
    }
    values.push(id);

    const result: any = await query(
      `UPDATE warehouses SET ${setClauses.join(", ")} WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: "Warehouse not found" },
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check for associated items
    const items = await query(
      "SELECT id FROM inventory_items WHERE warehouse_id = ? LIMIT 1",
      [id]
    );
    if ((items as any[]).length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot delete: warehouse has inventory items",
        },
        { status: 400 }
      );
    }

    const result: any = await query("DELETE FROM warehouses WHERE id = ?", [
      id,
    ]);
    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: "Warehouse not found" },
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
