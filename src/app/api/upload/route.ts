import { NextRequest, NextResponse } from "next/server";
import { getConnection, query } from "@/lib/db";
import * as XLSX from "xlsx";

// Expected columns (case-insensitive matching)
const COLUMN_MAP: Record<string, string> = {
  // numero_articulo
  númerodeartículo: "numero_articulo",
  numerodearticulo: "numero_articulo",
  numeroarticulo: "numero_articulo",
  numero_articulo: "numero_articulo",
  productid: "numero_articulo",
  product_id: "numero_articulo",
  id: "numero_articulo",
  númparte: "numero_articulo",
  numpart: "numero_articulo",
  numparte: "numero_articulo",
  // descripcion
  descripción: "descripcion",
  descripcion: "descripcion",
  name: "descripcion",
  producto: "descripcion",
  // ubicacion
  ubicación: "ubicacion",
  ubicacion: "ubicacion",
  // stand
  stand: "stand",
  // tipo_articulo
  tipoartículo: "tipo_articulo",
  tipoarticulo: "tipo_articulo",
  tipo_articulo: "tipo_articulo",
  // sucursal
  sucursal: "sucursal",
  // existencia
  existencia: "existencia",
  quantity: "existencia",
  cantidad: "existencia",
  qty: "existencia",
  existactual: "existencia",
  // precio_traxion (Costo in CSV)
  precio_traxion: "precio_traxion",
  preciotraxion: "precio_traxion",
  preciolista: "precio_traxion",
  costo: "precio_traxion",
  unitvalue: "precio_traxion",
  unit_value: "precio_traxion",
  value: "precio_traxion",
  valor: "precio_traxion",
  precio: "precio_traxion",
  // warehouse
  warehouse: "warehouse",
  almacen: "warehouse",
  almacén: "warehouse",
  // movement
  movement: "movement",
  movimiento: "movement",
};

function normalizeColumnName(raw: string): string | null {
  const key = raw.toLowerCase().replace(/[^a-záéíóúñü_]/gi, "");
  return COLUMN_MAP[key] || null;
}

export async function POST(request: NextRequest) {
  const conn = await getConnection();

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!allowedTypes.includes(file.type) && !["xlsx", "xls", "csv"].includes(ext || "")) {
      return NextResponse.json(
        { success: false, error: "File must be .xlsx, .xls, or .csv" },
        { status: 400 }
      );
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(
      workbook.Sheets[sheetName]
    );

    if (rawRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "File is empty or has no data rows" },
        { status: 400 }
      );
    }

    // Map columns
    const headers = Object.keys(rawRows[0]);
    const colMapping: Record<string, string> = {};
    for (const h of headers) {
      const mapped = normalizeColumnName(h);
      if (mapped) colMapping[h] = mapped;
    }

    if (!Object.values(colMapping).includes("numero_articulo")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Columna requerida no encontrada: Número del Artículo (o numero_articulo, product_id). Columnas encontradas: " +
            headers.join(", "),
        },
        { status: 400 }
      );
    }

    // Insert upload_history record
    const [uploadResult]: any = await conn.execute(
      `INSERT INTO upload_history (filename, rows_processed, status) VALUES (?, ?, 'processing')`,
      [file.name, rawRows.length]
    );
    const uploadId = uploadResult.insertId;

    // Cache warehouses
    const [warehouses]: any = await conn.execute("SELECT id, name FROM warehouses");
    const whCache: Record<string, number> = {};
    for (const wh of warehouses) {
      whCache[wh.name.toLowerCase()] = wh.id;
    }

    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    await conn.beginTransaction();

    for (let i = 0; i < rawRows.length; i++) {
      const raw = rawRows[i];
      const rowNum = i + 2; // 1-based + header

      try {
        // Build normalized row
        const row: Record<string, any> = {};
        for (const [origCol, value] of Object.entries(raw)) {
          const mapped = colMapping[origCol];
          if (mapped) row[mapped] = value;
        }

        const numeroArticulo = String(row.numero_articulo || "").trim();
        if (!numeroArticulo) {
          errors.push(`Fila ${rowNum}: falta numero_articulo`);
          failed++;
          continue;
        }

        const descripcion = String(row.descripcion || "").trim() || numeroArticulo;
        const ubicacion = String(row.ubicacion || "").trim();
        const stand = String(row.stand || "").trim();
        const tipoArticulo = String(row.tipo_articulo || "").trim() || "Normal";
        const sucursal = String(row.sucursal || "").trim();
        const existencia = parseInt(row.existencia) || 0;
        const precioTraxion = parseFloat(row.precio_traxion) || 0;
        const movement = ["high", "medium", "low"].includes(
          String(row.movement || "").toLowerCase()
        )
          ? String(row.movement).toLowerCase()
          : "medium";

        // Resolve warehouse
        let warehouseId: number | null = null;
        if (row.warehouse) {
          const whName = String(row.warehouse).trim();
          const whKey = whName.toLowerCase();
          if (whCache[whKey]) {
            warehouseId = whCache[whKey];
          } else {
            // Create new warehouse
            const [newWh]: any = await conn.execute(
              "INSERT INTO warehouses (name) VALUES (?)",
              [whName]
            );
            warehouseId = newWh.insertId;
            whCache[whKey] = warehouseId!;
          }
        }

        if (!warehouseId) {
          errors.push(`Row ${rowNum}: missing warehouse`);
          failed++;
          continue;
        }

        // Check if item exists by numero_articulo + warehouse
        const [existing]: any = await conn.execute(
          "SELECT id FROM inventory_items WHERE numero_articulo = ? AND warehouse_id = ?",
          [numeroArticulo, warehouseId]
        );

        if (existing.length > 0) {
          await conn.execute(
            `UPDATE inventory_items SET descripcion = ?, ubicacion = ?, stand = ?, tipo_articulo = ?, sucursal = ?, existencia = ?, precio_traxion = ?, movement = ? WHERE id = ?`,
            [descripcion, ubicacion, stand, tipoArticulo, sucursal, existencia, precioTraxion, movement, existing[0].id]
          );
          updated++;
        } else {
          await conn.execute(
            `INSERT INTO inventory_items (numero_articulo, descripcion, ubicacion, stand, tipo_articulo, existencia, precio_traxion, warehouse_id, sucursal, movement)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [numeroArticulo, descripcion, ubicacion, stand, tipoArticulo, existencia, precioTraxion, warehouseId, sucursal, movement]
          );
          created++;
        }
      } catch (rowErr: any) {
        errors.push(`Row ${rowNum}: ${rowErr.message}`);
        failed++;
      }
    }

    // Update upload history
    await conn.execute(
      `UPDATE upload_history SET rows_succeeded = ?, rows_failed = ?, status = 'completed' WHERE id = ?`,
      [created + updated, failed, uploadId]
    );

    await conn.commit();
    conn.release();

    return NextResponse.json({
      success: true,
      data: {
        processed: rawRows.length,
        created,
        updated,
        failed,
        errors: errors.slice(0, 20), // Limit error details
      },
    });
  } catch (error: any) {
    try {
      await conn.rollback();
    } catch (_) {}
    conn.release();

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
