import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { z } from "zod";

const UpdateConsumptionSchema = z.object({
  fecha: z.string().min(1),
  val_almacen: z.string().optional().nullable(),
  numero_articulo: z.string().min(1),
  descripcion: z.string().optional().nullable(),
  cantidad: z.number().int().min(1),
  precio_unitario: z.number().min(0),
  warehouse_id: z.number().int().nullable().optional(),
  sub_warehouse_id: z.number().int().nullable().optional(),
  uploaded_by: z.string().min(1),
  changed_by: z.string().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const recordId = Number(id);
    const beforeRows: any[] = await query("SELECT * FROM daily_consumption WHERE id = ?", [recordId]);
    if (beforeRows.length === 0) {
      return NextResponse.json({ success: false, error: "Registro no encontrado" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = UpdateConsumptionSchema.parse(body);

    await query(
      `UPDATE daily_consumption
       SET fecha = ?,
           val_almacen = ?,
           numero_articulo = ?,
           descripcion = ?,
           cantidad = ?,
           precio_unitario = ?,
           warehouse_id = ?,
             sub_warehouse_id = ?,
           uploaded_by = ?
       WHERE id = ?`,
      [
        parsed.fecha,
        parsed.val_almacen || null,
        parsed.numero_articulo,
        parsed.descripcion || null,
        parsed.cantidad,
        parsed.precio_unitario,
        parsed.warehouse_id ?? null,
        parsed.sub_warehouse_id ?? null,
        parsed.uploaded_by,
        recordId,
      ]
    );

    const afterRows: any[] = await query("SELECT * FROM daily_consumption WHERE id = ?", [recordId]);

    try {
      await query(
        `INSERT INTO consumption_corrections_log (action, record_id, records_affected, changed_by, details)
         VALUES ('edit', ?, 1, ?, ?)`,
        [
          recordId,
          parsed.changed_by || parsed.uploaded_by || "system",
          JSON.stringify({
            source: "quotes-edit",
            before: beforeRows[0],
            after: afterRows[0] || null,
          }),
        ]
      );
    } catch {}

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const recordId = Number(id);
    const row: any[] = await query("SELECT * FROM daily_consumption WHERE id = ?", [recordId]);
    await query("DELETE FROM daily_consumption WHERE id = ?", [recordId]);

    try {
      await query(
        `INSERT INTO consumption_corrections_log (action, record_id, records_affected, changed_by, details)
         VALUES ('delete', ?, 1, ?, ?)`,
        [
          recordId,
          row[0]?.uploaded_by || "system",
          JSON.stringify({ source: "quotes-delete", deleted_record: row[0] || null }),
        ]
      );
    } catch {}

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
