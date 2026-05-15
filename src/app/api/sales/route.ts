import { NextResponse, NextRequest } from "next/server";
import { getConnection, query } from "@/lib/db";
import { z } from "zod";

// Generate folio: COT-YYYYMMDD-XXXX
async function generateFolio(): Promise<string> {
  const today = new Date();
  const prefix = `COT-${today.getFullYear()}${String(today.getMonth()+1).padStart(2,"0")}${String(today.getDate()).padStart(2,"0")}`;
  const rows: any[] = await query(
    "SELECT COUNT(*) AS cnt FROM quotes WHERE folio LIKE ?",
    [`${prefix}%`]
  );
  const seq = (Number(rows[0]?.cnt || 0) + 1).toString().padStart(4, "0");
  return `${prefix}-${seq}`;
}

const ItemSchema = z.object({
  numero_articulo: z.string().min(1),
  descripcion: z.string().min(1),
  cantidad: z.number().int().min(1),
  precio_unitario: z.number().min(0),
  descuento: z.number().min(0).max(100).default(0),
});

const CreateSaleSchema = z.object({
  cliente_id: z.number().nullable().optional(),
  cliente_nombre: z.string().min(1),
  vendedor: z.string().optional(),
  moneda: z.enum(["MXN", "USD"]).default("MXN"),
  tipo_cambio: z.number().min(0).default(1),
  notas: z.string().optional(),
  vigencia: z.string().optional(),
  folio_sitic: z.string().regex(/^\d{7}$/, "Folio SITIC debe tener exactamente 7 dígitos"),
  no_docto: z.string().regex(/^\d{4}$/, "No. Docto debe tener exactamente 4 dígitos"),
  fecha_consumo: z.string().optional(),
  items: z.array(ItemSchema).min(1),
});

// GET - list cotizaciones
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const estatus = searchParams.get("estatus");
    let sql = `SELECT s.*, c.nombre AS cliente_ref,
                 (SELECT COUNT(*) FROM quote_items ci WHERE ci.cotizacion_id = s.id) AS num_items
               FROM quotes s
               LEFT JOIN clients c ON s.cliente_id = c.id`;
    const params: any[] = [];
    if (estatus) {
      sql += " WHERE s.estatus = ?";
      params.push(estatus);
    }
    sql += " ORDER BY s.created_at DESC LIMIT 100";
    const rows = await query(sql, params);
    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - create cotización
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateSaleSchema.parse(body);
    const folio = await generateFolio();

    // Calculate totals
    let subtotal = 0;
    const itemsCalc = parsed.items.map((item) => {
      const importe = item.cantidad * item.precio_unitario * (1 - (item.descuento || 0) / 100);
      subtotal += importe;
      return { ...item, importe: Math.round(importe * 100) / 100 };
    });
    const iva = Math.round(subtotal * 0.16 * 100) / 100;
    const total = Math.round((subtotal + iva) * 100) / 100;

    // Insert cotización
    const result: any = await query(
      `INSERT INTO quotes (folio, folio_sitic, no_docto, cliente_id, cliente_nombre, vendedor, subtotal, iva, total, moneda, tipo_cambio, notas, vigencia, fecha_consumo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [folio, parsed.folio_sitic, parsed.no_docto, parsed.cliente_id || null, parsed.cliente_nombre, parsed.vendedor || null,
       subtotal, iva, total, parsed.moneda, parsed.tipo_cambio, parsed.notas || null, parsed.vigencia || null, parsed.fecha_consumo || null]
    );
    const cotizacionId = result.insertId;

    // Insert items
    for (const item of itemsCalc) {
      await query(
        `INSERT INTO quote_items (cotizacion_id, numero_articulo, descripcion, cantidad, precio_unitario, descuento, importe)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [cotizacionId, item.numero_articulo, item.descripcion, item.cantidad, item.precio_unitario, item.descuento, item.importe]
      );
    }

    return NextResponse.json({ success: true, data: { id: cotizacionId, folio, subtotal, iva, total } }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - partial (ids) or total (all)
export async function DELETE(req: NextRequest) {
  const conn = await getConnection();
  try {
    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids)
      ? body.ids.map((id: any) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0)
      : [];
    const mode = String(body?.mode || "");

    if (mode !== "all" && ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "Debes enviar ids para borrado parcial o mode=all para borrado total" },
        { status: 400 }
      );
    }

    await conn.beginTransaction();

    if (mode === "all") {
      await conn.execute("DELETE FROM quote_items");
      const [result]: any = await conn.execute("DELETE FROM quotes");
      await conn.commit();
      return NextResponse.json({ success: true, data: { deleted: Number(result?.affectedRows || 0) } });
    }

    const placeholders = ids.map(() => "?").join(",");
    await conn.execute(`DELETE FROM quote_items WHERE cotizacion_id IN (${placeholders})`, ids);
    const [result]: any = await conn.execute(`DELETE FROM quotes WHERE id IN (${placeholders})`, ids);

    await conn.commit();
    return NextResponse.json({ success: true, data: { deleted: Number(result?.affectedRows || 0) } });
  } catch (error: any) {
    await conn.rollback();
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    conn.release();
  }
}
