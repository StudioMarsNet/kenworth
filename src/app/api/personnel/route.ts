import { NextResponse, NextRequest } from "next/server";
import { query } from "@/lib/db";
import { z } from "zod";

const CreateSchema = z.object({
  nombre: z.string().min(1),
  rol: z.enum(["vendedor", "almacenista", "gerente_almacen", "gerente_ventas"]),
});

// GET - list personnel, optional ?rol=vendedor
// Also includes system users (vendedor/almacenista/gerente) from the users table
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rol = searchParams.get("rol");
    let rows: any[] = [];

    // 1) Read from personnel table when available
    try {
      const personnelRows: any[] = await query(
        "SELECT CAST(id AS CHAR) AS id, nombre, rol, 'personnel' AS source FROM personnel WHERE activo = 1"
      );
      rows = rows.concat(personnelRows);
    } catch {
      // Keep working even if personnel table is missing/not migrated.
    }

    // 2) Always include users with operational roles
    const userRows: any[] = await query(
      `SELECT CONCAT('u', CAST(id AS CHAR)) AS id, display_name AS nombre,
         CASE role
           WHEN 'vendedor'    THEN 'vendedor'
           WHEN 'almacenista' THEN 'almacenista'
           WHEN 'gerente'     THEN 'gerente_almacen'
           ELSE role
         END AS rol,
         'user' AS source
       FROM users
       WHERE role IN ('vendedor', 'almacenista', 'gerente')`
    );
    rows = rows.concat(userRows);

    if (rol) {
      rows = rows.filter((r) => r.rol === rol);
    }

    rows.sort((a, b) => {
      const rolCmp = String(a.rol || "").localeCompare(String(b.rol || ""), "es");
      if (rolCmp !== 0) return rolCmp;
      return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es");
    });

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - create personnel
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateSchema.parse(body);
    const result: any = await query(
      "INSERT INTO personnel (nombre, rol) VALUES (?, ?)",
      [parsed.nombre, parsed.rol]
    );
    return NextResponse.json({ success: true, data: { id: result.insertId } }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
