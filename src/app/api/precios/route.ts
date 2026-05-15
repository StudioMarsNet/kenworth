import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clienteId = searchParams.get("cliente_id");
    const search = searchParams.get("search");
    const warehouseId = searchParams.get("warehouse_id");

    let markup = 0;
    let clienteNombre = "Precio Base";

    if (clienteId) {
      const clients: any[] = await query("SELECT nombre, porcentaje_markup FROM clients WHERE id = ?", [clienteId]);
      if (clients.length > 0) {
        markup = parseFloat(clients[0].porcentaje_markup) || 0;
        clienteNombre = clients[0].nombre;
      }
    }

    let sql = `
      SELECT i.numero_articulo, i.descripcion, i.precio_traxion AS precio_base, i.existencia,
             w.name AS warehouse_name
      FROM inventory_items i
      JOIN warehouses w ON i.warehouse_id = w.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      sql += ` AND (i.numero_articulo LIKE ? OR i.descripcion LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    if (warehouseId) {
      sql += ` AND i.warehouse_id = ?`;
      params.push(warehouseId);
    }

    sql += ` ORDER BY i.numero_articulo ASC`;

    const rows: any[] = await query(sql, params);

    const data = rows.map((row) => ({
      numero_articulo: row.numero_articulo,
      descripcion: row.descripcion,
      precio_base: parseFloat(row.precio_base),
      existencia: row.existencia,
      warehouse_name: row.warehouse_name,
      markup_porcentaje: markup,
      precio_cliente: Math.round(parseFloat(row.precio_base) * (1 + markup / 100) * 100) / 100,
      precio_con_iva: Math.round(parseFloat(row.precio_base) * (1 + markup / 100) * 1.16 * 100) / 100,
    }));

    return NextResponse.json({ success: true, data, cliente: clienteNombre, markup });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rows = Array.isArray(body?.rows) ? body.rows : [];

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "No se recibieron filas para actualizar" },
        { status: 400 }
      );
    }

    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      const numero = String(row.numero_articulo || "").trim();
      const precioRaw = row.precio_mostrador;
      const precio = typeof precioRaw === "number"
        ? precioRaw
        : Number(String(precioRaw || "").replace(/[$,\s]/g, ""));

      if (!numero || !Number.isFinite(precio) || precio < 0) {
        skipped++;
        continue;
      }

      const result: any = await query(
        "UPDATE inventory_items SET precio_traxion = ? WHERE numero_articulo = ?",
        [precio, numero]
      );

      const affected = Number(result?.affectedRows || 0);
      if (affected > 0) updated += affected;
      else skipped++;
    }

    return NextResponse.json({
      success: true,
      data: { updated, skipped, total_rows: rows.length },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
