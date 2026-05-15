import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// SITIC CSV column mapping
const SITIC_COL_MAP: Record<string, string> = {
  // numero_articulo
  "número artículo": "numero_articulo",
  "numero articulo": "numero_articulo",
  "núm artículo": "numero_articulo",
  "num articulo": "numero_articulo",
  "numero_articulo": "numero_articulo",
  "articulo": "numero_articulo",
  // cantidad_surtida
  "cantidad surtida": "cantidad_surtida",
  "cantidadsurtida": "cantidad_surtida",
  "cantidad_surtida": "cantidad_surtida",
  // cantidad_por_facturar
  "cantidad por facturar": "cantidad_por_facturar",
  "cantidadporfacturar": "cantidad_por_facturar",
  "cantidad_por_facturar": "cantidad_por_facturar",
  // id_docto_cargo
  "id docto cargo": "id_docto_cargo",
  "id_docto_cargo": "id_docto_cargo",
  "iddoctocargo": "id_docto_cargo",
  "folio sitic": "id_docto_cargo",
  // folio_factura
  "folio factura": "folio_factura",
  "folio_factura": "folio_factura",
  "foliofactura": "folio_factura",
  // serie_factura
  "serie factura": "serie_factura",
  "serie_factura": "serie_factura",
  "seriefactura": "serie_factura",
  // tipo_documento
  "tipo documento": "tipo_documento",
  "tipo_documento": "tipo_documento",
  "tipodocumento": "tipo_documento",
  // estado_venta
  "estado venta": "estado_venta",
  "estado_venta": "estado_venta",
  "estadoventa": "estado_venta",
  "estado de venta": "estado_venta",
  // fecha
  "fecha": "fecha",
  // descripcion
  "descripción": "descripcion",
  "descripcion": "descripcion",
  "description": "descripcion",
  // fecha_vencimiento
  "fecha vencimiento": "fecha_vencimiento",
  "fecha_vencimiento": "fecha_vencimiento",
  "fechavencimiento": "fecha_vencimiento",
  // usuario_alta
  "usuario alta": "usuario_alta",
  "usuario_alta": "usuario_alta",
  "usuarioalta": "usuario_alta",
  // observaciones
  "observaciones": "observaciones",
  // oc_cliente
  "occliente": "oc_cliente",
  "oc cliente": "oc_cliente",
  "oc_cliente": "oc_cliente",
  "orden de compra": "oc_cliente",
  // no_docto_venta
  "no. docto. venta": "no_docto_venta",
  "no docto venta": "no_docto_venta",
  "no_docto_venta": "no_docto_venta",
  "nodoctoventa": "no_docto_venta",
};

function normKey(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

function parseDate(d: any): string | null {
  if (!d) return null;
  const s = String(d).trim();
  // DD/MM/YYYY
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

function parseNum(v: any): number {
  if (v == null || v === "") return 0;
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    // Event header fields from the form
    const eventData = {
      fecha:           formData.get("fecha") as string || new Date().toISOString().slice(0, 10),
      folio_interno:   formData.get("folio_interno") as string || null,
      tipo:            (formData.get("tipo") as string) || "RESCATE",
      destino:         formData.get("destino") as string || null,
      tecnico:         formData.get("tecnico") as string || null,
      unidad:          formData.get("unidad") as string || null,
      bisonte:         formData.get("bisonte") as string || null,
      kw:              formData.get("kw") as string || null,
      vales:           formData.get("vales") as string || null,
      observaciones:   formData.get("observaciones") as string || null,
      imagen_url:      formData.get("imagen_url") as string || null,
    };

    if (!file) {
      return NextResponse.json({ success: false, error: "Se requiere un archivo CSV" }, { status: 400 });
    }

    // Parse CSV text
    const text = await file.text();
    const rawLines = text.split(/\r?\n/).filter(l => l.trim());
    if (rawLines.length < 2) {
      return NextResponse.json({ success: false, error: "El CSV está vacío o solo tiene encabezados" }, { status: 400 });
    }

    // Simple CSV split (handles quoted fields)
    function splitCsvLine(line: string): string[] {
      const fields: string[] = [];
      let cur = "";
      let inQ = false;
      for (const ch of line) {
        if (ch === '"') { inQ = !inQ; }
        else if (ch === "," && !inQ) { fields.push(cur.trim()); cur = ""; }
        else { cur += ch; }
      }
      fields.push(cur.trim());
      return fields;
    }

    const headers = splitCsvLine(rawLines[0]);
    // Build column map
    const colMap: Record<number, string> = {};
    headers.forEach((h, i) => {
      const mapped = SITIC_COL_MAP[normKey(h)];
      if (mapped) colMap[i] = mapped;
    });

    const hasArticulo = Object.values(colMap).includes("numero_articulo") ||
                        Object.values(colMap).includes("descripcion");
    if (!hasArticulo) {
      return NextResponse.json({
        success: false,
        error: `No se encontró columna de artículo. Columnas detectadas: ${headers.join(", ")}`
      }, { status: 400 });
    }

    // Parse data rows
    const items: any[] = [];
    for (let i = 1; i < rawLines.length; i++) {
      const cols = splitCsvLine(rawLines[i]);
      if (cols.every(c => !c)) continue;
      const row: Record<string, any> = {};
      cols.forEach((v, ci) => { if (colMap[ci]) row[colMap[ci]] = v; });
      items.push({
        numero_articulo:       String(row.numero_articulo || "").trim() || null,
        descripcion:           String(row.descripcion || "").trim() || null,
        cantidad_surtida:      parseNum(row.cantidad_surtida),
        cantidad_por_facturar: parseNum(row.cantidad_por_facturar),
        id_docto_cargo:        parseNum(row.id_docto_cargo) || null,
        folio_factura:         parseNum(row.folio_factura) || null,
        serie_factura:         String(row.serie_factura || "").trim() || null,
        tipo_documento:        String(row.tipo_documento || "").trim() || null,
        estado_venta:          String(row.estado_venta || "").trim() || null,
        fecha_vencimiento:     parseDate(row.fecha_vencimiento),
        usuario_alta:          String(row.usuario_alta || "").trim() || null,
        observaciones:         String(row.observaciones || "").trim() || null,
        oc_cliente:            String(row.oc_cliente || "").trim() || null,
        no_docto_venta:        parseNum(row.no_docto_venta) || null,
        // Map SITIC surtida → cantidad_entregada for rescue tracking
        cantidad_entregada:    parseNum(row.cantidad_surtida),
        cantidad_devuelta:     0,
        cantidad_usada:        0,
        cantidad_pendiente:    parseNum(row.cantidad_por_facturar),
        status_bisonte:        null,
        status_kw:             row.estado_venta || null,
      });
    }

    if (!items.length) {
      return NextResponse.json({ success: false, error: "No se encontraron filas de datos válidas" }, { status: 400 });
    }

    // Create the rescue event
    const eventResult: any = await query(
      `INSERT INTO rescue_events (fecha, folio_interno, tipo, destino, tecnico, unidad, bisonte, kw, vales, observaciones, imagen_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [eventData.fecha, eventData.folio_interno, eventData.tipo, eventData.destino,
       eventData.tecnico, eventData.unidad, eventData.bisonte, eventData.kw,
       eventData.vales, eventData.observaciones, eventData.imagen_url]
    );
    const eventId = eventResult.insertId;

    // Bulk insert items
    let created = 0;
    for (const item of items) {
      await query(
        `INSERT INTO rescue_items
          (event_id, numero_articulo, descripcion, cantidad_entregada, cantidad_devuelta, cantidad_usada, cantidad_pendiente,
           status_bisonte, status_kw, cantidad_surtida, cantidad_por_facturar, id_docto_cargo, folio_factura,
           serie_factura, tipo_documento, estado_venta, fecha_vencimiento, usuario_alta, oc_cliente, no_docto_venta)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [eventId, item.numero_articulo, item.descripcion,
         item.cantidad_entregada, item.cantidad_devuelta, item.cantidad_usada, item.cantidad_pendiente,
         item.status_bisonte, item.status_kw,
         item.cantidad_surtida, item.cantidad_por_facturar, item.id_docto_cargo, item.folio_factura,
         item.serie_factura, item.tipo_documento, item.estado_venta, item.fecha_vencimiento,
         item.usuario_alta, item.oc_cliente, item.no_docto_venta]
      );
      created++;
    }

    const [createdEvent] = await query("SELECT * FROM rescue_events WHERE id = ?", [eventId]) as any[];
    return NextResponse.json({
      success: true,
      data: { event: createdEvent, items_created: created, total_rows_parsed: items.length }
    }, { status: 201 });
  } catch (error: any) {
    console.error("Bulk CSV error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
