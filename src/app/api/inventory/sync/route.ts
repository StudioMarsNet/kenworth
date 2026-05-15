import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import * as XLSX from "xlsx";

// Mapeo de nombre de almacén en Kenworth → warehouse name en DB
const WAREHOUSE_MAP: Record<string, string> = {
  "BISONTE SAN LUIS POTOSÍ": "Bisonte SLP",
  "BISONTE SAN LUIS POTOSI": "Bisonte SLP",
  "EXCLUSA SAN LUIS POTOSÍ": "Exclusa SLP",
  "EXCLUSA SAN LUIS POTOSI": "Exclusa SLP",
  "BISONTE SLP": "Bisonte SLP",
  "EXCLUSA SLP": "Exclusa SLP",
};

export async function POST(request: NextRequest) {
  const conn = await getConnection();
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No se proporcionó archivo" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (rawRows.length === 0) {
      return NextResponse.json({ success: false, error: "El archivo está vacío" }, { status: 400 });
    }

    // Cache warehouses
    const [warehouses]: any = await conn.execute("SELECT id, name FROM warehouses");
    const whCache: Record<string, number> = {};
    for (const wh of warehouses) {
      whCache[wh.name.toLowerCase()] = wh.id;
    }
    const kenworthId = whCache["kenworth"] || null;

    await conn.beginTransaction();

    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const raw = rawRows[i];
      const rowNum = i + 2;

      try {
        const numParte = String(raw["Núm. Parte"] || raw["Num. Parte"] || raw["NumParte"] || "").trim();
        if (!numParte) {
          errors.push(`Fila ${rowNum}: falta Núm. Parte`);
          failed++;
          continue;
        }

        const descripcion = String(raw["Descripción"] || raw["Descripcion"] || "").trim() || numParte;
        const ubicacion = String(raw["Ubicacion"] || raw["Ubicación"] || "").trim();
        const stand = String(raw["Stand"] || "").trim();
        const tipoArticulo = String(raw["Tipo Artículo"] || raw["Tipo Articulo"] || "").trim() || "Normal";
        const sucursal = String(raw["Sucursal"] || "").trim();
        const existencia = parseInt(raw["Exist. Actual"] || raw["ExistActual"] || "0") || 0;

        // Precio y moneda
        let precioLista = parseFloat(raw["PrecioLista"] || raw["Precio Lista"] || "0") || 0;
        const moneda = String(raw["Moneda"] || "Pesos").trim();
        const tipoCambio = parseFloat(raw["Tipo de Cambio Cat"] || raw["TipoCambioCat"] || "1") || 1;

        // Si moneda es Dólares, convertir a pesos
        let precioEnPesos = precioLista;
        if (moneda.toLowerCase().includes("dólar") || moneda.toLowerCase().includes("dolar") || moneda.toLowerCase() === "dólares" || moneda.toLowerCase() === "dolares") {
          precioEnPesos = Math.round(precioLista * tipoCambio * 100) / 100;
        }

        // Resolver almacén
        const almacenRaw = String(raw["Almacén"] || raw["Almacen"] || "").trim();
        const mappedName = WAREHOUSE_MAP[almacenRaw.toUpperCase()] || WAREHOUSE_MAP[almacenRaw] || almacenRaw;
        let warehouseId = whCache[mappedName.toLowerCase()];

        // Si se dejó solo KENWORTH como almacén padre, enrutar todo ahí.
        if (!warehouseId && kenworthId) {
          warehouseId = kenworthId;
        }

        if (!warehouseId) {
          errors.push(`Fila ${rowNum}: almacén "${almacenRaw}" no reconocido y no existe KENWORTH`);
          failed++;
          continue;
        }

        // UPSERT por (numero_articulo, warehouse_id)
        const [existing]: any = await conn.execute(
          "SELECT id FROM inventory_items WHERE numero_articulo = ? AND warehouse_id = ?",
          [numParte, warehouseId]
        );

        if (existing.length > 0) {
          await conn.execute(
            `UPDATE inventory_items SET descripcion = ?, ubicacion = ?, stand = ?, tipo_articulo = ?, sucursal = ?,
             existencia = ?, precio_traxion = ?, moneda = ?, tipo_cambio = ? WHERE id = ?`,
            [descripcion, ubicacion, stand, tipoArticulo, sucursal, existencia, precioEnPesos, moneda, tipoCambio, existing[0].id]
          );
          updated++;
        } else {
          await conn.execute(
            `INSERT INTO inventory_items (numero_articulo, descripcion, ubicacion, stand, tipo_articulo, existencia, precio_traxion, warehouse_id, sucursal, moneda, tipo_cambio)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [numParte, descripcion, ubicacion, stand, tipoArticulo, existencia, precioEnPesos, warehouseId, sucursal, moneda, tipoCambio]
          );
          created++;
        }
      } catch (err: any) {
        errors.push(`Fila ${rowNum}: ${err.message}`);
        failed++;
      }
    }

    await conn.commit();
    conn.release();

    return NextResponse.json({
      success: true,
      data: {
        total: rawRows.length,
        created,
        updated,
        failed,
        errors: errors.slice(0, 20),
      },
    });
  } catch (error: any) {
    await conn.rollback();
    conn.release();
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
