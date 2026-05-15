import { NextRequest, NextResponse } from "next/server";
import { query, getConnection } from "@/lib/db";
import { z } from "zod";

const CreateRequisitionSchema = z
  .object({
    type: z.enum(["Requisition", "Transfer"]),
    item_id: z.coerce.number().int().positive().nullable().optional(),
    quantity: z.coerce.number().int().min(0).nullable().optional(),
    transfer_number: z.string().trim().max(20).optional(),
    realization_date: z.string().trim().optional(),
    from_warehouse_id: z.coerce.number().int().positive().nullable().optional(),
    to_warehouse_id: z.coerce.number().int().positive().nullable().optional(),
    from_sub_warehouse_id: z.coerce.number().int().positive().nullable().optional(),
    to_sub_warehouse_id: z.coerce.number().int().positive().nullable().optional(),
    to_destination: z.string().max(255).nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
    observaciones: z.string().max(1000).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "Transfer") {
      if (!data.from_warehouse_id && !data.from_sub_warehouse_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "from_warehouse_id or from_sub_warehouse_id is required for transfers",
          path: ["from_warehouse_id"],
        });
      }
      if (!data.to_warehouse_id && !data.to_sub_warehouse_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "to_warehouse_id or to_sub_warehouse_id is required for transfers",
          path: ["to_warehouse_id"],
        });
      }
      if (data.transfer_number && data.transfer_number.length > 20) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "transfer_number must be <= 20 chars",
          path: ["transfer_number"],
        });
      }
    } else {
      if (!data.item_id || data.item_id <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "item_id is required for requisitions",
          path: ["item_id"],
        });
      }
      if (!data.quantity || data.quantity <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "quantity must be > 0 for requisitions",
          path: ["quantity"],
        });
      }
    }
  });

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");

    let sql = `
      SELECT r.*, 
             i.numero_articulo, i.descripcion AS item_name,
             fw.name AS from_warehouse_name,
             tw.name AS to_warehouse_name
      FROM requisitions r
      LEFT JOIN inventory_items i ON r.item_id = i.id
      LEFT JOIN warehouses fw ON r.from_warehouse_id = fw.id
      LEFT JOIN warehouses tw ON r.to_warehouse_id = tw.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (type && ["Requisition", "Transfer"].includes(type)) {
      sql += ` AND r.type = ?`;
      params.push(type);
    }
    if (status && ["Pending", "Approved", "In Transit", "Completed", "Closed", "Rejected"].includes(status)) {
      sql += ` AND r.status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY r.created_at DESC`;

    const rows: any[] = await query(sql, params);
    const data = rows.map((r) => ({
      ...r,
      is_stalled:
        r.status === "Pending" &&
        (Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24) >= 2,
    }));
    return NextResponse.json({ success: true, data });
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
    const parsed = CreateRequisitionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const {
      type,
      item_id,
      quantity,
      transfer_number,
      realization_date,
      from_warehouse_id,
      to_warehouse_id,
      from_sub_warehouse_id,
      to_sub_warehouse_id,
      to_destination,
      notes,
      observaciones,
    } = parsed.data;

    let resolvedFromWarehouseId = from_warehouse_id || null;
    let resolvedToWarehouseId = to_warehouse_id || null;

    if (type === "Transfer") {
      if (!resolvedFromWarehouseId && from_sub_warehouse_id) {
        const fromSw: any[] = await query(
          "SELECT parent_warehouse_id FROM sub_warehouses WHERE id = ? AND activo = 1",
          [from_sub_warehouse_id]
        );
        if (fromSw.length === 0) {
          return NextResponse.json(
            { success: false, error: "Sub-almacén origen no encontrado" },
            { status: 400 }
          );
        }
        resolvedFromWarehouseId = fromSw[0].parent_warehouse_id || null;
      }

      if (!resolvedToWarehouseId && to_sub_warehouse_id) {
        const toSw: any[] = await query(
          "SELECT parent_warehouse_id FROM sub_warehouses WHERE id = ? AND activo = 1",
          [to_sub_warehouse_id]
        );
        if (toSw.length === 0) {
          return NextResponse.json(
            { success: false, error: "Sub-almacén destino no encontrado" },
            { status: 400 }
          );
        }
        resolvedToWarehouseId = toSw[0].parent_warehouse_id || null;
      }
    }

    const normalizedItemId = item_id ?? null;
    const normalizedQty = Number(quantity ?? 0);

    // Verify item exists and check stock only when transfer/requisition has item+qty.
    if (normalizedItemId && normalizedQty > 0) {
      const items: any[] = await query(
        "SELECT id, existencia FROM inventory_items WHERE id = ?",
        [normalizedItemId]
      );
      if (items.length === 0) {
        return NextResponse.json(
          { success: false, error: "Artículo no encontrado" },
          { status: 400 }
        );
      }
      if (normalizedQty > items[0].existencia) {
        return NextResponse.json(
          {
            success: false,
            error: `La cantidad excede el stock disponible (${items[0].existencia})`,
          },
          { status: 400 }
        );
      }
    }

    // Generate request_id
    const prefix = type === "Transfer" ? "T" : "R";
    const countResult: any[] = await query(
      "SELECT COUNT(*) AS cnt FROM requisitions WHERE type = ?",
      [type]
    );
    const nextNum = (countResult[0].cnt || 0) + 1;
    const generatedRequestId = `${prefix}${String(nextNum).padStart(3, "0")}`;
    const request_id = type === "Transfer" && transfer_number ? transfer_number : generatedRequestId;

    const createdAt = realization_date && /^\d{4}-\d{2}-\d{2}$/.test(realization_date)
      ? `${realization_date} 12:00:00`
      : null;

    await query(
      `INSERT INTO requisitions (request_id, type, item_id, quantity, from_warehouse_id, to_warehouse_id, from_sub_warehouse_id, to_sub_warehouse_id, to_destination, notes, observaciones, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, NOW()))`,
      [
        request_id,
        type,
        normalizedItemId,
        normalizedQty,
        resolvedFromWarehouseId,
        resolvedToWarehouseId,
        from_sub_warehouse_id || null,
        to_sub_warehouse_id || null,
        to_destination || null,
        notes || null,
        observaciones || null,
        createdAt,
      ]
    );

    return NextResponse.json(
      { success: true, data: { request_id } },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
