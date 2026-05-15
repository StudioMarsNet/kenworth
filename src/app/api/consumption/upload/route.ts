import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import * as XLSX from "xlsx";

const COLUMN_MAP: Record<string, string> = {
  fecha: "fecha",
  date: "fecha",
  val: "val_almacen",
  vale: "val_almacen",
  artículo: "numero_articulo",
  articulo: "numero_articulo",
  "número de parte": "numero_articulo",
  descripción: "descripcion",
  descripcion: "descripcion",
  cantidad: "cantidad",
  precio: "precio_unitario",
  total: "_skip",
  "total mn": "_skip",
};

/** Parse fecha from Excel cell — supports YYYY-MM-DD, DD/MM/YYYY, and Excel serial numbers */
function parseFecha(raw: any): string | null {
  if (raw == null || raw === "") return null;
  // Excel serial number (number)
  if (typeof raw === "number") {
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) {
      const yyyy = String(d.y).padStart(4, "0");
      const mm = String(d.m).padStart(2, "0");
      const dd = String(d.d).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
    return null;
  }
  const s = String(raw).trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

function normalizeCol(raw: string): string | null {
  const key = raw.toLowerCase().trim();
  return COLUMN_MAP[key] || null;
}

export async function POST(request: NextRequest) {
  const conn = await getConnection();
  let transactionStarted = false;
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const fecha = formData.get("fecha") as string | null;
    const uploadedBy = (formData.get("uploaded_by") as string || "").trim();
    const subWarehouseIdForm = Number(formData.get("sub_warehouse_id") || 0) || null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No se proporcionó archivo" }, { status: 400 });
    }
    // fecha from form is optional when the Excel has a Fecha column
    if (!uploadedBy) {
      return NextResponse.json({ success: false, error: "Debes seleccionar el personal que sube el archivo" }, { status: 400 });
    }

    // Accept uploader from either personnel table or users table.
    const [personnelRows]: any = await conn.execute(
      `SELECT id FROM personnel
       WHERE nombre = ?
         AND activo = 1
         AND rol IN ('vendedor', 'almacenista', 'gerente_almacen', 'gerente_ventas')
       LIMIT 1`,
      [uploadedBy]
    );

    const [userRows]: any = await conn.execute(
      `SELECT id FROM users
       WHERE display_name = ?
         AND role IN ('vendedor', 'almacenista', 'gerente')
       LIMIT 1`,
      [uploadedBy]
    );
    const validPersonnel = Array.isArray(personnelRows) && personnelRows.length > 0;
    const validUser = Array.isArray(userRows) && userRows.length > 0;
    if (!validPersonnel && !validUser) {
      return NextResponse.json(
        { success: false, error: "El personal seleccionado no existe o no tiene rol permitido" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (rawRows.length === 0) {
      return NextResponse.json({ success: false, error: "El archivo está vacío" }, { status: 400 });
    }

    // Map columns
    const headers = Object.keys(rawRows[0]);
    const colMapping: Record<string, string> = {};
    for (const h of headers) {
      const mapped = normalizeCol(h);
      if (mapped && mapped !== "_skip") colMapping[h] = mapped;
    }

    // Load VAL -> sub warehouse map (new)
    const subValCache: Record<string, number> = {};
    try {
      const [subValMap]: any = await conn.execute("SELECT val_code, sub_warehouse_id FROM sub_warehouse_val_map");
      for (const v of subValMap) {
        subValCache[String(v.val_code)] = Number(v.sub_warehouse_id);
      }
    } catch {
      // table may not exist yet
    }

    // Legacy fallback VAL -> warehouse map
    const whValCache: Record<string, number> = {};
    try {
      const [valMap]: any = await conn.execute("SELECT val_code, warehouse_id FROM warehouse_val_map");
      for (const v of valMap) {
        whValCache[String(v.val_code)] = Number(v.warehouse_id);
      }
    } catch {
      // table may not exist yet
    }

    const subParentCache: Record<number, number | null> = {};
    const resolveParentWarehouse = async (subId: number | null): Promise<number | null> => {
      if (!subId) return null;
      if (subParentCache[subId] !== undefined) return subParentCache[subId];
      const [rows]: any = await conn.execute(
        "SELECT parent_warehouse_id FROM sub_warehouses WHERE id = ? AND activo = 1 LIMIT 1",
        [subId]
      );
      const parentId = Array.isArray(rows) && rows.length > 0 ? (rows[0].parent_warehouse_id ? Number(rows[0].parent_warehouse_id) : null) : null;
      subParentCache[subId] = parentId;
      return parentId;
    };

    await conn.beginTransaction();
    transactionStarted = true;

    let processed = 0;
    let totalMonto = 0;
    const errors: string[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const raw = rawRows[i];
      const rowNum = i + 2;

      try {
        const row: Record<string, any> = {};
        for (const [origCol, value] of Object.entries(raw)) {
          const mapped = colMapping[origCol];
          if (mapped) row[mapped] = value;
        }

        const rowFecha = parseFecha(row.fecha) || fecha;
        if (!rowFecha) {
          errors.push(`Fila ${rowNum}: sin fecha (ni en columna ni en formulario)`);
          continue;
        }

        const valAlmacen = String(row.val_almacen || "").trim();
        const numeroArticulo = String(row.numero_articulo || "").trim();
        const descripcion = String(row.descripcion || "").trim();
        const cantidad = parseInt(row.cantidad) || 0;
        const precioUnitario = parseFloat(row.precio_unitario) || 0;

        if (!numeroArticulo || cantidad <= 0) {
          errors.push(`Fila ${rowNum}: datos incompletos`);
          continue;
        }

        const subWarehouseId = subWarehouseIdForm || subValCache[valAlmacen] || null;
        let warehouseId = await resolveParentWarehouse(subWarehouseId);
        if (!warehouseId) {
          warehouseId = whValCache[valAlmacen] || null;
        }

        await conn.execute(
          `INSERT INTO daily_consumption (fecha, val_almacen, numero_articulo, descripcion, cantidad, precio_unitario, warehouse_id, sub_warehouse_id, uploaded_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [rowFecha, valAlmacen, numeroArticulo, descripcion, cantidad, precioUnitario, warehouseId, subWarehouseId, uploadedBy]
        );

        totalMonto += cantidad * precioUnitario;
        processed++;
      } catch (err: any) {
        errors.push(`Fila ${rowNum}: ${err.message}`);
      }
    }

    await conn.commit();

    return NextResponse.json({
      success: true,
      data: {
        processed,
        total_monto: Math.round(totalMonto * 100) / 100,
        errors: errors.length,
        error_details: errors.slice(0, 10),
      },
    });
  } catch (error: any) {
    if (transactionStarted) {
      await conn.rollback();
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    conn.release();
  }
}
