import { NextRequest, NextResponse } from "next/server";
import { query, getConnection } from "@/lib/db";
import { z } from "zod";

const validStatuses = [
  "Pending",
  "Approved",
  "In Transit",
  "Completed",
  "Closed",
  "Rejected",
] as const;

const UpdateRequisitionSchema = z.object({
  status: z.enum(validStatuses).optional(),
  folio_sitic: z.string().max(50).optional(),
  received_quantity: z.coerce.number().int().min(0).optional(),
  discrepancy_notes: z.string().max(1000).optional(),
  received_by: z.string().max(100).optional(),
});

// Valid status transitions
const allowedTransitions: Record<string, string[]> = {
  Pending: ["Approved", "Rejected"],
  Approved: ["In Transit", "Rejected"],
  "In Transit": ["Completed", "Rejected"],
  Completed: ["Closed"],
  Closed: [],
  Rejected: [],
};

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateRequisitionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { status: newStatus, received_quantity, discrepancy_notes, received_by, folio_sitic } = parsed.data;

    // Allow folio_sitic-only update (without status change)
    if (folio_sitic !== undefined && newStatus === undefined) {
      await query(`UPDATE requisitions SET folio_sitic = ? WHERE id = ?`, [folio_sitic, id]);
      return NextResponse.json({ success: true, data: { folio_sitic } });
    }

    if (newStatus === undefined) {
      return NextResponse.json({ success: false, error: "Se requiere status o folio_sitic" }, { status: 400 });
    }

    // Fetch current requisition
    const reqs: any[] = await query(
      `SELECT r.*, i.numero_articulo, i.descripcion AS item_name
       FROM requisitions r
       LEFT JOIN inventory_items i ON r.item_id = i.id
       WHERE r.id = ?`,
      [id]
    );

    if (reqs.length === 0) {
      return NextResponse.json(
        { success: false, error: "Requisition not found" },
        { status: 404 }
      );
    }

    const req = reqs[0];

    // For transfers: validate stock in origin before Approved
    if (req.type === "Transfer" && newStatus === "Approved" && req.item_id && Number(req.quantity) > 0) {
      const stockRows: any[] = await query(
        "SELECT existencia FROM inventory_items WHERE id = ? AND warehouse_id = ?",
        [req.item_id, req.from_warehouse_id]
      );
      const stock = Number(stockRows[0]?.existencia || 0);
      if (stock < req.quantity) {
        return NextResponse.json(
          { success: false, error: `Stock insuficiente en origen. Disponible: ${stock}, requerido: ${req.quantity}` },
          { status: 400 }
        );
      }
    }

    // For requisitions, validate available stock before approval
    if (req.type === "Requisition" && newStatus === "Approved") {
      const stockRows: any[] = await query("SELECT existencia FROM inventory_items WHERE id = ?", [req.item_id]);
      const stock = Number(stockRows[0]?.existencia || 0);
      if (stock < req.quantity) {
        return NextResponse.json(
          { success: false, error: `Stock insuficiente para aprobar. Disponible: ${stock}, requerido: ${req.quantity}` },
          { status: 400 }
        );
      }
    }

    // Check valid transition
    if (!allowedTransitions[req.status]?.includes(newStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot transition from '${req.status}' to '${newStatus}'`,
        },
        { status: 400 }
      );
    }

    // If Transfer is being Completed, execute the stock movement in a transaction
    if (req.type === "Transfer" && newStatus === "Completed") {
      // Tracking-only transfer (without item/quantity): no stock movement required.
      if (!req.item_id || Number(req.quantity) <= 0) {
        await query(`UPDATE requisitions SET status = ? WHERE id = ?`, [newStatus, id]);
        try {
          await query(
            `INSERT INTO requisition_approvals_log (requisition_id, previous_status, new_status, changed_by, notes)
             VALUES (?, ?, ?, ?, ?)`,
            [req.id, req.status, newStatus, received_by || "system", "Cambio de estatus (traspaso de seguimiento)"]
          );
        } catch {}
        return NextResponse.json({ success: true, data: { message: "Transfer completed (tracking mode)" } });
      }

      const actualReceivedQty = received_quantity ?? req.quantity;
      const hasDiscrepancy = actualReceivedQty !== req.quantity;
      const conn = await getConnection();
      try {
        await conn.beginTransaction();

        // Verify stock in source warehouse
        const [sourceItems]: any = await conn.execute(
          `SELECT id, existencia FROM inventory_items WHERE id = ? AND warehouse_id = ?`,
          [req.item_id, req.from_warehouse_id]
        );

        if (sourceItems.length === 0 || sourceItems[0].existencia < req.quantity) {
          await conn.rollback();
          return NextResponse.json(
            {
              success: false,
              error: "Stock insuficiente en almacén de origen",
            },
            { status: 400 }
          );
        }

        // Deduct from source (full quantity sent)
        await conn.execute(
          `UPDATE inventory_items SET existencia = existencia - ? WHERE id = ? AND warehouse_id = ?`,
          [req.quantity, req.item_id, req.from_warehouse_id]
        );

        // Check if item exists in destination warehouse - add RECEIVED quantity
        const [destItems]: any = await conn.execute(
          `SELECT id FROM inventory_items WHERE numero_articulo = ? AND warehouse_id = ?`,
          [req.numero_articulo, req.to_warehouse_id]
        );

        if (destItems.length > 0) {
          await conn.execute(
            `UPDATE inventory_items SET existencia = existencia + ? WHERE id = ?`,
            [actualReceivedQty, destItems[0].id]
          );
        } else {
          const [srcDetail]: any = await conn.execute(
            `SELECT numero_articulo, descripcion, ubicacion, stand, precio_traxion, movement FROM inventory_items WHERE id = ?`,
            [req.item_id]
          );
          if (srcDetail.length > 0) {
            const s = srcDetail[0];
            await conn.execute(
              `INSERT INTO inventory_items (numero_articulo, descripcion, ubicacion, stand, existencia, precio_traxion, warehouse_id, movement)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                s.numero_articulo,
                s.descripcion,
                s.ubicacion,
                s.stand,
                actualReceivedQty,
                s.precio_traxion,
                req.to_warehouse_id,
                s.movement,
              ]
            );
          }
        }

        // Log the transfer with receipt details
        try {
          await conn.execute(
            `INSERT INTO transfer_log (requisition_id, from_warehouse_id, to_warehouse_id, item_id, quantity, received_quantity, discrepancy_notes, received_at, received_by, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
            [
              req.id,
              req.from_warehouse_id,
              req.to_warehouse_id,
              req.item_id,
              req.quantity,
              actualReceivedQty,
              discrepancy_notes || null,
              received_by || "system",
              hasDiscrepancy ? "Discrepancy" : "Received",
            ]
          );
        } catch {
          // Fallback if new columns don't exist yet
          await conn.execute(
            `INSERT INTO transfer_log (requisition_id, from_warehouse_id, to_warehouse_id, item_id, quantity)
             VALUES (?, ?, ?, ?, ?)`,
            [req.id, req.from_warehouse_id, req.to_warehouse_id, req.item_id, req.quantity]
          );
        }

        // Update status
        await conn.execute(
          `UPDATE requisitions SET status = ? WHERE id = ?`,
          [newStatus, id]
        );

        try {
          await conn.execute(
            `INSERT INTO requisition_approvals_log (requisition_id, previous_status, new_status, changed_by, notes)
             VALUES (?, ?, ?, ?, ?)`,
            [req.id, req.status, newStatus, "system", "Cambio de estatus (transferencia completada)"]
          );
        } catch {}

        await conn.commit();
        conn.release();

        return NextResponse.json({
          success: true,
          data: { message: "Transfer completed and stock updated" },
        });
      } catch (err) {
        await conn.rollback();
        conn.release();
        throw err;
      }
    }

    // If regular requisition is being Completed, discount stock from source item
    if (req.type === "Requisition" && newStatus === "Completed") {
      const conn = await getConnection();
      try {
        await conn.beginTransaction();

        const [stockRows]: any = await conn.execute("SELECT existencia FROM inventory_items WHERE id = ?", [req.item_id]);
        const stock = Number(stockRows?.[0]?.existencia || 0);
        if (stock < req.quantity) {
          await conn.rollback();
          conn.release();
          return NextResponse.json(
            { success: false, error: `Stock insuficiente para completar. Disponible: ${stock}, requerido: ${req.quantity}` },
            { status: 400 }
          );
        }

        await conn.execute("UPDATE inventory_items SET existencia = existencia - ? WHERE id = ?", [req.quantity, req.item_id]);
        await conn.execute("UPDATE requisitions SET status = ? WHERE id = ?", [newStatus, id]);
        try {
          await conn.execute(
            `INSERT INTO requisition_approvals_log (requisition_id, previous_status, new_status, changed_by, notes)
             VALUES (?, ?, ?, ?, ?)` ,
            [req.id, req.status, newStatus, "system", "Cambio de estatus (requisición completada)"]
          );
        } catch {}

        await conn.commit();
        conn.release();
        return NextResponse.json({ success: true });
      } catch (err: any) {
        await conn.rollback();
        conn.release();
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
      }
    }

    // Simple status update (non-transfer-completion)
    if (folio_sitic !== undefined) {
      await query(`UPDATE requisitions SET status = ?, folio_sitic = ? WHERE id = ?`, [newStatus, folio_sitic, id]);
    } else {
      await query(`UPDATE requisitions SET status = ? WHERE id = ?`, [newStatus, id]);
    }

    try {
      await query(
        `INSERT INTO requisition_approvals_log (requisition_id, previous_status, new_status, changed_by, notes)
         VALUES (?, ?, ?, ?, ?)`,
        [req.id, req.status, newStatus, "system", "Cambio de estatus"]
      );
    } catch {}

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

    const reqs: any[] = await query(
      "SELECT id, status FROM requisitions WHERE id = ?",
      [id]
    );

    if (reqs.length === 0) {
      return NextResponse.json(
        { success: false, error: "Requisition not found" },
        { status: 404 }
      );
    }

    if (reqs[0].status !== "Pending") {
      return NextResponse.json(
        {
          success: false,
          error: "Only pending requisitions can be deleted",
        },
        { status: 400 }
      );
    }

    await query("DELETE FROM requisitions WHERE id = ?", [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
