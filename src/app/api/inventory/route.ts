import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { z } from "zod";

const CreateItemSchema = z.object({
  numero_articulo: z.string().min(1).max(50),
  descripcion: z.string().min(1).max(500),
  ubicacion: z.string().max(100).optional().default(""),
  stand: z.string().max(50).optional().default(""),
  tipo_articulo: z.string().max(50).optional().default("Normal"),
  existencia: z.coerce.number().int().min(0).default(0),
  precio_traxion: z.coerce.number().min(0).default(0),
  warehouse_id: z.coerce.number().int().positive(),
  sucursal: z.string().max(100).optional().default(""),
  movement: z.enum(["high", "medium", "low"]).default("medium"),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const warehouse = searchParams.get("warehouse");
    const movement = searchParams.get("movement");
    const search = searchParams.get("search");
    const stand = searchParams.get("stand");
    const risk = searchParams.get("risk");

    let sql = `
      SELECT
        i.*,
        w.name AS warehouse_name,
        COALESCE(c.consumo_promedio_diario, 0) AS consumo_promedio_diario,
        COALESCE(c.consumo_mensual, 0) AS consumo_mensual,
        CASE
          WHEN COALESCE(c.consumo_promedio_diario, 0) <= 0 THEN NULL
          ELSE ROUND(i.existencia / c.consumo_promedio_diario, 1)
        END AS dias_cobertura,
        CASE
          WHEN COALESCE(c.consumo_promedio_diario, 0) <= 0 THEN 'sano'
          WHEN (i.existencia / c.consumo_promedio_diario) < 7 THEN 'alto'
          WHEN (i.existencia / c.consumo_promedio_diario) < 21 THEN 'medio'
          ELSE 'sano'
        END AS riesgo_quiebre
      FROM inventory_items i
      JOIN warehouses w ON i.warehouse_id = w.id
      LEFT JOIN (
        SELECT
          numero_articulo,
          SUM(cantidad) AS consumo_mensual,
          SUM(cantidad) / GREATEST(COUNT(DISTINCT fecha), 1) AS consumo_promedio_diario
        FROM daily_consumption
        WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY numero_articulo
      ) c ON c.numero_articulo = i.numero_articulo
      WHERE 1=1
    `;
    const params: any[] = [];

    if (warehouse) {
      sql += ` AND i.warehouse_id = ?`;
      params.push(warehouse);
    }
    if (movement && ["high", "medium", "low"].includes(movement)) {
      sql += ` AND i.movement = ?`;
      params.push(movement);
    }
    if (stand) {
      sql += ` AND i.stand = ?`;
      params.push(stand);
    }
    if (search) {
      sql += ` AND (i.numero_articulo LIKE ? OR i.descripcion LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    if (risk && ["alto", "medio", "sano"].includes(risk)) {
      sql += ` AND (
        CASE
          WHEN COALESCE(c.consumo_promedio_diario, 0) <= 0 THEN 'sano'
          WHEN (i.existencia / c.consumo_promedio_diario) < 7 THEN 'alto'
          WHEN (i.existencia / c.consumo_promedio_diario) < 21 THEN 'medio'
          ELSE 'sano'
        END
      ) = ?`;
      params.push(risk);
    }

    sql += ` ORDER BY i.numero_articulo ASC`;

    const rows = await query(sql, params);
    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const result: any = await query("DELETE FROM inventory_items");
    return NextResponse.json({ success: true, data: { deleted: result.affectedRows ?? 0 } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { numero_articulo, descripcion, ubicacion, stand, tipo_articulo, existencia, precio_traxion, warehouse_id, sucursal, movement } =
      parsed.data;

    const existing: any[] = await query(
      "SELECT id FROM inventory_items WHERE numero_articulo = ? AND warehouse_id = ?",
      [numero_articulo, warehouse_id]
    );
    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: "Este artículo ya existe en este almacén" },
        { status: 400 }
      );
    }

    const wh: any[] = await query("SELECT id FROM warehouses WHERE id = ?", [warehouse_id]);
    if (wh.length === 0) {
      return NextResponse.json(
        { success: false, error: "Almacén no encontrado" },
        { status: 400 }
      );
    }

    await query(
      `INSERT INTO inventory_items (numero_articulo, descripcion, ubicacion, stand, tipo_articulo, existencia, precio_traxion, warehouse_id, sucursal, movement)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [numero_articulo, descripcion, ubicacion, stand, tipo_articulo, existencia, precio_traxion, warehouse_id, sucursal, movement]
    );

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
