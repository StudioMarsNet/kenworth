"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Search, X, Truck, Eye, RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Rescate = {
  id: number;
  fecha: string;
  folio_interno: string;
  tipo: "RESCATE" | "MTTO";
  destino: string;
  item: string;
  descripcion: string;
  cantidad_entregada: number;
  cantidad_devuelta: number;
  cantidad_usada: number;
  cantidad_pendiente: number;
  status_bisonte: string;
  status_kw: string;
  tecnico: string;
  unidad: string;
  bisonte: string;
  kw: string;
  vales: string;
  observaciones: string;
};

type VentaRelacionada = {
  id: number;
  numero_articulo: string;
  descripcion: string;
  cantidad_surtida: number;
  estado_venta: string;
  fecha: string;
  folio_factura: string;
  serie_factura: string;
};

const ALL_STATUS_KW = [
  "Devuelta",
  "Facturada",
  "Impresa",
  "Parcialmente Devuelta",
  "Parcialmente Devuelta y Parcialmente Facturada",
  "Parcialmente Facturada",
  "Sin Imprimir",
];

const EMPTY_FORM: Partial<Rescate> = {
  fecha: new Date().toISOString().slice(0, 10),
  tipo: "RESCATE",
  cantidad_entregada: 0,
  cantidad_devuelta: 0,
  cantidad_usada: 0,
  cantidad_pendiente: 0,
};

function statusKwBadge(s: string) {
  if (!s) return <Badge variant="secondary">—</Badge>;
  const v = s.toLowerCase();
  if (v === "facturada") return <Badge className="bg-green-500/15 text-green-400 border-green-500/30 border text-xs">{s}</Badge>;
  if (v === "devuelta") return <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 border text-xs">{s}</Badge>;
  if (v === "impresa") return <Badge className="bg-purple-500/15 text-purple-400 border-purple-500/30 border text-xs">{s}</Badge>;
  if (v === "sin imprimir") return <Badge className="bg-red-500/15 text-red-400 border-red-500/30 border text-xs">{s}</Badge>;
  if (v.includes("parcialmente")) return <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 border text-xs">{s}</Badge>;
  return <Badge variant="outline" className="text-xs">{s}</Badge>;
}

function tipoChip(t: string) {
  return t === "RESCATE"
    ? <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold bg-red-500/15 text-red-400 border-red-500/30">{t}</span>
    : <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold bg-blue-500/15 text-blue-400 border-blue-500/30">{t}</span>;
}

export default function RescuesPage() {
  const [rescates, setRescates] = useState<Rescate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [filterTipo, setFilterTipo] = useState("all");
  const [filterStatusKw, setFilterStatusKw] = useState("all");
  const [filterFechaDesde, setFilterFechaDesde] = useState("");
  const [filterFechaHasta, setFilterFechaHasta] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<Rescate>>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<(Rescate & { ventas_relacionadas: VentaRelacionada[] }) | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Rescate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const LIMIT = 50;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (q) params.set("q", q);
    if (filterTipo !== "all") params.set("tipo", filterTipo);
    if (filterStatusKw !== "all") params.set("status_kw", filterStatusKw);
    if (filterFechaDesde) params.set("fecha_desde", filterFechaDesde);
    if (filterFechaHasta) params.set("fecha_hasta", filterFechaHasta);
    try {
      const res = await fetch(`/api/rescues?${params}`);
      const json = await res.json();
      if (json.success) { setRescates(json.data); setTotal(json.pagination.total); }
    } finally { setLoading(false); }
  }, [page, q, filterTipo, filterStatusKw, filterFechaDesde, filterFechaHasta]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setFormError(""); setShowForm(true); };
  const openEdit = (r: Rescate) => { setEditingId(r.id); setForm({ ...r }); setFormError(""); setShowForm(true); };

  const openDetail = async (id: number) => {
    setDetailId(id); setLoadingDetail(true); setDetail(null);
    const res = await fetch(`/api/rescues/${id}`);
    const json = await res.json();
    if (json.success) setDetail(json.data);
    setLoadingDetail(false);
  };

  const handleSave = async () => {
    setSaving(true); setFormError("");
    try {
      const url = editingId ? `/api/rescues/${editingId}` : "/api/rescues";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const json = await res.json();
      if (!json.success) { setFormError(JSON.stringify(json.error)); return; }
      setShowForm(false); fetchData();
    } catch (e: any) { setFormError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await fetch(`/api/rescues/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false); setDeleteTarget(null); fetchData();
  };

  const exportCsv = () => {
    const headers = ["ID","Fecha","Folio","Tipo","Destino","Item","Descripción","Entregada","Devuelta","Usada","Pendiente","Status KW","Status Bisonte","Técnico","Unidad","Vales"];
    const rows = rescates.map(r => [r.id, r.fecha, r.folio_interno, r.tipo, r.destino, r.item, `"${(r.descripcion||"").replace(/"/g,'""')}"`, r.cantidad_entregada, r.cantidad_devuelta, r.cantidad_usada, r.cantidad_pendiente, r.status_kw, r.status_bisonte, r.tecnico, r.unidad, r.vales]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const a = document.createElement("a"); a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = "rescates_bisonte.csv"; a.click();
  };

  const f = (key: keyof Rescate, val: any) => setForm(prev => ({ ...prev, [key]: val }));
  const pages = Math.ceil(total / LIMIT);

  const stats = {
    total,
    rescates: rescates.filter(r => r.tipo === "RESCATE").length,
    mtto: rescates.filter(r => r.tipo === "MTTO").length,
    pendientes: rescates.filter(r => (r.status_kw || "").toLowerCase() === "sin imprimir" || (r.status_kw || "").toLowerCase().includes("pendiente")).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20">
          <Truck className="h-6 w-6 text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestión de Rescates</h1>
          <p className="text-sm text-muted-foreground">Bisonte SLP · Consigna Kenworth — {total.toLocaleString()} registros</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total registros", val: total, color: "text-foreground" },
          { label: "RESCATES", val: stats.rescates, color: "text-red-400" },
          { label: "MTTO", val: stats.mtto, color: "text-blue-400" },
          { label: "Sin imprimir / Pendientes", val: stats.pendientes, color: "text-yellow-400" },
        ].map(s => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar folio, item, técnico, unidad, vale…" className="pl-9" value={q}
            onChange={e => { setQ(e.target.value); setPage(1); }} />
        </div>
        <Select value={filterTipo} onValueChange={v => { setFilterTipo(v); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="RESCATE">RESCATE</SelectItem>
            <SelectItem value="MTTO">MTTO</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatusKw} onValueChange={v => { setFilterStatusKw(v); setPage(1); }}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Status KW" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {ALL_STATUS_KW.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" className="w-36" value={filterFechaDesde} onChange={e => { setFilterFechaDesde(e.target.value); setPage(1); }} />
        <Input type="date" className="w-36" value={filterFechaHasta} onChange={e => { setFilterFechaHasta(e.target.value); setPage(1); }} />
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="icon" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={exportCsv}><Download className="h-4 w-4" /></Button>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Nuevo</Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="border-b bg-muted/30">
              {["Fecha","Folio","Tipo","Destino","Item","Descripción","Ent/Us/Pen","Status KW","Status Bisonte","Técnico","Unidad","Vales","Acciones"].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={13} className="text-center py-16 text-muted-foreground">Cargando…</td></tr>
            ) : rescates.length === 0 ? (
              <tr><td colSpan={13} className="text-center py-16 text-muted-foreground">Sin resultados</td></tr>
            ) : rescates.map(r => (
              <tr key={r.id} className="border-b hover:bg-muted/20 transition-colors">
                <td className="px-3 py-2 whitespace-nowrap text-xs">{r.fecha?.slice(0,10)}</td>
                <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{r.folio_interno}</td>
                <td className="px-3 py-2">{tipoChip(r.tipo)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-xs">{r.destino}</td>
                <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{r.item}</td>
                <td className="px-3 py-2 max-w-[180px] truncate text-xs" title={r.descripcion}>{r.descripcion}</td>
                <td className="px-3 py-2 text-center text-xs whitespace-nowrap" title={`Entregada:${r.cantidad_entregada} Usada:${r.cantidad_usada} Pendiente:${r.cantidad_pendiente}`}>
                  <span className="text-green-400">{r.cantidad_entregada}</span>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-blue-400">{r.cantidad_usada}</span>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-yellow-400">{r.cantidad_pendiente}</span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{statusKwBadge(r.status_kw)}</td>
                <td className="px-3 py-2 max-w-[140px] truncate text-xs text-muted-foreground" title={r.status_bisonte}>{r.status_bisonte || "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap text-xs">{r.tecnico}</td>
                <td className="px-3 py-2 whitespace-nowrap text-xs">{r.unidad}</td>
                <td className="px-3 py-2 whitespace-nowrap text-xs">{r.vales}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDetail(r.id)} title="Ver ventas enlazadas"><Eye className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Mostrando {((page-1)*LIMIT)+1}–{Math.min(page*LIMIT, total)} de {total}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p-1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(p => p+1)}>Siguiente</Button>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Editar Rescate" : "Nuevo Rescate"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5"><Label>Fecha *</Label><Input type="date" value={form.fecha?.slice(0,10)||""} onChange={e => f("fecha", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Folio Interno (SITIC)</Label><Input value={form.folio_interno||""} onChange={e => f("folio_interno", e.target.value)} placeholder="ej. 3611353" /></div>
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select value={form.tipo||"RESCATE"} onValueChange={v => f("tipo", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="RESCATE">RESCATE</SelectItem><SelectItem value="MTTO">MTTO</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Destino</Label><Input value={form.destino||""} onChange={e => f("destino", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Item (SKU)</Label><Input value={form.item||""} onChange={e => f("item", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Técnico</Label><Input value={form.tecnico||""} onChange={e => f("tecnico", e.target.value)} /></div>
            <div className="space-y-1.5 md:col-span-2"><Label>Descripción</Label><Input value={form.descripcion||""} onChange={e => f("descripcion", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Unidad</Label><Input value={form.unidad||""} onChange={e => f("unidad", e.target.value)} placeholder="ej. T-691" /></div>
            <div className="space-y-1.5"><Label>Vales</Label><Input value={form.vales||""} onChange={e => f("vales", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Representante Bisonte</Label><Input value={form.bisonte||""} onChange={e => f("bisonte", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Representante KW</Label><Input value={form.kw||""} onChange={e => f("kw", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Cant. Entregada</Label><Input type="number" value={form.cantidad_entregada??0} onChange={e => f("cantidad_entregada", parseFloat(e.target.value))} /></div>
            <div className="space-y-1.5"><Label>Cant. Devuelta</Label><Input type="number" value={form.cantidad_devuelta??0} onChange={e => f("cantidad_devuelta", parseFloat(e.target.value))} /></div>
            <div className="space-y-1.5"><Label>Cant. Usada</Label><Input type="number" value={form.cantidad_usada??0} onChange={e => f("cantidad_usada", parseFloat(e.target.value))} /></div>
            <div className="space-y-1.5"><Label>Cant. Pendiente</Label><Input type="number" value={form.cantidad_pendiente??0} onChange={e => f("cantidad_pendiente", parseFloat(e.target.value))} /></div>
            <div className="space-y-1.5">
              <Label>Status KW</Label>
              <Select value={form.status_kw||""} onValueChange={v => f("status_kw", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar estado" /></SelectTrigger>
                <SelectContent>{ALL_STATUS_KW.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Status Bisonte</Label><Input value={form.status_bisonte||""} onChange={e => f("status_bisonte", e.target.value)} placeholder="ej. VALE ENTREGADO POR BISONTE" /></div>
            <div className="space-y-1.5 md:col-span-2"><Label>Observaciones</Label><Textarea rows={3} value={form.observaciones||""} onChange={e => f("observaciones", e.target.value)} /></div>
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail / Ventas modal */}
      <Dialog open={detailId !== null} onOpenChange={open => { if (!open) { setDetailId(null); setDetail(null); }}}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Ventas Relacionadas al Rescate</DialogTitle></DialogHeader>
          {loadingDetail ? (
            <div className="py-12 text-center text-muted-foreground">Cargando…</div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/10 p-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div><span className="text-muted-foreground">Folio SITIC:</span> <span className="font-mono font-semibold">{detail.folio_interno}</span></div>
                <div><span className="text-muted-foreground">Tipo:</span> {tipoChip(detail.tipo)}</div>
                <div><span className="text-muted-foreground">Destino:</span> {detail.destino}</div>
                <div><span className="text-muted-foreground">Técnico:</span> {detail.tecnico}</div>
                <div><span className="text-muted-foreground">Unidad:</span> {detail.unidad}</div>
                <div><span className="text-muted-foreground">Vales:</span> {detail.vales}</div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">
                  Registros de ventas con folio {detail.folio_interno}
                  <Badge variant="outline" className="ml-2">{detail.ventas_relacionadas.length}</Badge>
                </h3>
                {detail.ventas_relacionadas.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No hay ventas enlazadas a este folio.</p>
                ) : (
                  <div className="rounded-lg border overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          {["Artículo","Descripción","Cantidad","Estado","Factura","Fecha"].map(h => (
                            <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {detail.ventas_relacionadas.map(v => (
                          <tr key={v.id} className="border-b hover:bg-muted/10">
                            <td className="px-3 py-2 font-mono">{v.numero_articulo}</td>
                            <td className="px-3 py-2 max-w-[160px] truncate" title={v.descripcion}>{v.descripcion}</td>
                            <td className="px-3 py-2 text-center">{v.cantidad_surtida}</td>
                            <td className="px-3 py-2">{statusKwBadge(v.estado_venta)}</td>
                            <td className="px-3 py-2 font-mono">{v.folio_factura ? `${v.folio_factura} ${v.serie_factura||""}` : "—"}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{v.fecha?.slice(0,10)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : null}
          <DialogFooter><Button variant="outline" onClick={() => { setDetailId(null); setDetail(null); }}>Cerrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Eliminar rescate</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Eliminar el rescate <span className="font-medium text-foreground">{deleteTarget?.item}</span> del {deleteTarget?.fecha?.slice(0,10)}? Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? "Eliminando…" : "Eliminar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
