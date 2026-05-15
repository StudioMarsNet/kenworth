import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { z } from "zod";

const CreateWarehouseSchema = z.object({
  name: z.string().min(1).max(100),
  location: z.string().max(255).optional(),
});

export async function GET() {
  try {
    const rows = await query(`
      SELECT w.*,
             COUNT(i.id) AS item_count,
             COALESCE(SUM(i.existencia * i.precio_traxion), 0) AS total_value
      FROM warehouses w
      LEFT JOIN inventory_items i ON w.id = i.warehouse_id
      GROUP BY w.id
      ORDER BY w.name ASC
    `);
    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateWarehouseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, location } = parsed.data;

    const existing = await query(
      "SELECT id FROM warehouses WHERE name = ?",
      [name]
    );
    if ((existing as any[]).length > 0) {
      return NextResponse.json(
        { success: false, error: "Warehouse name already exists" },
        { status: 400 }
      );
    }

    await query(
      "INSERT INTO warehouses (name, location) VALUES (?, ?)",
      [name, location || null]
    );

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
