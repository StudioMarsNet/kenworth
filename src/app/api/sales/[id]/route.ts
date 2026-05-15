import { NextResponse, NextRequest } from "next/server";
import { query } from "@/lib/db";
import { z } from "zod";

// GET - single cotización with items
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rows: any[] = await query(
      `SELECT s.*, c.nombre AS cliente_ref
       FROM quotes s
       LEFT JOIN clients c ON s.cliente_id = c.id
       WHERE s.id = ?`,
      [id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: "No encontrada" }, { status: 404 });
    }
    const items = await query(
      "SELECT * FROM quote_items WHERE cotizacion_id = ? ORDER BY id",
      [id]
    );
    return NextResponse.json({ success: true, data: { ...rows[0], items } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

const ItemSchema = z.object({
  numero_articulo: z.string().min(1),
  descripcion: z.string().min(1),
  cantidad: z.number().int().min(1),
  precio_unitario: z.number().min(0),
  descuento: z.number().min(0).max(100).default(0),
});

const UpdateSchema = z.object({
  estatus: z.enum(["borrador", "enviada", "aceptada", "rechazada", "cancelada"]).optional(),
  notas: z.string().optional(),
  vigencia: z.string().optional(),
  vendedor: z.string().optional(),
  folio_sitic: z.string().regex(/^\d{7}$/, "Folio SITIC debe tener exactamente 7 dígitos").optional(),
  no_docto: z.string().regex(/^\d{4}$/, "No. Docto debe tener exactamente 4 dígitos").optional(),
  fecha_consumo: z.string().optional(),
  cliente_nombre: z.string().min(1).optional(),
  cliente_id: z.number().nullable().optional(),
  moneda: z.enum(["MXN", "USD"]).optional(),
  tipo_cambio: z.number().min(0).optional(),
  items: z.array(ItemSchema).min(1).optional(),
});

// PUT - update cotización (status/notes/full edit)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateSchema.parse(body);

    // Check quote exists and is editable for full edits
    if (parsed.items) {
      const existing: any[] = await query("SELECT estatus FROM quotes WHERE id = ?", [id]);
      if (existing.length === 0) {
        return NextResponse.json({ success: false, error: "Cotización no encontrada" }, { status: 404 });
      }
      if (existing[0].estatus !== "borrador") {
        return NextResponse.json({ success: false, error: "Solo se pueden editar cotizaciones en borrador" }, { status: 400 });
      }
    }

    const fields: string[] = [];
    const values: any[] = [];
    if (parsed.estatus) { fields.push("estatus = ?"); values.push(parsed.estatus); }
    if (parsed.notas !== undefined) { fields.push("notas = ?"); values.push(parsed.notas); }
    if (parsed.vigencia !== undefined) { fields.push("vigencia = ?"); values.push(parsed.vigencia); }
    if (parsed.vendedor !== undefined) { fields.push("vendedor = ?"); values.push(parsed.vendedor); }
    if (parsed.folio_sitic !== undefined) { fields.push("folio_sitic = ?"); values.push(parsed.folio_sitic); }
    if (parsed.no_docto !== undefined) { fields.push("no_docto = ?"); values.push(parsed.no_docto); }
    if (parsed.fecha_consumo !== undefined) { fields.push("fecha_consumo = ?"); values.push(parsed.fecha_consumo); }
    if (parsed.cliente_nombre !== undefined) { fields.push("cliente_nombre = ?"); values.push(parsed.cliente_nombre); }
    if (parsed.cliente_id !== undefined) { fields.push("cliente_id = ?"); values.push(parsed.cliente_id); }
    if (parsed.moneda !== undefined) { fields.push("moneda = ?"); values.push(parsed.moneda); }
    if (parsed.tipo_cambio !== undefined) { fields.push("tipo_cambio = ?"); values.push(parsed.tipo_cambio); }

    // Recalculate totals if items provided
    if (parsed.items) {
      let subtotal = 0;
      const itemsCalc = parsed.items.map((item) => {
        const importe = item.cantidad * item.precio_unitario * (1 - (item.descuento || 0) / 100);
        subtotal += importe;
        return { ...item, importe: Math.round(importe * 100) / 100 };
      });
      const iva = Math.round(subtotal * 0.16 * 100) / 100;
      const total = Math.round((subtotal + iva) * 100) / 100;

      fields.push("subtotal = ?"); values.push(subtotal);
      fields.push("iva = ?"); values.push(iva);
      fields.push("total = ?"); values.push(total);

      if (fields.length > 0) {
        values.push(id);
        await query(`UPDATE quotes SET ${fields.join(", ")} WHERE id = ?`, values);
      }

      // Replace items: delete old, insert new
      await query("DELETE FROM quote_items WHERE cotizacion_id = ?", [id]);
      for (const item of itemsCalc) {
        await query(
          `INSERT INTO quote_items (cotizacion_id, numero_articulo, descripcion, cantidad, precio_unitario, descuento, importe)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, item.numero_articulo, item.descripcion, item.cantidad, item.precio_unitario, item.descuento, item.importe]
        );
      }
    } else {
      if (fields.length === 0) {
        return NextResponse.json({ success: false, error: "Sin campos para actualizar" }, { status: 400 });
      }
      values.push(id);
      await query(`UPDATE quotes SET ${fields.join(", ")} WHERE id = ?`, values);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await query("DELETE FROM quotes WHERE id = ?", [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
