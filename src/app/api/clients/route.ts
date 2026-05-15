import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { z } from "zod";

const CreateClienteSchema = z.object({
  nombre: z.string().min(1).max(100),
  porcentaje_markup: z.coerce.number().min(0).max(100).default(0),
  contacto: z.string().max(255).optional().default(""),
  notas: z.string().optional().default(""),
});

export async function GET() {
  try {
    const rows = await query("SELECT * FROM clients ORDER BY nombre ASC");
    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateClienteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { nombre, porcentaje_markup, contacto, notas } = parsed.data;

    const existing: any[] = await query("SELECT id FROM clients WHERE nombre = ?", [nombre]);
    if (existing.length > 0) {
      return NextResponse.json({ success: false, error: "Ya existe un cliente con este nombre" }, { status: 400 });
    }

    await query(
      "INSERT INTO clients (nombre, porcentaje_markup, contacto, notas) VALUES (?, ?, ?, ?)",
      [nombre, porcentaje_markup, contacto, notas]
    );

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
