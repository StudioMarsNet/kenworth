import { NextResponse, NextRequest } from "next/server";
import { query } from "@/lib/db";
import { z } from "zod";

const CreateRescueSchema = z.object({
  fecha: z.string(),
  folio_interno: z.string().optional().nullable(),
  tipo: z.enum(["RESCATE", "MTTO"]),
  destino: z.string().optional().nullable(),
  item: z.string().optional().nullable(),
  descripcion: z.string().optional().nullable(),
  cantidad_entregada: z.number().default(0),
  cantidad_devuelta: z.number().default(0),
  cantidad_usada: z.number().default(0),
  cantidad_pendiente: z.number().default(0),
  status_bisonte: z.string().optional().nullable(),
  status_kw: z.string().optional().nullable(),
  tecnico: z.string().optional().nullable(),
  unidad: z.string().optional().nullable(),
  bisonte: z.string().optional().nullable(),
  kw: z.string().optional().nullable(),
  vales: z.string().optional().nullable(),
  observaciones: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tipo = searchParams.get("tipo");
    const status_kw = searchParams.get("status_kw");
    const status_bisonte = searchParams.get("status_bisonte");
    const tecnico = searchParams.get("tecnico");
    const destino = searchParams.get("destino");
    const fecha_desde = searchParams.get("fecha_desde");
    const fecha_hasta = searchParams.get("fecha_hasta");
    const q = searchParams.get("q");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(200, parseInt(searchParams.get("limit") || "50"));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];

    if (tipo) { conditions.push("tipo = ?"); params.push(tipo); }
    if (status_kw) { conditions.push("status_kw = ?"); params.push(status_kw); }
    if (status_bisonte) { conditions.push("status_bisonte = ?"); params.push(status_bisonte); }
    if (tecnico) { conditions.push("tecnico LIKE ?"); params.push(`%${tecnico}%`); }
    if (destino) { conditions.push("destino LIKE ?"); params.push(`%${destino}%`); }
    if (fecha_desde) { conditions.push("fecha >= ?"); params.push(fecha_desde); }
    if (fecha_hasta) { conditions.push("fecha <= ?"); params.push(fecha_hasta); }
    if (q) {
      conditions.push("(item LIKE ? OR descripcion LIKE ? OR folio_interno LIKE ? OR tecnico LIKE ? OR unidad LIKE ? OR vales LIKE ?)");
      const like = `%${q}%`;
      params.push(like, like, like, like, like, like);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const countRows: any[] = await query(`SELECT COUNT(*) AS total FROM rescates ${where}`, params);
    const total = Number(countRows[0]?.total || 0);
    const rows = await query(
      `SELECT * FROM rescates ${where} ORDER BY fecha DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return NextResponse.json({ success: true, data: rows, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateRescueSchema.parse(body);
    const result: any = await query(
      `INSERT INTO rescates
        (fecha, folio_interno, tipo, destino, item, descripcion,
         cantidad_entregada, cantidad_devuelta, cantidad_usada, cantidad_pendiente,
         status_bisonte, status_kw, tecnico, unidad, bisonte, kw, vales, observaciones)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [parsed.fecha, parsed.folio_interno || null, parsed.tipo,
       parsed.destino || null, parsed.item || null, parsed.descripcion || null,
       parsed.cantidad_entregada, parsed.cantidad_devuelta, parsed.cantidad_usada, parsed.cantidad_pendiente,
       parsed.status_bisonte || null, parsed.status_kw || null,
       parsed.tecnico || null, parsed.unidad || null,
       parsed.bisonte || null, parsed.kw || null,
       parsed.vales || null, parsed.observaciones || null]
    );
    const [newRow] = await query("SELECT * FROM rescates WHERE id = ?", [result.insertId]) as any[];
    return NextResponse.json({ success: true, data: newRow }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
