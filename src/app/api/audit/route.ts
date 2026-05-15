import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

function getCallerRole(request: NextRequest): string | null {
  const cookie = request.cookies.get("user_info")?.value;
  if (!cookie) return null;
  try {
    return JSON.parse(decodeURIComponent(cookie)).role;
  } catch {
    return null;
  }
}

// GET audit log (admin and gerente only)
export async function GET(request: NextRequest) {
  const role = getCallerRole(request);
  if (role !== "admin" && role !== "gerente") {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const module_filter = searchParams.get("module");
    const username_filter = searchParams.get("username");
    const fecha_inicio = searchParams.get("fecha_inicio");
    const fecha_fin = searchParams.get("fecha_fin");
    const limit = Math.min(Number(searchParams.get("limit") || 100), 500);

    let sql = `SELECT * FROM audit_log WHERE 1=1`;
    const params: any[] = [];

    if (module_filter) {
      sql += ` AND module = ?`;
      params.push(module_filter);
    }
    if (username_filter) {
      sql += ` AND username LIKE ?`;
      params.push(`%${username_filter}%`);
    }
    if (fecha_inicio) {
      sql += ` AND DATE(created_at) >= ?`;
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      sql += ` AND DATE(created_at) <= ?`;
      params.push(fecha_fin);
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const rows = await query(sql, params);
    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    // Table might not exist
    if (error.message?.includes("doesn't exist")) {
      return NextResponse.json({ success: true, data: [] });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
