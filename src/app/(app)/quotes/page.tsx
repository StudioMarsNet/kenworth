"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, Trash2, FileText, Download, Eye, Upload, Users,
  Loader2, Package, DollarSign, Hash, Calendar, ChevronDown, ChevronRight, Pencil,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

const formatCurrency = (value: number, moneda = "MXN") =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: moneda === "USD" ? "USD" : "MXN" }).format(value);

const formatDate = (d: string) => {
  const date = new Date(d + "T12:00:00");
  return date.toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric" });
};

/* ─── Types ─── */
type Cotizacion = {
  id: number; folio: string; folio_sitic: string | null; no_docto: string | null;
  cliente_nombre: string; vendedor: string | null;
  subtotal: number; iva: number; total: number; moneda: string;
  estatus: string; created_at: string; fecha_consumo: string | null;
  num_items: number; vigencia: string | null;
};

type CotizacionDetail = Cotizacion & {
  notas: string | null;
  tipo_cambio: number;
  items: { id: number; numero_articulo: string; descripcion: string; cantidad: number; precio_unitario: number; descuento: number; importe: number }[];
};

type Cliente = { id: number; nombre: string };
type Personnel = { id: number | string; nombre: string; rol: string; source?: string };
type ItemLine = { numero_articulo: string; descripcion: string; cantidad: number; precio_unitario: number; descuento: number };

type ConsumoItem = {
  id: number; fecha: string; val_almacen: string; numero_articulo: string;
  descripcion: string; cantidad: number; precio_unitario: number; total: number; warehouse_name: string; sub_warehouse_name?: string | null; sub_warehouse_id?: number | null; uploaded_by: string;
};
type DailyTotal = { fecha: string; total_piezas: number; total_monto: number; articulos_distintos: number };
type Warehouse = { id: number; name: string };
type SubWarehouse = { id: number; nombre: string; parent_warehouse_name: string | null };
type ConsumoEditForm = {
  id: number;
  fecha: string;
  val_almacen: string;
  numero_articulo: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  warehouse_id: string;
  sub_warehouse_id: string;
  uploaded_by: string;
};

const estatusColor: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  borrador: "secondary", enviada: "outline", aceptada: "default", rechazada: "destructive", cancelada: "destructive",
};
const rolLabels: Record<string, string> = {
  vendedor: "Vendedor", almacenista: "Almacenista", gerente_almacen: "Gerente de Almacén", gerente_ventas: "Gerente de Ventas",
};

export default function CotizacionesPage() {
  /* ─── Quotes state ─── */
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [viewCot, setViewCot] = useState<CotizacionDetail | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [personnelOpen, setPersonnelOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editCot, setEditCot] = useState<CotizacionDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  /* ─── Consumo state ─── */
  const [consumoItems, setConsumoItems] = useState<ConsumoItem[]>([]);
  const [consumoTotals, setConsumoTotals] = useState<DailyTotal[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [subWarehouses, setSubWarehouses] = useState<SubWarehouse[]>([]);
  const [consumoLoading, setConsumoLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [syncingFile, setSyncingFile] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [fechaUpload, setFechaUpload] = useState(new Date().toISOString().split("T")[0]);
  const [uploadedById, setUploadedById] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [subWarehouseFilter, setSubWarehouseFilter] = useState("all");
  const [uploadSubWarehouseId, setUploadSubWarehouseId] = useState("none");
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [selectedConsumoIds, setSelectedConsumoIds] = useState<Set<number>>(new Set());
  const [deletingConsumoSelected, setDeletingConsumoSelected] = useState(false);
  const [deletingConsumoAll, setDeletingConsumoAll] = useState(false);
  const [editConsumoOpen, setEditConsumoOpen] = useState(false);
  const [savingConsumoEdit, setSavingConsumoEdit] = useState(false);
  const [editingConsumo, setEditingConsumo] = useState<ConsumoEditForm | null>(null);
  const unifiedFileRef = useRef<HTMLInputElement>(null);

  /* ─── Create form state ─── */
  const [clienteId, setClienteId] = useState<string>("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [vendedor, setVendedor] = useState("");
  const [moneda, setMoneda] = useState("MXN");
  const [tipoCambio, setTipoCambio] = useState("1");
  const [notas, setNotas] = useState("");
  const [vigencia, setVigencia] = useState("");
  const [folioSitic, setFolioSitic] = useState("");
  const [noDocto, setNoDocto] = useState("");
  const [fechaConsumo, setFechaConsumo] = useState("");
  const [items, setItems] = useState<ItemLine[]>([
    { numero_articulo: "", descripcion: "", cantidad: 1, precio_unitario: 0, descuento: 0 },
  ]);

  /* ─── Personnel / client management ─── */
  const [newPersonnelName, setNewPersonnelName] = useState("");
  const [newPersonnelRol, setNewPersonnelRol] = useState("vendedor");
  const [newClientName, setNewClientName] = useState("");
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<Set<number>>(new Set());

  /* ─── Fetchers ─── */
  const fetchCotizaciones = useCallback(async () => {
    try {
      const res = await fetch("/api/sales");
      const data = await res.json();
      if (data.success) {
        setCotizaciones(data.data);
        setSelectedQuoteIds(new Set());
      }
    } catch {} finally { setLoading(false); }
  }, []);

  const fetchClientes = useCallback(async () => {
    try {
      const res = await fetch("/api/clients");
      const data = await res.json();
      if (data.success) setClientes(data.data);
    } catch {}
  }, []);

  const fetchPersonnel = useCallback(async () => {
    try {
      const res = await fetch("/api/personnel");
      const data = await res.json();
      if (data.success) setPersonnel(data.data);
    } catch {}
  }, []);

  const fetchConsumo = useCallback(async () => {
    setConsumoLoading(true);
    try {
      const params = new URLSearchParams();
      if (fechaInicio) params.set("fecha_inicio", fechaInicio);
      if (fechaFin) params.set("fecha_fin", fechaFin);
      if (warehouseFilter && warehouseFilter !== "all") params.set("warehouse_id", warehouseFilter);
      if (subWarehouseFilter && subWarehouseFilter !== "all") params.set("sub_warehouse_id", subWarehouseFilter);

      const [consumoRes, whRes, swRes] = await Promise.all([
        fetch(`/api/consumption?${params.toString()}`),
        fetch("/api/warehouses"),
        fetch("/api/subalmacenes"),
      ]);
      const consumoData = await consumoRes.json();
      const whData = await whRes.json();
      const swData = await swRes.json();

      if (consumoData.success) {
        setConsumoItems(consumoData.data);
        setConsumoTotals(consumoData.totals);
        setSelectedConsumoIds(new Set());
      }
      if (whData.success) setWarehouses(whData.data);
      if (swData.success) setSubWarehouses(swData.data);
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Error al cargar consumo" });
    } finally { setConsumoLoading(false); }
  }, [fechaInicio, fechaFin, warehouseFilter, subWarehouseFilter, toast]);

  useEffect(() => { fetchCotizaciones(); fetchClientes(); fetchPersonnel(); fetchConsumo(); }, [fetchCotizaciones, fetchClientes, fetchPersonnel, fetchConsumo]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("pricing_quote_draft");
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (Array.isArray(draft?.items) && draft.items.length > 0) {
        setClienteNombre(draft.cliente_nombre || "Cliente Simulado");
        setMoneda(draft.moneda || "MXN");
        setTipoCambio(String(draft.tipo_cambio || 1));
        setItems(
          draft.items.map((it: any) => ({
            numero_articulo: String(it.numero_articulo || ""),
            descripcion: String(it.descripcion || ""),
            cantidad: Number(it.cantidad || 1),
            precio_unitario: Number(it.precio_unitario || 0),
            descuento: Number(it.descuento || 0),
          }))
        );
        setCreateOpen(true);
      }
      localStorage.removeItem("pricing_quote_draft");
    } catch {}
  }, []);

  /* ─── Consumo upload ─── */
  const handleConsumoUpload = async (file: File, uploadedBy: string) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("fecha", fechaUpload);
      form.append("uploaded_by", uploadedBy);
      if (uploadSubWarehouseId && uploadSubWarehouseId !== "none") {
        form.append("sub_warehouse_id", uploadSubWarehouseId);
      }

      const res = await fetch("/api/consumption/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "No se pudo registrar consumo");
      }
      return data;
    } finally {
      setUploading(false);
    }
  };

  const toggleDay = (fecha: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(fecha)) next.delete(fecha);
      else next.add(fecha);
      return next;
    });
  };

  /* ─── Client / Personnel inline management ─── */
  const handleAddClient = async () => {
    if (!newClientName.trim()) return;
    try {
      const res = await fetch("/api/clients", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: newClientName.trim(), porcentaje_markup: 0 }),
      });
      const data = await res.json();
      if (data.success) { toast({ title: "Cliente registrado" }); setNewClientName(""); fetchClientes(); }
    } catch {}
  };

  const handleAddPersonnel = async () => {
    if (!newPersonnelName.trim()) return;
    try {
      const res = await fetch("/api/personnel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: newPersonnelName.trim(), rol: newPersonnelRol }),
      });
      const data = await res.json();
      if (data.success) { toast({ title: "Personal registrado" }); setNewPersonnelName(""); fetchPersonnel(); }
    } catch {}
  };

  const handleDeletePersonnel = async (id: number) => {
    try { await fetch(`/api/personnel/${id}`, { method: "DELETE" }); fetchPersonnel(); } catch {}
  };

  /* ─── Items helpers ─── */
  const addItem = () => setItems([...items, { numero_articulo: "", descripcion: "", cantidad: 1, precio_unitario: 0, descuento: 0 }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof ItemLine, value: string | number) => {
    const copy = [...items]; (copy[idx] as any)[field] = value; setItems(copy);
  };

  const excelRef = useRef<HTMLInputElement>(null);
  const parseItemsFromFile = async (file: File): Promise<ItemLine[]> => {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    if (rows.length === 0) {
      throw new Error("Archivo vacío");
    }

    const COL_MAP: Record<string, string> = {
      artículo: "numero_articulo",
      articulo: "numero_articulo",
      "número de parte": "numero_articulo",
      descripción: "descripcion",
      descripcion: "descripcion",
      cantidad: "cantidad",
      cant: "cantidad",
      precio: "precio_unitario",
      "precio unitario": "precio_unitario",
      descuento: "descuento",
      desc: "descuento",
    };

    const colMap: Record<string, string> = {};
    for (const h of Object.keys(rows[0])) {
      const k = h.toLowerCase().trim();
      if (COL_MAP[k]) colMap[h] = COL_MAP[k];
    }

    const parsed: ItemLine[] = [];
    for (const raw of rows) {
      const mapped: Record<string, any> = {};
      for (const [orig, val] of Object.entries(raw)) {
        const m = colMap[orig];
        if (m) mapped[m] = val;
      }
      const art = String(mapped.numero_articulo || "").trim();
      const desc = String(mapped.descripcion || "").trim();
      const cant = parseInt(mapped.cantidad) || 0;
      let precio = 0;
      if (typeof mapped.precio_unitario === "number") precio = mapped.precio_unitario;
      else if (typeof mapped.precio_unitario === "string") precio = parseFloat(mapped.precio_unitario.replace(/[$,]/g, "")) || 0;
      const descuento = parseFloat(mapped.descuento) || 0;
      if (art && cant > 0) {
        parsed.push({ numero_articulo: art, descripcion: desc, cantidad: cant, precio_unitario: precio, descuento });
      }
    }

    if (parsed.length === 0) {
      throw new Error("No se encontraron artículos válidos.");
    }
    return parsed;
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    parseItemsFromFile(file)
      .then((parsed) => {
        setItems(parsed);
        toast({ title: "Artículos importados", description: `${parsed.length} artículos cargados del Excel.` });
      })
      .catch((err: any) => {
        toast({ title: "Error al leer archivo", description: err.message, variant: "destructive" });
      });
    e.target.value = "";
  };

  const handleUnifiedUpload = async () => {
    const file = unifiedFileRef.current?.files?.[0];
    if (!file) {
      toast({ variant: "destructive", title: "Error", description: "Selecciona un archivo primero" });
      return;
    }
    if (!uploadedById) {
      toast({ variant: "destructive", title: "Error", description: "Selecciona el personal que sube el archivo" });
      return;
    }

    const uploader = personnel.find((p) => String(p.id) === uploadedById && (p.rol === "almacenista" || p.rol === "gerente_almacen" || p.rol === "vendedor"));
    if (!uploader) {
      toast({ variant: "destructive", title: "Error", description: "El personal seleccionado no tiene rol permitido para carga" });
      return;
    }

    setSyncingFile(true);
    try {
      const parsedItems = await parseItemsFromFile(file);
      setItems(parsedItems);
      setFechaConsumo(fechaUpload);

      const consumoData = await handleConsumoUpload(file, uploader.nombre);
      fetchConsumo();
      setCreateOpen(true);

      toast({
        title: "Archivo procesado",
        description: `${consumoData.data.processed} registros en consumo y ${parsedItems.length} artículos cargados para cotización.`,
      });

      if (unifiedFileRef.current) unifiedFileRef.current.value = "";
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "No se pudo procesar el archivo" });
    } finally {
      setSyncingFile(false);
    }
  };

  const subtotal = items.reduce((sum, it) => sum + it.cantidad * it.precio_unitario * (1 - it.descuento / 100), 0);
  const iva = subtotal * 0.16;
  const total = subtotal + iva;

  const resetForm = () => {
    setClienteId(""); setClienteNombre(""); setVendedor(""); setMoneda("MXN");
    setTipoCambio("1"); setNotas(""); setVigencia(""); setFolioSitic(""); setNoDocto(""); setFechaConsumo("");
    setItems([{ numero_articulo: "", descripcion: "", cantidad: 1, precio_unitario: 0, descuento: 0 }]);
  };

  /* ─── Quote CRUD ─── */
  const handleCreate = async () => {
    if (!clienteNombre.trim()) { toast({ title: "Error", description: "Nombre del cliente requerido", variant: "destructive" }); return; }
    if (!/^\d{7}$/.test(folioSitic.trim())) { toast({ title: "Error", description: "Folio SITIC debe tener exactamente 7 dígitos", variant: "destructive" }); return; }
    if (!/^\d{4}$/.test(noDocto.trim())) { toast({ title: "Error", description: "No. Docto debe tener exactamente 4 dígitos", variant: "destructive" }); return; }
    if (items.some(it => !it.numero_articulo || !it.descripcion)) { toast({ title: "Error", description: "Todos los artículos requieren número y descripción", variant: "destructive" }); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: clienteId ? Number(clienteId) : null,
          cliente_nombre: clienteNombre,
          vendedor, moneda,
          tipo_cambio: Number(tipoCambio) || 1,
          notas, vigencia: vigencia || undefined,
          folio_sitic: folioSitic.trim(),
          no_docto: noDocto.trim(),
          fecha_consumo: fechaConsumo || undefined,
          items: items.map(it => ({ ...it, cantidad: Number(it.cantidad), precio_unitario: Number(it.precio_unitario), descuento: Number(it.descuento) })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Cotización creada", description: `Folio: ${data.data.folio}` });
        setCreateOpen(false); resetForm(); fetchCotizaciones();
      } else {
        toast({ title: "Error", description: JSON.stringify(data.error), variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setCreating(false); }
  };

  const handleView = async (id: number) => {
    try {
      const res = await fetch(`/api/sales/${id}`);
      const data = await res.json();
      if (data.success) { setViewCot(data.data); setViewOpen(true); }
    } catch {}
  };

  /* ─── Edit quote ─── */
  const [editFolioSitic, setEditFolioSitic] = useState("");
  const [editNoDocto, setEditNoDocto] = useState("");
  const [editClienteNombre, setEditClienteNombre] = useState("");
  const [editClienteId, setEditClienteId] = useState("");
  const [editVendedor, setEditVendedor] = useState("");
  const [editMoneda, setEditMoneda] = useState("MXN");
  const [editTipoCambio, setEditTipoCambio] = useState("1");
  const [editNotas, setEditNotas] = useState("");
  const [editVigencia, setEditVigencia] = useState("");
  const [editFechaConsumo, setEditFechaConsumo] = useState("");
  const [editItems, setEditItems] = useState<ItemLine[]>([]);

  const handleEdit = async (id: number) => {
    try {
      const res = await fetch(`/api/sales/${id}`);
      const data = await res.json();
      if (data.success) {
        const c = data.data as CotizacionDetail;
        setEditCot(c);
        setEditFolioSitic(c.folio_sitic || "");
        setEditNoDocto(c.no_docto || "");
        setEditClienteNombre(c.cliente_nombre || "");
        setEditClienteId("");
        setEditVendedor(c.vendedor || "");
        setEditMoneda(c.moneda || "MXN");
        setEditTipoCambio(String(c.tipo_cambio || 1));
        setEditNotas(c.notas || "");
        setEditVigencia(c.vigencia ? String(c.vigencia).split("T")[0] : "");
        setEditFechaConsumo(c.fecha_consumo ? String(c.fecha_consumo).split("T")[0] : "");
        setEditItems(c.items.map(it => ({
          numero_articulo: it.numero_articulo,
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          precio_unitario: it.precio_unitario,
          descuento: it.descuento,
        })));
        setEditOpen(true);
      }
    } catch {}
  };

  const editSubtotal = editItems.reduce((sum, it) => sum + it.cantidad * it.precio_unitario * (1 - it.descuento / 100), 0);
  const editIva = editSubtotal * 0.16;
  const editTotal = editSubtotal + editIva;

  const addEditItem = () => setEditItems([...editItems, { numero_articulo: "", descripcion: "", cantidad: 1, precio_unitario: 0, descuento: 0 }]);
  const removeEditItem = (idx: number) => setEditItems(editItems.filter((_, i) => i !== idx));
  const updateEditItem = (idx: number, field: keyof ItemLine, value: string | number) => {
    const copy = [...editItems]; (copy[idx] as any)[field] = value; setEditItems(copy);
  };

  const editExcelRef = useRef<HTMLInputElement>(null);
  const handleEditExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    parseItemsFromFile(file)
      .then((parsed) => {
        setEditItems(parsed);
        toast({ title: "Artículos importados", description: `${parsed.length} artículos cargados.` });
      })
      .catch((err: any) => {
        toast({ title: "Error al leer archivo", description: err.message, variant: "destructive" });
      });
    e.target.value = "";
  };

  const handleSaveEdit = async () => {
    if (!editCot) return;
    if (!editClienteNombre.trim()) { toast({ title: "Error", description: "Nombre del cliente requerido", variant: "destructive" }); return; }
    if (editFolioSitic && !/^\d{7}$/.test(editFolioSitic.trim())) { toast({ title: "Error", description: "Folio SITIC debe tener 7 dígitos", variant: "destructive" }); return; }
    if (editNoDocto && !/^\d{4}$/.test(editNoDocto.trim())) { toast({ title: "Error", description: "No. Docto debe tener 4 dígitos", variant: "destructive" }); return; }
    if (editItems.some(it => !it.numero_articulo || !it.descripcion)) { toast({ title: "Error", description: "Todos los artículos requieren número y descripción", variant: "destructive" }); return; }
    if (editItems.length === 0) { toast({ title: "Error", description: "Agrega al menos un artículo", variant: "destructive" }); return; }

    setSaving(true);
    try {
      const res = await fetch(`/api/sales/${editCot.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_nombre: editClienteNombre,
          cliente_id: editClienteId ? Number(editClienteId) : null,
          vendedor: editVendedor,
          moneda: editMoneda,
          tipo_cambio: Number(editTipoCambio) || 1,
          notas: editNotas,
          vigencia: editVigencia || undefined,
          folio_sitic: editFolioSitic.trim() || undefined,
          no_docto: editNoDocto.trim() || undefined,
          fecha_consumo: editFechaConsumo || undefined,
          items: editItems.map(it => ({ ...it, cantidad: Number(it.cantidad), precio_unitario: Number(it.precio_unitario), descuento: Number(it.descuento) })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Cotización actualizada" });
        setEditOpen(false);
        setEditCot(null);
        fetchCotizaciones();
      } else {
        toast({ title: "Error", description: JSON.stringify(data.error), variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleUpdateEstatus = async (id: number, estatus: string) => {
    try {
      await fetch(`/api/sales/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estatus }),
      });
      fetchCotizaciones();
      if (viewCot?.id === id) handleView(id);
    } catch {}
  };

  const toggleQuoteSelection = (id: number, checked: boolean) => {
    setSelectedQuoteIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedQuoteIds);
    if (ids.length === 0) {
      toast({ variant: "destructive", title: "Error", description: "Selecciona al menos una cotización" });
      return;
    }
    if (!window.confirm(`Se eliminarán ${ids.length} cotizaciones. ¿Deseas continuar?`)) return;

    setDeletingSelected(true);
    try {
      const res = await fetch("/api/sales", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "No se pudieron borrar las cotizaciones seleccionadas");
      toast({ title: "Cotizaciones eliminadas", description: `${data.data?.deleted || ids.length} registros borrados.` });
      fetchCotizaciones();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "No se pudo completar la acción" });
    } finally {
      setDeletingSelected(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm("Se eliminarán TODAS las cotizaciones. Esta acción no se puede deshacer. ¿Continuar?")) return;

    setDeletingAll(true);
    try {
      const res = await fetch("/api/sales", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "all" }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "No se pudieron borrar todas las cotizaciones");
      toast({ title: "Borrado total completado", description: `${data.data?.deleted || 0} cotizaciones eliminadas.` });
      fetchCotizaciones();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "No se pudo completar la acción" });
    } finally {
      setDeletingAll(false);
    }
  };

  const toggleConsumoSelection = (id: number, checked: boolean) => {
    setSelectedConsumoIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleDeleteConsumoSelected = async () => {
    const ids = Array.from(selectedConsumoIds);
    if (ids.length === 0) {
      toast({ variant: "destructive", title: "Error", description: "Selecciona al menos un registro de consumo" });
      return;
    }
    if (!window.confirm(`Se eliminarán ${ids.length} registros de consumo. ¿Continuar?`)) return;

    setDeletingConsumoSelected(true);
    try {
      const res = await fetch("/api/consumption", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "No se pudieron eliminar los registros de consumo");
      toast({ title: "Consumo eliminado", description: `${data.data?.deleted || ids.length} registros borrados.` });
      fetchConsumo();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "No se pudo completar la acción" });
    } finally {
      setDeletingConsumoSelected(false);
    }
  };

  const handleDeleteConsumoAll = async () => {
    const filterSummary = [
      fechaInicio ? `desde ${fechaInicio}` : "",
      fechaFin ? `hasta ${fechaFin}` : "",
      warehouseFilter !== "all" ? `almacén ${warehouseFilter}` : "",
      subWarehouseFilter !== "all" ? `sub-almacén ${subWarehouseFilter}` : "",
    ].filter(Boolean).join(", ");

    const message = filterSummary
      ? `Se eliminarán todos los consumos filtrados (${filterSummary}). ¿Continuar?`
      : "Se eliminarán TODOS los consumos. Esta acción no se puede deshacer. ¿Continuar?";

    if (!window.confirm(message)) return;

    setDeletingConsumoAll(true);
    try {
      const payload: Record<string, any> = {
        mode: "all",
        confirm_all: !fechaInicio && !fechaFin && warehouseFilter === "all",
      };
      if (fechaInicio) payload.fecha_inicio = fechaInicio;
      if (fechaFin) payload.fecha_fin = fechaFin;
      if (warehouseFilter !== "all") payload.warehouse_id = Number(warehouseFilter);
      if (subWarehouseFilter !== "all") payload.sub_warehouse_id = Number(subWarehouseFilter);

      const res = await fetch("/api/consumption", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "No se pudo eliminar el consumo");
      toast({ title: "Borrado de consumo completado", description: `${data.data?.deleted || 0} registros eliminados.` });
      fetchConsumo();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "No se pudo completar la acción" });
    } finally {
      setDeletingConsumoAll(false);
    }
  };

  const openEditConsumo = (item: ConsumoItem) => {
    setEditingConsumo({
      id: item.id,
      fecha: String(item.fecha).split("T")[0],
      val_almacen: item.val_almacen || "",
      numero_articulo: item.numero_articulo || "",
      descripcion: item.descripcion || "",
      cantidad: Number(item.cantidad || 0),
      precio_unitario: Number(item.precio_unitario || 0),
      warehouse_id: item.warehouse_name
        ? String(warehouses.find((w) => w.name === item.warehouse_name)?.id || "")
        : "",
      sub_warehouse_id: item.sub_warehouse_id ? String(item.sub_warehouse_id) : "",
      uploaded_by: item.uploaded_by || "",
    });
    setEditConsumoOpen(true);
  };

  const handleSaveConsumoEdit = async () => {
    if (!editingConsumo) return;
    if (!editingConsumo.fecha || !editingConsumo.numero_articulo.trim() || editingConsumo.cantidad <= 0 || editingConsumo.precio_unitario < 0 || !editingConsumo.uploaded_by.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Completa los campos requeridos del consumo" });
      return;
    }

    setSavingConsumoEdit(true);
    try {
      const res = await fetch(`/api/consumption/${editingConsumo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha: editingConsumo.fecha,
          val_almacen: editingConsumo.val_almacen,
          numero_articulo: editingConsumo.numero_articulo,
          descripcion: editingConsumo.descripcion,
          cantidad: Number(editingConsumo.cantidad),
          precio_unitario: Number(editingConsumo.precio_unitario),
          warehouse_id: editingConsumo.warehouse_id ? Number(editingConsumo.warehouse_id) : null,
          sub_warehouse_id: editingConsumo.sub_warehouse_id ? Number(editingConsumo.sub_warehouse_id) : null,
          uploaded_by: editingConsumo.uploaded_by,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "No se pudo actualizar consumo");
      toast({ title: "Consumo actualizado" });
      setEditConsumoOpen(false);
      setEditingConsumo(null);
      fetchConsumo();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "No se pudo actualizar consumo" });
    } finally {
      setSavingConsumoEdit(false);
    }
  };

  const allowedUploadPersonnel = personnel.filter((p) => p.rol === "almacenista" || p.rol === "gerente_almacen" || p.rol === "vendedor");
  const allSelected = cotizaciones.length > 0 && selectedQuoteIds.size === cotizaciones.length;
  const allConsumoSelected = consumoItems.length > 0 && selectedConsumoIds.size === consumoItems.length;

  const printCotizacion = () => {
    if (!viewCot) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Cotización ${viewCot.folio}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
      .header { display: flex; justify-content: space-between; align-items: start; border-bottom: 3px solid #D71921; padding-bottom: 20px; margin-bottom: 20px; }
      .logo-area { font-size: 28px; font-weight: bold; color: #D71921; }
      .logo-sub { font-size: 12px; color: #032773; }
      .folio-area { text-align: right; }
      .folio { font-size: 20px; font-weight: bold; color: #032773; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
      .info-box { background: #f9f9f9; padding: 15px; border-radius: 4px; }
      .info-label { font-size: 11px; color: #666; text-transform: uppercase; margin-bottom: 4px; }
      .info-value { font-size: 14px; font-weight: 500; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      th { background: #032773; color: white; padding: 10px; text-align: left; font-size: 12px; }
      td { padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 13px; }
      .text-right { text-align: right; }
      .totals { float: right; width: 300px; }
      .totals-row { display: flex; justify-content: space-between; padding: 6px 0; }
      .totals-row.total { font-size: 18px; font-weight: bold; border-top: 2px solid #D71921; padding-top: 10px; color: #D71921; }
      .footer { margin-top: 60px; border-top: 1px solid #ddd; padding-top: 15px; font-size: 11px; color: #888; text-align: center; }
      .notas { margin-top: 20px; padding: 15px; background: #fff9e6; border-left: 4px solid #D71921; font-size: 13px; }
      @media print { body { margin: 20px; } }
    </style></head><body>
    <div class="header">
      <div>
        <div class="logo-area">KENWORTH</div>
        <div class="logo-sub">Sistema de Inventario KW</div>
      </div>
      <div class="folio-area">
        <div class="folio">${viewCot.folio}</div>
        <div style="font-size:12px;color:#666">Cotización</div>
        ${viewCot.folio_sitic ? `<div style="font-size:12px;color:#666">SITIC: ${viewCot.folio_sitic}</div>` : ""}
        ${viewCot.no_docto ? `<div style="font-size:12px;color:#666">No. Docto: ${viewCot.no_docto}</div>` : ""}
        <div style="font-size:12px;color:#666">Fecha: ${new Date(viewCot.created_at).toLocaleDateString("es-MX")}</div>
        ${viewCot.fecha_consumo ? `<div style="font-size:12px;color:#666">Consumo: ${new Date(viewCot.fecha_consumo).toLocaleDateString("es-MX")}</div>` : ""}
        ${viewCot.vigencia ? `<div style="font-size:12px;color:#666">Vigencia: ${new Date(viewCot.vigencia).toLocaleDateString("es-MX")}</div>` : ""}
      </div>
    </div>
    <div class="info-grid">
      <div class="info-box"><div class="info-label">Cliente</div><div class="info-value">${viewCot.cliente_nombre}</div></div>
      <div class="info-box"><div class="info-label">Vendedor</div><div class="info-value">${viewCot.vendedor || "—"}</div></div>
      <div class="info-box"><div class="info-label">Moneda</div><div class="info-value">${viewCot.moneda} ${viewCot.tipo_cambio > 1 ? `(T.C. $${viewCot.tipo_cambio})` : ""}</div></div>
      <div class="info-box"><div class="info-label">Estatus</div><div class="info-value">${viewCot.estatus.toUpperCase()}</div></div>
    </div>
    <table>
      <thead><tr><th>#</th><th>Núm. Artículo</th><th>Descripción</th><th class="text-right">Cant.</th><th class="text-right">P. Unit.</th><th class="text-right">Desc.</th><th class="text-right">Importe</th></tr></thead>
      <tbody>
        ${viewCot.items.map((it, i) => `<tr><td>${i + 1}</td><td>${it.numero_articulo}</td><td>${it.descripcion}</td><td class="text-right">${it.cantidad}</td><td class="text-right">${formatCurrency(it.precio_unitario, viewCot!.moneda)}</td><td class="text-right">${it.descuento}%</td><td class="text-right">${formatCurrency(it.importe, viewCot!.moneda)}</td></tr>`).join("")}
      </tbody>
    </table>
    <div class="totals">
      <div class="totals-row"><span>Subtotal</span><span>${formatCurrency(viewCot.subtotal, viewCot.moneda)}</span></div>
      <div class="totals-row"><span>IVA (16%)</span><span>${formatCurrency(viewCot.iva, viewCot.moneda)}</span></div>
      <div class="totals-row total"><span>Total</span><span>${formatCurrency(viewCot.total, viewCot.moneda)}</span></div>
    </div>
    <div style="clear:both"></div>
    ${viewCot.notas ? `<div class="notas"><strong>Notas:</strong> ${viewCot.notas}</div>` : ""}
    <div class="footer">KENWORTH — Sistema de Inventario KW &bull; Cotización generada el ${new Date().toLocaleDateString("es-MX")}</div>
    </body></html>`);
    w.document.close();
    w.print();
  };

  /* ─── Consumo computed ─── */
  const today = new Date().toISOString().split("T")[0];
  const todaySummary = consumoTotals.find((t) => t.fecha?.toString().startsWith(today));

  /* ════════════════════════════ RENDER ════════════════════════════ */
  return (
    <>
      <PageHeader title="Cotizaciones y Consumo" description="Gestión unificada de cotizaciones de venta y consumo diario." />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Flujo Unico: Un archivo para todo</CardTitle>
            <CardDescription>
              Carga una sola vez el archivo SITIC: se registra en consumo y se precargan los articulos para la cotizacion.
              <br /><span className="text-xs">Si tu Excel tiene columna <strong>Fecha</strong>, cada fila usará su propia fecha. Si no, se usa la fecha seleccionada abajo.</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-end gap-4">
            <div className="grid w-full max-w-[200px] items-center gap-1.5">
              <Label htmlFor="fecha-flujo-unico">Fecha (respaldo)</Label>
              <Input id="fecha-flujo-unico" type="date" value={fechaUpload} onChange={(e) => setFechaUpload(e.target.value)} />
            </div>
            <div className="grid w-full max-w-[280px] items-center gap-1.5">
              <Label>Personal que sube (obligatorio)</Label>
              <Select value={uploadedById} onValueChange={setUploadedById}>
                <SelectTrigger><SelectValue placeholder="Seleccionar personal..." /></SelectTrigger>
                <SelectContent>
                  {allowedUploadPersonnel.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.nombre} ({rolLabels[p.rol]})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid w-full max-w-[280px] items-center gap-1.5">
              <Label>Sub-Almacén (opcional)</Label>
              <Select value={uploadSubWarehouseId} onValueChange={setUploadSubWarehouseId}>
                <SelectTrigger><SelectValue placeholder="Sin sub-almacén" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin sub-almacén</SelectItem>
                  {subWarehouses.map((sw) => (
                    <SelectItem key={sw.id} value={String(sw.id)}>{sw.nombre}{sw.parent_warehouse_name ? ` (${sw.parent_warehouse_name})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="archivo-flujo-unico">Archivo</Label>
              <Input id="archivo-flujo-unico" type="file" accept=".xlsx,.xls,.csv" ref={unifiedFileRef} />
            </div>
            <Button onClick={handleUnifiedUpload} disabled={syncingFile || uploading}>
              {(syncingFile || uploading) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {(syncingFile || uploading) ? "Subiendo..." : "Subir Archivo"}
            </Button>
          </CardContent>
        </Card>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{cotizaciones.length} cotizaciones</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleDeleteSelected} disabled={deletingSelected || selectedQuoteIds.size === 0}>
                {deletingSelected ? "Borrando..." : "Borrar Seleccionadas"}
              </Button>
              <Button variant="destructive" onClick={handleDeleteAll} disabled={deletingAll || cotizaciones.length === 0}>
                {deletingAll ? "Borrando..." : "Borrar Todo"}
              </Button>
              {/* Personnel Dialog */}
              <Dialog open={personnelOpen} onOpenChange={setPersonnelOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline"><Users className="mr-2 h-4 w-4" /> Personal</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Personal (Vendedores, Almacenistas, Gerentes)</DialogTitle>
                    <DialogDescription>Registra personal para seleccionarlo en cotizaciones.</DialogDescription>
                  </DialogHeader>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label>Nombre</Label>
                      <Input value={newPersonnelName} onChange={(e) => setNewPersonnelName(e.target.value)} placeholder="Nombre completo" />
                    </div>
                    <div className="w-48">
                      <Label>Rol</Label>
                      <Select value={newPersonnelRol} onValueChange={setNewPersonnelRol}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vendedor">Vendedor</SelectItem>
                          <SelectItem value="almacenista">Almacenista</SelectItem>
                          <SelectItem value="gerente_almacen">Gerente de Almacén</SelectItem>
                          <SelectItem value="gerente_ventas">Gerente de Ventas</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleAddPersonnel} className="shrink-0">Agregar</Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {personnel.length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">Sin personal registrado</TableCell></TableRow>
                      ) : personnel.map(p => (
                        <TableRow key={p.id}>
                          <TableCell>{p.nombre}</TableCell>
                          <TableCell><Badge variant="secondary">{rolLabels[p.rol] || p.rol}</Badge></TableCell>
                          <TableCell className="text-right">
                            {p.source !== 'user' && (
                              <Button variant="ghost" size="icon" onClick={() => handleDeletePersonnel(Number(p.id))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </DialogContent>
              </Dialog>

              {/* Create Dialog */}
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" /> Nueva Cotización</Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Nueva Cotización</DialogTitle>
                    <DialogDescription>Complete los datos del cliente y los artículos.</DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <Label>Folio SITIC (7 dígitos)</Label>
                      <Input
                        value={folioSitic}
                        onChange={(e) => setFolioSitic(e.target.value.replace(/\D/g, "").slice(0, 7))}
                        placeholder="Ej. 3639550"
                        maxLength={7}
                        inputMode="numeric"
                      />
                    </div>
                    <div>
                      <Label>No. Docto. (4 dígitos)</Label>
                      <Input
                        value={noDocto}
                        onChange={(e) => setNoDocto(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        placeholder="Ej. 4644"
                        maxLength={4}
                        inputMode="numeric"
                      />
                    </div>
                    <div>
                      <Label>Fecha de Consumo</Label>
                      <Input type="date" value={fechaConsumo} onChange={(e) => setFechaConsumo(e.target.value)} />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>Cliente</Label>
                      <Select value={clienteId} onValueChange={(v) => {
                        setClienteId(v);
                        const c = clientes.find(cl => String(cl.id) === v);
                        if (c) setClienteNombre(c.nombre);
                      }}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar cliente..." /></SelectTrigger>
                        <SelectContent>
                          {clientes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2 mt-1">
                        <Input value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="Nuevo cliente..." className="text-xs h-8" />
                        <Button variant="outline" size="sm" className="h-8 text-xs shrink-0" onClick={handleAddClient}>+ Agregar</Button>
                      </div>
                    </div>
                    <div>
                      <Label>Nombre del Cliente</Label>
                      <Input value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} placeholder="Nombre..." />
                    </div>
                    <div>
                      <Label>Vendedor</Label>
                      <Select value={vendedor} onValueChange={setVendedor}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar vendedor..." /></SelectTrigger>
                        <SelectContent>
                          {personnel.filter(p => p.rol === "vendedor").map(p => <SelectItem key={p.id} value={p.nombre}>{p.nombre}</SelectItem>)}
                          {personnel.filter(p => p.rol === "gerente_ventas").map(p => <SelectItem key={p.id} value={p.nombre}>{p.nombre} (Gte. Ventas)</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Moneda</Label>
                        <Select value={moneda} onValueChange={setMoneda}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MXN">MXN</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Tipo de Cambio</Label>
                        <Input type="number" value={tipoCambio} onChange={(e) => setTipoCambio(e.target.value)} min="0" step="0.01" />
                      </div>
                    </div>
                    <div>
                      <Label>Vigencia</Label>
                      <Input type="date" value={vigencia} onChange={(e) => setVigencia(e.target.value)} />
                    </div>
                    <div>
                      <Label>Notas</Label>
                      <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas opcionales..." rows={2} />
                    </div>
                  </div>

                  {/* Items */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-base font-semibold">Artículos</Label>
                      <div className="flex gap-2">
                        <input type="file" ref={excelRef} accept=".xlsx,.xls,.csv" onChange={handleExcelImport} className="hidden" />
                        <Button variant="outline" size="sm" onClick={() => excelRef.current?.click()}><Upload className="h-3 w-3 mr-1" /> Importar Excel</Button>
                        <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" /> Agregar</Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {items.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-2">
                            {idx === 0 && <Label className="text-xs">Núm. Artículo</Label>}
                            <Input value={item.numero_articulo} onChange={(e) => updateItem(idx, "numero_articulo", e.target.value)} placeholder="Artículo" />
                          </div>
                          <div className="col-span-4">
                            {idx === 0 && <Label className="text-xs">Descripción</Label>}
                            <Input value={item.descripcion} onChange={(e) => updateItem(idx, "descripcion", e.target.value)} placeholder="Descripción" />
                          </div>
                          <div className="col-span-1">
                            {idx === 0 && <Label className="text-xs">Cant.</Label>}
                            <Input type="number" value={item.cantidad} onChange={(e) => updateItem(idx, "cantidad", Number(e.target.value))} min="1" />
                          </div>
                          <div className="col-span-2">
                            {idx === 0 && <Label className="text-xs">P. Unitario</Label>}
                            <Input type="number" value={item.precio_unitario} onChange={(e) => updateItem(idx, "precio_unitario", Number(e.target.value))} min="0" step="0.01" />
                          </div>
                          <div className="col-span-1">
                            {idx === 0 && <Label className="text-xs">Desc.%</Label>}
                            <Input type="number" value={item.descuento} onChange={(e) => updateItem(idx, "descuento", Number(e.target.value))} min="0" max="100" />
                          </div>
                          <div className="col-span-1 text-right text-sm pt-1">
                            {formatCurrency(item.cantidad * item.precio_unitario * (1 - item.descuento / 100), moneda)}
                          </div>
                          <div className="col-span-1">
                            {items.length > 1 && (
                              <Button variant="ghost" size="icon" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex justify-end">
                      <div className="w-64 space-y-1 text-sm">
                        <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(subtotal, moneda)}</span></div>
                        <div className="flex justify-between"><span>IVA (16%):</span><span>{formatCurrency(iva, moneda)}</span></div>
                        <div className="flex justify-between font-bold text-base border-t pt-1"><span>Total:</span><span>{formatCurrency(total, moneda)}</span></div>
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                    <Button onClick={handleCreate} disabled={creating}>{creating ? "Guardando..." : "Crear Cotización"}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Quotes List */}
          {loading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={(checked) => {
                              if (checked) setSelectedQuoteIds(new Set(cotizaciones.map((q) => q.id)));
                              else setSelectedQuoteIds(new Set());
                            }}
                          />
                        </TableHead>
                        <TableHead>Folio</TableHead>
                        <TableHead>SITIC</TableHead>
                        <TableHead>No. Docto.</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Vendedor</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Moneda</TableHead>
                        <TableHead>Estatus</TableHead>
                        <TableHead>Fecha Registro</TableHead>
                        <TableHead>Fecha Consumo</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cotizaciones.length === 0 ? (
                        <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">No hay cotizaciones aún. Crea la primera.</TableCell></TableRow>
                      ) : cotizaciones.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedQuoteIds.has(c.id)}
                              onCheckedChange={(checked) => toggleQuoteSelection(c.id, checked === true)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{c.folio}</TableCell>
                          <TableCell>{c.folio_sitic || "—"}</TableCell>
                          <TableCell>{c.no_docto || "—"}</TableCell>
                          <TableCell>{c.cliente_nombre}</TableCell>
                          <TableCell>{c.vendedor || "—"}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(c.total, c.moneda)}</TableCell>
                          <TableCell>{c.moneda}</TableCell>
                          <TableCell>
                            <Badge variant={estatusColor[c.estatus] || "secondary"}>{c.estatus}</Badge>
                          </TableCell>
                          <TableCell>{new Date(c.created_at).toLocaleDateString("es-MX")}</TableCell>
                          <TableCell>{c.fecha_consumo ? new Date(c.fecha_consumo).toLocaleDateString("es-MX") : "—"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => handleView(c.id)} title="Ver"><Eye className="h-4 w-4" /></Button>
                              {c.estatus === "borrador" && (
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(c.id)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                              )}
                              {c.estatus === "borrador" && (
                                <Button variant="ghost" size="icon" onClick={() => handleUpdateEstatus(c.id, "enviada")} title="Marcar como enviada"><FileText className="h-4 w-4" /></Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={async () => {
                                  if (!window.confirm(`Se eliminará la cotización ${c.folio}. ¿Continuar?`)) return;
                                  try {
                                    const res = await fetch(`/api/sales/${c.id}`, { method: "DELETE" });
                                    const data = await res.json();
                                    if (!data.success) throw new Error(data.error || "No se pudo borrar la cotización");
                                    toast({ title: "Cotización eliminada" });
                                    fetchCotizaciones();
                                  } catch (err: any) {
                                    toast({ variant: "destructive", title: "Error", description: err.message || "No se pudo borrar la cotización" });
                                  }
                                }}
                                title="Borrar"
                              >
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
          )}

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Consumo Diario</h2>
              <p className="text-sm text-muted-foreground">Historial y filtros de consumo registrados con el flujo unico.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleDeleteConsumoSelected} disabled={deletingConsumoSelected || selectedConsumoIds.size === 0}>
                {deletingConsumoSelected ? "Borrando..." : "Borrar Consumo Seleccionado"}
              </Button>
              <Button variant="destructive" onClick={handleDeleteConsumoAll} disabled={deletingConsumoAll || consumoItems.length === 0}>
                {deletingConsumoAll ? "Borrando..." : "Borrar Consumo"}
              </Button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Piezas Hoy</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{todaySummary?.total_piezas || 0}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monto Hoy</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{formatCurrency(todaySummary?.total_monto || 0)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Artículos Distintos Hoy</CardTitle>
                <Hash className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{todaySummary?.articulos_distintos || 0}</div></CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-end">
            <div className="grid gap-1.5">
              <Label>Fecha Inicio</Label>
              <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="w-[180px]" />
            </div>
            <div className="grid gap-1.5">
              <Label>Fecha Fin</Label>
              <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="w-[180px]" />
            </div>
            <div className="grid gap-1.5">
              <Label>Almacén</Label>
              <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {warehouses.map((wh) => (
                    <SelectItem key={wh.id} value={String(wh.id)}>{wh.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Sub-Almacén</Label>
              <Select value={subWarehouseFilter} onValueChange={setSubWarehouseFilter}>
                <SelectTrigger className="w-[220px]"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {subWarehouses.map((sw) => (
                    <SelectItem key={sw.id} value={String(sw.id)}>{sw.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Consumo History */}
          {consumoLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : consumoTotals.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Calendar className="h-10 w-10 mb-3" />
                <p className="text-lg font-medium">Sin registros de consumo</p>
                <p className="text-sm">Sube un archivo Excel para comenzar.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {consumoTotals.map((day) => {
                const fechaStr = String(day.fecha).split("T")[0];
                const isExpanded = expandedDays.has(fechaStr);
                const dayItems = consumoItems.filter((it) => String(it.fecha).split("T")[0] === fechaStr);
                return (
                  <Card key={fechaStr}>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toggleDay(fechaStr)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <div>
                            <CardTitle className="text-base">{formatDate(fechaStr)}</CardTitle>
                            <CardDescription>{day.total_piezas} piezas · {day.articulos_distintos} artículos distintos</CardDescription>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">{formatCurrency(day.total_monto)}</p>
                        </div>
                      </div>
                    </CardHeader>
                    {isExpanded && (
                      <CardContent>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-10">
                                  <Checkbox
                                    checked={allConsumoSelected}
                                    onCheckedChange={(checked) => {
                                      if (checked) setSelectedConsumoIds(new Set(consumoItems.map((c) => c.id)));
                                      else setSelectedConsumoIds(new Set());
                                    }}
                                  />
                                </TableHead>
                                <TableHead>VAL</TableHead>
                                <TableHead>Sub-Almacén</TableHead>
                                <TableHead>Artículo</TableHead>
                                <TableHead>Descripción</TableHead>
                                <TableHead className="text-right">Cantidad</TableHead>
                                <TableHead className="text-right">Precio</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {dayItems.map((it) => (
                                <TableRow key={it.id}>
                                  <TableCell>
                                    <Checkbox
                                      checked={selectedConsumoIds.has(it.id)}
                                      onCheckedChange={(checked) => toggleConsumoSelection(it.id, checked === true)}
                                    />
                                  </TableCell>
                                  <TableCell>{it.val_almacen}</TableCell>
                                  <TableCell>{it.sub_warehouse_name || "—"}</TableCell>
                                  <TableCell className="font-medium">{it.numero_articulo}</TableCell>
                                  <TableCell>{it.descripcion}</TableCell>
                                  <TableCell className="text-right">{it.cantidad}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(it.precio_unitario)}</TableCell>
                                  <TableCell className="text-right font-medium">{formatCurrency(it.total)}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                      <Button variant="ghost" size="icon" onClick={() => openEditConsumo(it)} title="Editar consumo">
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={async () => {
                                          if (!window.confirm(`Se eliminará el registro de consumo #${it.id}. ¿Continuar?`)) return;
                                          try {
                                            const res = await fetch(`/api/consumption/${it.id}`, { method: "DELETE" });
                                            const data = await res.json();
                                            if (!data.success) throw new Error(data.error || "No se pudo borrar el consumo");
                                            toast({ title: "Registro de consumo eliminado" });
                                            fetchConsumo();
                                          } catch (err: any) {
                                            toast({ variant: "destructive", title: "Error", description: err.message || "No se pudo borrar el consumo" });
                                          }
                                        }}
                                        title="Borrar consumo"
                                      >
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
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Dialog open={editConsumoOpen} onOpenChange={setEditConsumoOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Registro de Consumo</DialogTitle>
            <DialogDescription>Actualiza los datos del registro seleccionado.</DialogDescription>
          </DialogHeader>
          {editingConsumo && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Fecha</Label>
                <Input type="date" value={editingConsumo.fecha} onChange={(e) => setEditingConsumo({ ...editingConsumo, fecha: e.target.value })} />
              </div>
              <div>
                <Label>VAL Almacén</Label>
                <Input value={editingConsumo.val_almacen} onChange={(e) => setEditingConsumo({ ...editingConsumo, val_almacen: e.target.value })} />
              </div>
              <div>
                <Label>Número de Artículo</Label>
                <Input value={editingConsumo.numero_articulo} onChange={(e) => setEditingConsumo({ ...editingConsumo, numero_articulo: e.target.value })} />
              </div>
              <div>
                <Label>Descripción</Label>
                <Input value={editingConsumo.descripcion} onChange={(e) => setEditingConsumo({ ...editingConsumo, descripcion: e.target.value })} />
              </div>
              <div>
                <Label>Cantidad</Label>
                <Input type="number" min="1" value={editingConsumo.cantidad} onChange={(e) => setEditingConsumo({ ...editingConsumo, cantidad: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Precio Unitario</Label>
                <Input type="number" min="0" step="0.01" value={editingConsumo.precio_unitario} onChange={(e) => setEditingConsumo({ ...editingConsumo, precio_unitario: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Almacén</Label>
                <Select value={editingConsumo.warehouse_id || "none"} onValueChange={(value) => setEditingConsumo({ ...editingConsumo, warehouse_id: value === "none" ? "" : value })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar almacén..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin almacén</SelectItem>
                    {warehouses.map((wh) => (
                      <SelectItem key={wh.id} value={String(wh.id)}>{wh.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sub-Almacén</Label>
                <Select value={editingConsumo.sub_warehouse_id || "none"} onValueChange={(value) => setEditingConsumo({ ...editingConsumo, sub_warehouse_id: value === "none" ? "" : value })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar sub-almacén..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin sub-almacén</SelectItem>
                    {subWarehouses.map((sw) => (
                      <SelectItem key={sw.id} value={String(sw.id)}>{sw.nombre}{sw.parent_warehouse_name ? ` (${sw.parent_warehouse_name})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Subido por</Label>
                <Select value={editingConsumo.uploaded_by || ""} onValueChange={(value) => setEditingConsumo({ ...editingConsumo, uploaded_by: value })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar personal..." /></SelectTrigger>
                  <SelectContent>
                    {allowedUploadPersonnel.map((p) => (
                      <SelectItem key={p.id} value={p.nombre}>{p.nombre} ({rolLabels[p.rol]})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditConsumoOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveConsumoEdit} disabled={savingConsumoEdit}>{savingConsumoEdit ? "Guardando..." : "Guardar Cambios"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════ EDIT DIALOG ═══════════ */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Cotización {editCot?.folio}</DialogTitle>
            <DialogDescription>Modifica los datos de la cotización en borrador.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>Folio SITIC (7 dígitos)</Label>
              <Input
                value={editFolioSitic}
                onChange={(e) => setEditFolioSitic(e.target.value.replace(/\D/g, "").slice(0, 7))}
                placeholder="Ej. 3639550"
                maxLength={7}
                inputMode="numeric"
              />
            </div>
            <div>
              <Label>No. Docto. (4 dígitos)</Label>
              <Input
                value={editNoDocto}
                onChange={(e) => setEditNoDocto(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="Ej. 4644"
                maxLength={4}
                inputMode="numeric"
              />
            </div>
            <div>
              <Label>Fecha de Consumo</Label>
              <Input type="date" value={editFechaConsumo} onChange={(e) => setEditFechaConsumo(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Cliente</Label>
              <Select value={editClienteId} onValueChange={(v) => {
                setEditClienteId(v);
                const c = clientes.find(cl => String(cl.id) === v);
                if (c) setEditClienteNombre(c.nombre);
              }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cliente..." /></SelectTrigger>
                <SelectContent>
                  {clientes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nombre del Cliente</Label>
              <Input value={editClienteNombre} onChange={(e) => setEditClienteNombre(e.target.value)} placeholder="Nombre..." />
            </div>
            <div>
              <Label>Vendedor</Label>
              <Select value={editVendedor} onValueChange={setEditVendedor}>
                <SelectTrigger><SelectValue placeholder="Seleccionar vendedor..." /></SelectTrigger>
                <SelectContent>
                  {personnel.filter(p => p.rol === "vendedor").map(p => <SelectItem key={p.id} value={p.nombre}>{p.nombre}</SelectItem>)}
                  {personnel.filter(p => p.rol === "gerente_ventas").map(p => <SelectItem key={p.id} value={p.nombre}>{p.nombre} (Gte. Ventas)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Moneda</Label>
                <Select value={editMoneda} onValueChange={setEditMoneda}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MXN">MXN</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de Cambio</Label>
                <Input type="number" value={editTipoCambio} onChange={(e) => setEditTipoCambio(e.target.value)} min="0" step="0.01" />
              </div>
            </div>
            <div>
              <Label>Vigencia</Label>
              <Input type="date" value={editVigencia} onChange={(e) => setEditVigencia(e.target.value)} />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea value={editNotas} onChange={(e) => setEditNotas(e.target.value)} placeholder="Notas opcionales..." rows={2} />
            </div>
          </div>

          {/* Items */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-semibold">Artículos</Label>
              <div className="flex gap-2">
                <input type="file" ref={editExcelRef} accept=".xlsx,.xls,.csv" onChange={handleEditExcelImport} className="hidden" />
                <Button variant="outline" size="sm" onClick={() => editExcelRef.current?.click()}><Upload className="h-3 w-3 mr-1" /> Importar Excel</Button>
                <Button variant="outline" size="sm" onClick={addEditItem}><Plus className="h-3 w-3 mr-1" /> Agregar</Button>
              </div>
            </div>
            <div className="space-y-2">
              {editItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-2">
                    {idx === 0 && <Label className="text-xs">Núm. Artículo</Label>}
                    <Input value={item.numero_articulo} onChange={(e) => updateEditItem(idx, "numero_articulo", e.target.value)} placeholder="Artículo" />
                  </div>
                  <div className="col-span-4">
                    {idx === 0 && <Label className="text-xs">Descripción</Label>}
                    <Input value={item.descripcion} onChange={(e) => updateEditItem(idx, "descripcion", e.target.value)} placeholder="Descripción" />
                  </div>
                  <div className="col-span-1">
                    {idx === 0 && <Label className="text-xs">Cant.</Label>}
                    <Input type="number" value={item.cantidad} onChange={(e) => updateEditItem(idx, "cantidad", Number(e.target.value))} min="1" />
                  </div>
                  <div className="col-span-2">
                    {idx === 0 && <Label className="text-xs">P. Unitario</Label>}
                    <Input type="number" value={item.precio_unitario} onChange={(e) => updateEditItem(idx, "precio_unitario", Number(e.target.value))} min="0" step="0.01" />
                  </div>
                  <div className="col-span-1">
                    {idx === 0 && <Label className="text-xs">Desc.%</Label>}
                    <Input type="number" value={item.descuento} onChange={(e) => updateEditItem(idx, "descuento", Number(e.target.value))} min="0" max="100" />
                  </div>
                  <div className="col-span-1 text-right text-sm pt-1">
                    {formatCurrency(item.cantidad * item.precio_unitario * (1 - item.descuento / 100), editMoneda)}
                  </div>
                  <div className="col-span-1">
                    {editItems.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeEditItem(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <div className="w-64 space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(editSubtotal, editMoneda)}</span></div>
                <div className="flex justify-between"><span>IVA (16%):</span><span>{formatCurrency(editIva, editMoneda)}</span></div>
                <div className="flex justify-between font-bold text-base border-t pt-1"><span>Total:</span><span>{formatCurrency(editTotal, editMoneda)}</span></div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>{saving ? "Guardando..." : "Guardar Cambios"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════ VIEW DIALOG ═══════════ */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {viewCot && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Cotización {viewCot.folio}
                  <Badge variant={estatusColor[viewCot.estatus] || "secondary"}>{viewCot.estatus}</Badge>
                </DialogTitle>
                <DialogDescription>
                  {viewCot.folio_sitic && <>SITIC: {viewCot.folio_sitic} | </>}
                  {viewCot.no_docto && <>Docto: {viewCot.no_docto} | </>}
                  Cliente: {viewCot.cliente_nombre} | Vendedor: {viewCot.vendedor || "—"} | Registro: {new Date(viewCot.created_at).toLocaleDateString("es-MX")}
                  {viewCot.fecha_consumo && <> | Consumo: {new Date(viewCot.fecha_consumo).toLocaleDateString("es-MX")}</>}
                </DialogDescription>
              </DialogHeader>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Artículo</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Cant.</TableHead>
                    <TableHead className="text-right">P. Unit.</TableHead>
                    <TableHead className="text-right">Desc.</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewCot.items.map((it, i) => (
                    <TableRow key={it.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-medium">{it.numero_articulo}</TableCell>
                      <TableCell>{it.descripcion}</TableCell>
                      <TableCell className="text-right">{it.cantidad}</TableCell>
                      <TableCell className="text-right">{formatCurrency(it.precio_unitario, viewCot!.moneda)}</TableCell>
                      <TableCell className="text-right">{it.descuento}%</TableCell>
                      <TableCell className="text-right">{formatCurrency(it.importe, viewCot!.moneda)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-end">
                <div className="w-64 space-y-1 text-sm">
                  <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(viewCot.subtotal, viewCot.moneda)}</span></div>
                  <div className="flex justify-between"><span>IVA (16%):</span><span>{formatCurrency(viewCot.iva, viewCot.moneda)}</span></div>
                  <div className="flex justify-between font-bold text-lg border-t pt-1"><span>Total:</span><span>{formatCurrency(viewCot.total, viewCot.moneda)}</span></div>
                </div>
              </div>

              {viewCot.notas && <p className="text-sm bg-muted p-3 rounded"><strong>Notas:</strong> {viewCot.notas}</p>}

              <DialogFooter className="flex gap-2">
                {viewCot.estatus === "borrador" && (
                  <Button variant="outline" onClick={() => { setViewOpen(false); handleEdit(viewCot.id); }}>
                    <Pencil className="mr-2 h-4 w-4" /> Editar
                  </Button>
                )}
                {viewCot.estatus === "borrador" && (
                  <Button variant="outline" onClick={() => handleUpdateEstatus(viewCot.id, "enviada")}>Marcar Enviada</Button>
                )}
                {viewCot.estatus === "enviada" && (
                  <>
                    <Button onClick={() => handleUpdateEstatus(viewCot.id, "aceptada")}>Aceptar</Button>
                    <Button variant="destructive" onClick={() => handleUpdateEstatus(viewCot.id, "rechazada")}>Rechazar</Button>
                  </>
                )}
                <Button variant="outline" onClick={printCotizacion}><Download className="mr-2 h-4 w-4" /> Imprimir / PDF</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
