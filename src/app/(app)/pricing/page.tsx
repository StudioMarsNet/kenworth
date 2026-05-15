"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, Plus, Pencil, Trash2, Loader2, Download, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Cliente = {
  id: number;
  nombre: string;
  porcentaje_markup: number;
  contacto: string;
  notas: string;
  activo: boolean;
};

type PrecioItem = {
  numero_articulo: string;
  descripcion: string;
  precio_base: number;
  existencia: number;
  warehouse_name: string;
  markup_porcentaje: number;
  precio_cliente: number;
  precio_con_iva: number;
};

type ScenarioTemplate = {
  name: string;
  markup: number;
  tipoCambio: number;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);

export default function PreciosPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [precios, setPrecios] = useState<PrecioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPrecios, setLoadingPrecios] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState("all");
  const [clienteNombre, setClienteNombre] = useState("Precio Base");
  const [markup, setMarkup] = useState(0);
  const [search, setSearch] = useState("");
  const [simMarkup, setSimMarkup] = useState(0);
  const [simTipoCambio, setSimTipoCambio] = useState(1);
  const [templateName, setTemplateName] = useState("");
  const [templates, setTemplates] = useState<ScenarioTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("none");
  const [priceUploadLoading, setPriceUploadLoading] = useState(false);
  const priceFileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Cliente CRUD
  const [showClienteDialog, setShowClienteDialog] = useState(false);
  const [editCliente, setEditCliente] = useState<Cliente | null>(null);
  const [clienteForm, setClienteForm] = useState({ nombre: "", porcentaje_markup: 0, contacto: "", notas: "" });
  const [saving, setSaving] = useState(false);
  const [deleteCliente, setDeleteCliente] = useState<Cliente | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchClientes = useCallback(async () => {
    try {
      const res = await fetch("/api/clients");
      const data = await res.json();
      if (data.success) setClientes(data.data);
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Error al cargar clientes" });
    }
  }, [toast]);

  const fetchPrecios = useCallback(async (clienteId?: string) => {
    setLoadingPrecios(true);
    try {
      const params = new URLSearchParams();
      if (clienteId && clienteId !== "all") params.set("cliente_id", clienteId);
      if (search) params.set("search", search);

      const res = await fetch(`/api/precios?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setPrecios(data.data);
        setClienteNombre(data.cliente);
        setMarkup(data.markup);
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Error al cargar precios" });
    } finally {
      setLoadingPrecios(false);
    }
  }, [search, toast]);

  useEffect(() => {
    const init = async () => {
      await fetchClientes();
      await fetchPrecios();
      setLoading(false);
    };
    init();
  }, [fetchClientes, fetchPrecios]);

  useEffect(() => {
    fetchPrecios(selectedCliente);
  }, [selectedCliente, fetchPrecios]);

  useEffect(() => {
    const raw = localStorage.getItem("pricing_scenarios");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setTemplates(parsed);
      } catch {}
    }
  }, []);

  useEffect(() => {
    setSimMarkup(markup);
  }, [markup]);

  // Client form handlers
  const openNewCliente = () => {
    setEditCliente(null);
    setClienteForm({ nombre: "", porcentaje_markup: 0, contacto: "", notas: "" });
    setShowClienteDialog(true);
  };
  const openEditCliente = (c: Cliente) => {
    setEditCliente(c);
    setClienteForm({ nombre: c.nombre, porcentaje_markup: c.porcentaje_markup, contacto: c.contacto, notas: c.notas || "" });
    setShowClienteDialog(true);
  };
  const handleSaveCliente = async () => {
    setSaving(true);
    try {
      const url = editCliente ? `/api/clients/${editCliente.id}` : "/api/clients";
      const method = editCliente ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clienteForm),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: editCliente ? "Cliente actualizado" : "Cliente creado" });
        setShowClienteDialog(false);
        fetchClientes();
      } else {
        toast({ variant: "destructive", title: "Error", description: typeof data.error === "string" ? data.error : "Error al guardar" });
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Error de conexión" });
    } finally {
      setSaving(false);
    }
  };
  const handleDeleteCliente = async () => {
    if (!deleteCliente) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/clients/${deleteCliente.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Cliente eliminado" });
        setDeleteCliente(null);
        fetchClientes();
        if (selectedCliente === String(deleteCliente.id)) {
          setSelectedCliente("all");
        }
      } else {
        toast({ variant: "destructive", title: "Error", description: data.error });
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Error al eliminar" });
    } finally {
      setDeleting(false);
    }
  };

  // Export CSV
  const handleExport = () => {
    if (precios.length === 0) return;
    const headers = ["Núm. Parte", "Descripción", "Precio Base", "Markup %", "Precio Cliente", "Precio + IVA"];
    const rows = precios.map((p) => [
      p.numero_articulo,
      `"${p.descripcion.replace(/"/g, '""')}"`,
      p.precio_base.toFixed(2),
      p.markup_porcentaje.toFixed(2),
      p.precio_cliente.toFixed(2),
      p.precio_con_iva.toFixed(2),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `precios_${clienteNombre.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveTemplate = () => {
    if (!templateName.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Escribe nombre de plantilla" });
      return;
    }
    const next = [
      ...templates.filter((t) => t.name !== templateName.trim()),
      { name: templateName.trim(), markup: simMarkup, tipoCambio: simTipoCambio },
    ];
    setTemplates(next);
    localStorage.setItem("pricing_scenarios", JSON.stringify(next));
    setTemplateName("");
    toast({ title: "Plantilla guardada" });
  };

  const applyTemplate = (name: string) => {
    setSelectedTemplate(name);
    if (name === "none") return;
    const found = templates.find((t) => t.name === name);
    if (!found) return;
    setSimMarkup(found.markup);
    setSimTipoCambio(found.tipoCambio);
  };

  const exportToQuotes = () => {
    if (precios.length === 0) {
      toast({ variant: "destructive", title: "Error", description: "No hay artículos para exportar" });
      return;
    }

    const draft = {
      cliente_nombre: clienteNombre === "Precio Base" ? "Cliente Simulado" : clienteNombre,
      moneda: "MXN",
      tipo_cambio: simTipoCambio,
      items: precios.slice(0, 50).map((p) => ({
        numero_articulo: p.numero_articulo,
        descripcion: p.descripcion,
        cantidad: 1,
        precio_unitario: Math.round(p.precio_base * (1 + simMarkup / 100) * simTipoCambio * 100) / 100,
        descuento: 0,
      })),
    };

    localStorage.setItem("pricing_quote_draft", JSON.stringify(draft));
    window.location.href = "/quotes";
  };

  const handlePriceUpload = async () => {
    const file = priceFileRef.current?.files?.[0];
    if (!file) {
      toast({ variant: "destructive", title: "Error", description: "Selecciona un archivo de precios" });
      return;
    }

    setPriceUploadLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const raw: Record<string, any>[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

      if (raw.length === 0) {
        throw new Error("El archivo está vacío");
      }

      const mapHeader = (h: string) => h.toLowerCase().trim();

      const rows = raw
        .map((r) => {
          const normalized: Record<string, any> = {};
          for (const [k, v] of Object.entries(r)) {
            normalized[mapHeader(k)] = v;
          }
          return {
            numero_articulo:
              normalized["núm. artículo"] ??
              normalized["num. articulo"] ??
              normalized["num articulo"] ??
              normalized["numero_articulo"] ??
              normalized["número de parte"] ??
              normalized["numero de parte"],
            precio_mostrador:
              normalized["mostrador"] ??
              normalized["precio mostrador"] ??
              normalized["precio"],
          };
        })
        .filter((r) => r.numero_articulo && r.precio_mostrador != null);

      if (rows.length === 0) {
        throw new Error("No se encontraron columnas válidas. Usa: Núm. Artículo y Mostrador");
      }

      const res = await fetch("/api/precios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(typeof data.error === "string" ? data.error : "Error al actualizar precios");
      }

      toast({
        title: "Precios actualizados",
        description: `Actualizados: ${data.data.updated} | Omitidos: ${data.data.skipped}`,
      });

      if (priceFileRef.current) priceFileRef.current.value = "";
      fetchPrecios(selectedCliente);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "No se pudo procesar el archivo" });
    } finally {
      setPriceUploadLoading(false);
    }
  };

  const preciosSimulados = precios.map((p) => {
    const precioCliente = Math.round(p.precio_base * (1 + simMarkup / 100) * simTipoCambio * 100) / 100;
    const precioConIva = Math.round(precioCliente * 1.16 * 100) / 100;
    return { ...p, sim_markup: simMarkup, sim_precio_cliente: precioCliente, sim_precio_con_iva: precioConIva };
  });

  if (loading) {
    return (
      <>
        <PageHeader title="Lista de Precios" description="Precios por cliente con markup dinámico." />
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Lista de Precios" description="Precios por cliente con markup dinámico." />

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Actualización de Precios por Excel</CardTitle>
            <CardDescription>
              Sube un archivo con columnas "Núm. Artículo" y "Mostrador" para actualizar precio base en lote.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-end gap-4">
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="pricing-file">Archivo de precios</Label>
              <Input id="pricing-file" type="file" accept=".xlsx,.xls,.csv" ref={priceFileRef} />
            </div>
            <Button onClick={handlePriceUpload} disabled={priceUploadLoading}>
              {priceUploadLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {priceUploadLoading ? "Actualizando..." : "Actualizar precios"}
            </Button>
          </CardContent>
        </Card>

        {/* Clientes Management */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Clientes</CardTitle>
              <CardDescription>{clientes.length} clientes registrados</CardDescription>
            </div>
            <Button size="sm" onClick={openNewCliente}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo Cliente
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="text-right">Markup %</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientes.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nombre}</TableCell>
                      <TableCell className="text-right">{c.porcentaje_markup}%</TableCell>
                      <TableCell>{c.contacto}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditCliente(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteCliente(c)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Price List */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Precios — {clienteNombre}</CardTitle>
            {markup > 0 && (
              <CardDescription>Markup aplicado: +{markup}%</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-base">Simulador Comercial</CardTitle>
                <CardDescription>Simula margen y tipo de cambio para escenarios de venta.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3 items-end">
                <div className="grid gap-1.5">
                  <Label>Markup simulado %</Label>
                  <Input type="number" step="0.01" value={simMarkup} onChange={(e) => setSimMarkup(Number(e.target.value))} className="w-[160px]" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Tipo de cambio</Label>
                  <Input type="number" step="0.0001" value={simTipoCambio} onChange={(e) => setSimTipoCambio(Number(e.target.value))} className="w-[160px]" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Plantillas</Label>
                  <Select value={selectedTemplate} onValueChange={applyTemplate}>
                    <SelectTrigger className="w-[220px]"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin plantilla</SelectItem>
                      {templates.map((t) => <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Guardar plantilla</Label>
                  <div className="flex gap-2">
                    <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Nombre" className="w-[180px]" />
                    <Button variant="outline" onClick={saveTemplate}>Guardar</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-4 items-end">
              <div className="grid gap-1.5">
                <Label>Cliente</Label>
                <Select value={selectedCliente} onValueChange={setSelectedCliente}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Precio Base" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Precio Base</SelectItem>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.nombre} ({c.porcentaje_markup}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número o descripción..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchPrecios(selectedCliente)}
                />
              </div>
              <Button variant="outline" onClick={() => fetchPrecios(selectedCliente)}>
                <Search className="mr-2 h-4 w-4" /> Buscar
              </Button>
              <Button variant="outline" onClick={handleExport} disabled={precios.length === 0}>
                <Download className="mr-2 h-4 w-4" /> Exportar CSV
              </Button>
              <Button onClick={exportToQuotes} disabled={precios.length === 0}>Enviar a Cotizaciones</Button>
            </div>

            {loadingPrecios ? (
              <Skeleton className="h-64 w-full" />
            ) : preciosSimulados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <p className="text-lg font-medium">Sin artículos</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Núm. Parte</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Precio Base</TableHead>
                      <TableHead className="text-right">Markup %</TableHead>
                      <TableHead className="text-right">Precio Simulado</TableHead>
                      <TableHead className="text-right">Precio Sim + IVA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preciosSimulados.map((p, i) => (
                      <TableRow key={`${p.numero_articulo}-${i}`}>
                        <TableCell className="font-medium">{p.numero_articulo}</TableCell>
                        <TableCell>{p.descripcion}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.precio_base)}</TableCell>
                        <TableCell className="text-right">{p.sim_markup}%</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(p.sim_precio_cliente)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.sim_precio_con_iva)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cliente Create/Edit Dialog */}
      <Dialog open={showClienteDialog} onOpenChange={setShowClienteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editCliente ? "Editar Cliente" : "Nuevo Cliente"}</DialogTitle>
            <DialogDescription>
              {editCliente ? "Modifica los datos del cliente." : "Agrega un nuevo cliente con su porcentaje de markup."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Nombre</Label>
              <Input
                className="col-span-3"
                value={clienteForm.nombre}
                onChange={(e) => setClienteForm({ ...clienteForm, nombre: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Markup %</Label>
              <Input
                type="number"
                step="0.01"
                className="col-span-3"
                value={clienteForm.porcentaje_markup}
                onChange={(e) => setClienteForm({ ...clienteForm, porcentaje_markup: Number(e.target.value) })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Contacto</Label>
              <Input
                className="col-span-3"
                value={clienteForm.contacto}
                onChange={(e) => setClienteForm({ ...clienteForm, contacto: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Notas</Label>
              <Input
                className="col-span-3"
                value={clienteForm.notas}
                onChange={(e) => setClienteForm({ ...clienteForm, notas: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveCliente} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editCliente ? "Guardar Cambios" : "Crear Cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteCliente} onOpenChange={(open) => !open && setDeleteCliente(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {deleteCliente?.nombre}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esto eliminará permanentemente al cliente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCliente} disabled={deleting}>
              {deleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
