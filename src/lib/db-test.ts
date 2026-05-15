import { config } from "dotenv";
config();

import pool from "./db";

async function testConnection() {
  try {
    const [rows] = await pool.execute("SELECT 1 AS result");
    console.log("✅ Database connection successful!");
    console.log("   Result:", rows);
    console.log(`   Host: ${process.env.DB_HOST}`);
    console.log(`   Database: ${process.env.DB_DATABASE}`);
  } catch (err) {
    console.error("❌ Database connection failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testConnection();
