import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET transfer reports - period & warehouse filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fecha_inicio = searchParams.get("fecha_inicio");
    const fecha_fin = searchParams.get("fecha_fin");
    const warehouse_id = searchParams.get("warehouse_id");

    let sql = `
      SELECT tl.*,
             r.request_id, r.type, r.status AS requisition_status,
             i.numero_articulo, i.descripcion AS item_name,
             fw.name AS from_warehouse_name,
             tw.name AS to_warehouse_name
      FROM transfer_log tl
      JOIN requisitions r ON tl.requisition_id = r.id
      JOIN inventory_items i ON tl.item_id = i.id
      LEFT JOIN warehouses fw ON tl.from_warehouse_id = fw.id
      LEFT JOIN warehouses tw ON tl.to_warehouse_id = tw.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (fecha_inicio) {
      sql += ` AND DATE(tl.transferred_at) >= ?`;
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      sql += ` AND DATE(tl.transferred_at) <= ?`;
      params.push(fecha_fin);
    }
    if (warehouse_id) {
      sql += ` AND (tl.from_warehouse_id = ? OR tl.to_warehouse_id = ?)`;
      params.push(Number(warehouse_id), Number(warehouse_id));
    }

    sql += ` ORDER BY tl.transferred_at DESC`;

    const rows: any[] = await query(sql, params);

    // Summary stats
    const total = rows.length;
    const totalQty = rows.reduce((sum, r) => sum + Number(r.quantity), 0);
    let discrepancies = 0;
    try {
      discrepancies = rows.filter((r) => r.status === "Discrepancy").length;
    } catch {}

    return NextResponse.json({
      success: true,
      data: rows,
      summary: { total, totalQty, discrepancies },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
