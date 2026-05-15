import { config } from "dotenv";
config();

import pool from "./db";
import * as fs from "fs";
import * as path from "path";

async function seed() {
  const connection = await pool.getConnection();

  try {
    console.log("Connected to MySQL successfully.\n");

    // ── 1. Run schema.sql ──────────────────────────────────────
    const schemaPath = path.resolve(__dirname, "../../docs/schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");

    // Split by semicolons, filter empty statements
    const statements = schemaSql
      .split(/;\s*$/m)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(`Executing ${statements.length} SQL statements from schema.sql...`);

    for (const stmt of statements) {
      try {
        await connection.query(stmt);
      } catch (err: any) {
        // Ignore "index already exists" errors (error code 1061)
        if (err.errno === 1061) continue;
        throw err;
      }
    }
    console.log("Schema created successfully.\n");

    // ── 2. Map warehouse names → IDs ───────────────────────────
    const [warehouses] = await connection.query<any[]>("SELECT id, name FROM warehouses");
    const whMap: Record<string, number> = {};
    for (const wh of warehouses) {
      whMap[wh.name] = wh.id;
    }
    console.log("Warehouses:", whMap);

    // ── 3. Seed inventory_items ────────────────────────────────
    const inventoryRows: Array<[string, string, number, number, number, string]> = [
      ["P001", "Filtro de aceite P550962",      whMap["Bisonte SLP"],  50,  1250, "high"],
      ["P002", "Batería 31T-1000",              whMap["Bisonte SLP"],  15,  3750, "medium"],
      ["P003", "Espejo retrovisor K159-543",    whMap["Exclusa SLP"],   5,  1500, "low"],
      ["P004", "Lámpara de faro H6024",         whMap["Exclusa SLP"], 100,   500, "high"],
      ["P005", "Juego de balatas K049194",      whMap["Bisonte SLP"],  20,  4000, "high"],
      ["P006", "Bomba de agua E-7345",          whMap["Exclusa SLP"],   8,  2400, "medium"],
      ["P007", "Manguera de radiador 23-12345", whMap["Bisonte SLP"],  30,   900, "medium"],
      ["P008", "Alternador 8600021",            whMap["Querétaro"],     3,  2100, "low"],
      ["P009", "Compresor de A/C T-54321",      whMap["Exclusa SLP"],   4,  3200, "low"],
      ["P010", "Kit de embrague 108391-25",     whMap["Bisonte SLP"],   7,  4900, "medium"],
    ];

    console.log("\nSeeding inventory_items...");
    for (const row of inventoryRows) {
      await connection.execute(
        `INSERT IGNORE INTO inventory_items (product_id, name, warehouse_id, quantity, unit_value, movement)
         VALUES (?, ?, ?, ?, ?, ?)`,
        row
      );
    }
    console.log(`  ${inventoryRows.length} items processed.`);

    // ── 4. Map product_id → item id ────────────────────────────
    const [items] = await connection.query<any[]>("SELECT id, product_id FROM inventory_items");
    const itemMap: Record<string, number> = {};
    for (const it of items) {
      itemMap[it.product_id] = it.id;
    }

    // ── 5. Seed requisitions ───────────────────────────────────
    type ReqRow = [string, string, number, number, number | null, number | null, string | null, string, string];
    const requisitionRows: ReqRow[] = [
      ["R001", "Requisition", itemMap["P001"], 10, null,                    null,                    "Servicio Rápido", "Completed",  "2024-07-20"],
      ["T001", "Transfer",    itemMap["P003"],  2, whMap["Exclusa SLP"],    whMap["Bisonte SLP"],    null,              "In Transit", "2024-07-22"],
      ["R002", "Requisition", itemMap["P004"], 20, null,                    null,                    "Servicio Rápido", "Approved",   "2024-07-23"],
      ["R003", "Requisition", itemMap["P008"],  1, null,                    null,                    "Taller",          "Pending",    "2024-07-24"],
      ["T002", "Transfer",    itemMap["P009"],  1, whMap["Exclusa SLP"],    whMap["Querétaro"],      null,              "Rejected",   "2024-07-19"],
      ["R004", "Requisition", itemMap["P002"],  5, null,                    null,                    "Servicio Rápido", "Completed",  "2024-07-18"],
    ];

    console.log("\nSeeding requisitions...");
    for (const row of requisitionRows) {
      await connection.execute(
        `INSERT IGNORE INTO requisitions (request_id, type, item_id, quantity, from_warehouse_id, to_warehouse_id, to_destination, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row
      );
    }
    console.log(`  ${requisitionRows.length} requisitions processed.`);

    console.log("\n✅ Seed completed successfully!");
  } catch (err) {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  } finally {
    connection.release();
    await pool.end();
  }
}

seed();
