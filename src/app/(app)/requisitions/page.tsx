"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PlusCircle, CheckCircle2, Truck, XCircle, ThumbsUp, Loader2, ArrowRightLeft, Upload, Trash2,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

type RequisitionRow = {
  id: number;
  request_id: string;
  type: "Requisition" | "Transfer";
  item_id: number;
  numero_articulo: string;
  item_name: string;
  quantity: number;
  from_warehouse_id: number | null;
  from_warehouse_name: string | null;
  to_warehouse_id: number | null;
  to_warehouse_name: string | null;
  from_sub_warehouse_id: number | null;
  to_sub_warehouse_id: number | null;
  observaciones: string | null;
  to_destination: string | null;
  status: "Pending" | "Approved" | "In Transit" | "Completed" | "Closed" | "Rejected";
  is_stalled?: boolean;
  created_at: string;
};

type InventoryItem = { id: number; numero_articulo: string; descripcion: string; existencia: number; warehouse_name: string };
type Warehouse = { id: number; name: string };
type SubWarehouse = { id: number; nombre: string; parent_warehouse_name: string | null };

const StatusBadge = ({ status }: { status: string }) => {
  const className: Record<string, string> = {
    Pending: "bg-yellow-200 text-yellow-800",
    Approved: "bg-blue-200 text-blue-800",
    "In Transit": "bg-purple-200 text-purple-800",
    Completed: "bg-green-200 text-green-800",
    Closed: "bg-zinc-200 text-zinc-800",
    Rejected: "bg-red-200 text-red-800",
  };
  return <Badge className={className[status] || ""}>{status}</Badge>;
};

export default function RequisitionsPage() {
  const [requisitions, setRequisitions] = useState<RequisitionRow[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [subWarehouses, setSubWarehouses] = useState<SubWarehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const { toast } = useToast();

  type FormLine = { uid: string; item_id: string; quantity: string; observaciones: string };
  const newLine = (): FormLine => ({ uid: Math.random().toString(36).slice(2), item_id: "", quantity: "", observaciones: "" });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formFrom, setFormFrom] = useState("");
  const [formTo, setFormTo] = useState("");
  const [formLines, setFormLines] = useState<FormLine[]>([newLine()]);
  const [submitting, setSubmitting] = useState(false);

  const [bulkOpen, setBulkOpen] = useState(false);
  const excelRef = useRef<HTMLInputElement>(null);
  const [bulkRows, setBulkRows] = useState<any[]>([]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, invRes, whRes, swRes] = await Promise.all([
        fetch("/api/requisitions"),
        fetch("/api/inventory"),
        fetch("/api/warehouses"),
        fetch("/api/subalmacenes"),
      ]);
      const [reqData, invData, whData, swData] = await Promise.all([
        reqRes.json(), invRes.json(), whRes.json(), swRes.json(),
      ]);
      if (reqData.success) setRequisitions(reqData.data.filter((r: any) => r.type === "Requisition"));
      if (invData.success) setItems(invData.data);
      if (whData.success) setWarehouses(whData.data);
      if (swData.success) setSubWarehouses(swData.data);
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to load data" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => { setFormFrom(""); setFormTo(""); setFormLines([newLine()]); };
  const addLine = () => setFormLines((prev) => [...prev, newLine()]);
  const removeLine = (uid: string) => setFormLines((prev) => prev.length > 1 ? prev.filter((l) => l.uid !== uid) : prev);
  const updateLine = (uid: string, field: keyof Omit<FormLine, "uid">, value: string) =>
    setFormLines((prev) => prev.map((l) => l.uid === uid ? { ...l, [field]: value } : l));

  const handleSubmit = async () => {
    if (!formFrom || !formTo) {
      toast({ variant: "destructive", title: "Error", description: "Debes seleccionar Sub-almacén de origen y destino" });
      return;
    }
    const validLines = formLines.filter((l) => l.item_id && l.quantity && Number(l.quantity) > 0);
    if (validLines.length === 0) {
      toast({ variant: "destructive", title: "Error", description: "Agrega al menos un artículo con cantidad" });
      return;
    }
    setSubmitting(true);
    let created = 0; let failed = 0;
    for (const line of validLines) {
      try {
        const res = await fetch("/api/requisitions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "Requisition",
            item_id: Number(line.item_id),
            quantity: Number(line.quantity),
            from_sub_warehouse_id: Number(formFrom),
            to_sub_warehouse_id: Number(formTo),
            observaciones: line.observaciones || undefined,
          }),
        });
        const data = await res.json();
        if (data.success) created++; else failed++;
      } catch { failed++; }
    }
    setSubmitting(false);
    if (created > 0) {
      toast({ title: "Requisiciones creadas", description: created + " artículo(s) registrados" + (failed > 0 ? " | " + failed + " fallidos" : "") });
      setDialogOpen(false); resetForm(); fetchData();
    } else {
      toast({ variant: "destructive", title: "Error", description: "No se pudo crear ninguna requisición" });
    }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      const res = await fetch("/api/requisitions/" + id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) { toast({ title: "Actualizado", description: "Estado cambiado a " + status }); fetchData(); }
      else toast({ variant: "destructive", title: "Error", description: data.error });
    } catch { toast({ variant: "destructive", title: "Error", description: "Error al actualizar" }); }
  };

  const handleExcelBulk = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      if (rows.length === 0) throw new Error("Archivo vacio");
      const COL: Record<string, string> = {
        "numero_parte": "numero_parte", "numero de parte": "numero_parte", "num parte": "numero_parte",
        "descripcion": "descripcion",
        "cantidad": "cantidad",
        "almacen_origen": "almacen_origen", "almacen origen": "almacen_origen", "origen": "almacen_origen",
        "almacen_destino": "almacen_destino", "almacen destino": "almacen_destino", "destino": "almacen_destino",
        "observaciones": "observaciones", "notas": "observaciones",
      };
      const parsed = rows.map((raw) => {
        const row: Record<string, any> = {};
        for (const [k, v] of Object.entries(raw)) {
          const mapped = COL[k.toLowerCase().trim()];
          if (mapped) row[mapped] = v;
        }
        return row;
      }).filter((r) => r.numero_parte && r.cantidad);
      if (parsed.length === 0) throw new Error("No se encontraron filas validas");
      setBulkRows(parsed);
      setBulkOpen(true);
    } catch (err: any) { toast({ variant: "destructive", title: "Error", description: err.message }); }
  };

  const handleBulkSubmit = async () => {
    setBulkSubmitting(true);
    let created = 0; let failed = 0;
    for (const row of bulkRows) {
      try {
        const item = items.find((i) => i.numero_articulo.toLowerCase() === String(row.numero_parte).toLowerCase());
        if (!item) { failed++; continue; }
        const fromSw = subWarehouses.find((sw) => sw.nombre.toLowerCase() === String(row.almacen_origen || "").toLowerCase());
        const toSw = subWarehouses.find((sw) => sw.nombre.toLowerCase() === String(row.almacen_destino || "").toLowerCase());
        const body: any = { type: "Requisition", item_id: item.id, quantity: Number(row.cantidad), observaciones: row.observaciones || undefined };
        if (fromSw) body.from_sub_warehouse_id = fromSw.id;
        if (toSw) body.to_sub_warehouse_id = toSw.id;
        const res = await fetch("/api/requisitions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const data = await res.json();
        if (data.success) created++; else failed++;
      } catch { failed++; }
    }
    toast({ title: "Carga masiva completada", description: "Creadas: " + created + " | Fallidas: " + failed });
    setBulkOpen(false); setBulkRows([]); fetchData(); setBulkSubmitting(false);
  };

  const swName = (id: number | null) => {
    if (!id) return "—";
    return subWarehouses.find((sw) => sw.id === id)?.nombre || ("ID:" + id);
  };

  const filtered = requisitions.filter((r) => tab === "all" || r.status === tab);

  return (
    <>
      <PageHeader title="Requisiciones" description="Registra y da seguimiento a las requisiciones de partes." />

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <CardTitle>Requisiciones</CardTitle>
              <CardDescription>Solicitudes internas de movimiento de partes entre sub-almacenes.</CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => excelRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" /> Subir Excel
              </Button>
              <input type="file" ref={excelRef} accept=".xlsx,.xls,.csv" onChange={handleExcelBulk} className="hidden" />

              <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button><PlusCircle className="mr-2 h-4 w-4" /> Nueva Requisicion</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[780px]">
                  <DialogHeader>
                    <DialogTitle>Nueva Requisicion</DialogTitle>
                    <DialogDescription>Agrega todos los artículos que necesitas en una sola solicitud.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-2">
                    {/* Origen y Destino globales */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="mb-1 block">Desde (sub-almacén origen)</Label>
                        <Select value={formFrom} onValueChange={setFormFrom}>
                          <SelectTrigger><SelectValue placeholder="Sub-almacén de origen..." /></SelectTrigger>
                          <SelectContent>
                            {subWarehouses.map((sw) => (
                              <SelectItem key={sw.id} value={String(sw.id)}>{sw.nombre}{sw.parent_warehouse_name ? " (" + sw.parent_warehouse_name + ")" : ""}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="mb-1 block">Hacia (sub-almacén destino)</Label>
                        <Select value={formTo} onValueChange={setFormTo}>
                          <SelectTrigger><SelectValue placeholder="Sub-almacén de destino..." /></SelectTrigger>
                          <SelectContent>
                            {subWarehouses.filter((sw) => String(sw.id) !== formFrom).map((sw) => (
                              <SelectItem key={sw.id} value={String(sw.id)}>{sw.nombre}{sw.parent_warehouse_name ? " (" + sw.parent_warehouse_name + ")" : ""}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Tabla de artículos */}
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted">
                            <TableHead>Artículo</TableHead>
                            <TableHead className="w-24">Cantidad</TableHead>
                            <TableHead>Observaciones</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {formLines.map((line) => (
                            <TableRow key={line.uid}>
                              <TableCell className="p-1">
                                <Select value={line.item_id} onValueChange={(v) => updateLine(line.uid, "item_id", v)}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                  <SelectContent>
                                    {items.map((it) => (
                                      <SelectItem key={it.id} value={String(it.id)}>{it.numero_articulo} — {it.descripcion} (Stock: {it.existencia})</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="p-1">
                                <Input type="number" min={1} className="h-8 text-xs" value={line.quantity} onChange={(e) => updateLine(line.uid, "quantity", e.target.value)} placeholder="Cant." />
                              </TableCell>
                              <TableCell className="p-1">
                                <Input className="h-8 text-xs" value={line.observaciones} onChange={(e) => updateLine(line.uid, "observaciones", e.target.value)} placeholder="Notas (opcional)" />
                              </TableCell>
                              <TableCell className="p-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeLine(line.uid)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <Button variant="outline" size="sm" onClick={addLine} className="w-fit">
                      <PlusCircle className="mr-2 h-4 w-4" /> Agregar artículo
                    </Button>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={submitting}>
                      {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {submitting ? "Creando..." : "Crear " + formLines.filter((l) => l.item_id && l.quantity).length + " requisición(es)"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={tab} onValueChange={setTab} className="mb-4">
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="Pending">Pendientes</TabsTrigger>
              <TabsTrigger value="Approved">Aprobadas</TabsTrigger>
              <TabsTrigger value="In Transit">En Transito</TabsTrigger>
              <TabsTrigger value="Completed">Completadas</TabsTrigger>
              <TabsTrigger value="Closed">Cerradas</TabsTrigger>
              <TabsTrigger value="Rejected">Rechazadas</TabsTrigger>
            </TabsList>
          </Tabs>

          {loading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ArrowRightLeft className="h-10 w-10 mb-3" />
              <p className="text-lg font-medium">No hay requisiciones en este estado</p>
              <p className="text-sm">Crea una nueva o sube un Excel para comenzar.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Articulo</TableHead>
                    <TableHead>Desde</TableHead>
                    <TableHead>Hacia</TableHead>
                    <TableHead className="text-right">Cant.</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Observaciones</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((req) => (
                    <TableRow key={req.id} className={req.is_stalled ? "bg-amber-50" : ""}>
                      <TableCell className="font-medium">{req.request_id}</TableCell>
                      <TableCell><div className="text-sm font-medium">{req.numero_articulo}</div><div className="text-xs text-muted-foreground">{req.item_name}</div></TableCell>
                      <TableCell>{req.from_sub_warehouse_id ? swName(req.from_sub_warehouse_id) : (req.from_warehouse_name || "—")}</TableCell>
                      <TableCell>{req.to_sub_warehouse_id ? swName(req.to_sub_warehouse_id) : (req.to_warehouse_name || req.to_destination || "—")}</TableCell>
                      <TableCell className="text-right">{req.quantity}</TableCell>
                      <TableCell>
                        <span className="text-sm">{new Date(req.created_at).toLocaleDateString("es-MX")}</span>
                        {req.is_stalled && <div className="text-xs text-amber-700">+2 dias sin movimiento</div>}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate text-sm">{req.observaciones || "—"}</TableCell>
                      <TableCell><StatusBadge status={req.status} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {req.status === "Pending" && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => updateStatus(req.id, "Approved")}><ThumbsUp className="h-4 w-4 mr-1" /> Aprobar</Button>
                              <Button variant="ghost" size="sm" onClick={() => updateStatus(req.id, "Rejected")}><XCircle className="h-4 w-4 mr-1 text-destructive" /> Rechazar</Button>
                            </>
                          )}
                          {req.status === "Approved" && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => updateStatus(req.id, "In Transit")}><Truck className="h-4 w-4 mr-1" /> En Transito</Button>
                              <Button variant="ghost" size="sm" onClick={() => updateStatus(req.id, "Rejected")}><XCircle className="h-4 w-4 mr-1 text-destructive" /> Rechazar</Button>
                            </>
                          )}
                          {req.status === "In Transit" && (
                            <Button variant="ghost" size="sm" onClick={() => updateStatus(req.id, "Completed")}><CheckCircle2 className="h-4 w-4 mr-1" /> Completar</Button>
                          )}
                          {req.status === "Completed" && (
                            <Button variant="ghost" size="sm" onClick={() => updateStatus(req.id, "Closed")}><CheckCircle2 className="h-4 w-4 mr-1" /> Cerrar</Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={bulkOpen} onOpenChange={(o) => { if (!o) { setBulkOpen(false); setBulkRows([]); } }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vista previa — Carga masiva</DialogTitle>
            <DialogDescription>{bulkRows.length} fila(s) encontradas. Revisa y confirma.</DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Num. Parte</TableHead>
                  <TableHead>Descripcion</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Observaciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bulkRows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{row.numero_parte}</TableCell>
                    <TableCell>{row.descripcion || "—"}</TableCell>
                    <TableCell className="text-right">{row.cantidad}</TableCell>
                    <TableCell>{row.almacen_origen || "—"}</TableCell>
                    <TableCell>{row.almacen_destino || "—"}</TableCell>
                    <TableCell>{row.observaciones || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBulkOpen(false); setBulkRows([]); }}>Cancelar</Button>
            <Button onClick={handleBulkSubmit} disabled={bulkSubmitting}>
              {bulkSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {bulkSubmitting ? "Creando..." : "Crear " + bulkRows.length + " requisicion(es)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
