"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Upload, Pencil, Trash2, Search, Loader2, RefreshCw, AlertTriangle, Lightbulb, Eraser, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
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

type InventoryItem = {
  id: number;
  numero_articulo: string;
  descripcion: string;
  ubicacion: string;
  stand: string;
  tipo_articulo: string;
  warehouse_id: number;
  warehouse_name: string;
  sucursal: string;
  existencia: number;
  precio_traxion: number;
  precio_bisonte: number;
  movement: "high" | "medium" | "low";
  consumo_promedio_diario?: number;
  consumo_mensual?: number;
  dias_cobertura?: number | string | null;
  riesgo_quiebre?: "alto" | "medio" | "sano";
};

type Warehouse = {
  id: number;
  name: string;
  item_count: number;
  total_value: number;
};

type SubInventoryItem = {
  sub_warehouse_id: number;
  sub_warehouse_name: string;
  parent_warehouse_name: string | null;
  numero_articulo: string;
  descripcion: string;
  existencia_sub: number;
  precio_traxion: number;
  dias_cobertura?: number | string | null;
  riesgo_quiebre?: "alto" | "medio" | "sano";
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);

const MovementBadge = ({ movement }: { movement: string }) => {
  const variant = { low: "destructive", medium: "secondary", high: "default" }[
    movement
  ] as "destructive" | "secondary" | "default";
  return <Badge variant={variant}>{movement}</Badge>;
};

const RiskBadge = ({ risk }: { risk?: string }) => {
  if (risk === "alto") return <Badge variant="destructive">Riesgo Alto</Badge>;
  if (risk === "medio") return <Badge variant="secondary">Riesgo Medio</Badge>;
  return <Badge variant="default">Sano</Badge>;
};

const formatCoverageDays = (value: number | string | null | undefined) => {
  if (value == null) return "-";
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toFixed(1) : "-";
};

function InventoryTable({
  items,
  onEdit,
  onDelete,
  onSuggest,
  sortField,
  sortDir,
  onSort,
}: {
  items: InventoryItem[];
  onEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
  onSuggest: (item: InventoryItem) => void;
  sortField: string;
  sortDir: string;
  onSort: (field: any) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Search className="h-10 w-10 mb-3" />
        <p className="text-lg font-medium">No se encontraron artículos</p>
        <p className="text-sm">Sube un archivo Excel para comenzar.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {([
              ["numero_articulo", "Núm. Parte", false],
              ["descripcion", "Descripción", false],
              ["ubicacion", "Ubicación", false],
              ["stand", "Stand", false],
              ["tipo_articulo", "Tipo Artículo", false],
              ["warehouse_name", "Almacén", false],
              ["sucursal", "Sucursal", false],
              ["existencia", "Exist. Actual", true],
              ["dias_cobertura", "Días Cobertura", true],
            ] as [string, string, boolean][]).map(([field, label, right]) => (
              <TableHead
                key={field}
                className={`cursor-pointer select-none hover:bg-muted/50 ${right ? "text-right" : ""}`}
                onClick={() => onSort(field)}
              >
                <span className={`inline-flex items-center gap-1 ${right ? "justify-end w-full" : ""}`}>
                  {label}
                  {sortField === field ? (
                    sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                  )}
                </span>
              </TableHead>
            ))}
            <TableHead>Riesgo</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.numero_articulo}</TableCell>
              <TableCell>{item.descripcion}</TableCell>
              <TableCell>{item.ubicacion}</TableCell>
              <TableCell>{item.stand}</TableCell>
              <TableCell>{item.tipo_articulo}</TableCell>
              <TableCell>{item.warehouse_name}</TableCell>
              <TableCell>{item.sucursal}</TableCell>
              <TableCell className="text-right">{item.existencia}</TableCell>
              <TableCell className="text-right">{formatCoverageDays(item.dias_cobertura)}</TableCell>
              <TableCell><RiskBadge risk={item.riesgo_quiebre} /></TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onSuggest(item)} title="Sugerencia de requisición">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(item)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [subItems, setSubItems] = useState<SubInventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [riskFilter, setRiskFilter] = useState<"all" | "alto" | "medio" | "sano">("all");
  const fileRef = useRef<HTMLInputElement>(null);
  const syncFileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Edit dialog state
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [editForm, setEditForm] = useState({ existencia: 0, precio_traxion: 0, ubicacion: "", stand: "", tipo_articulo: "Normal", sucursal: "", movement: "medium" });
  const [saving, setSaving] = useState(false);

  // Delete dialog state
  const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [suggestItem, setSuggestItem] = useState<InventoryItem | null>(null);

  // Clear all dialog + sort state
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  type SortField = "numero_articulo" | "descripcion" | "ubicacion" | "stand" | "warehouse_name" | "sucursal" | "existencia" | "dias_cobertura";
  type SortDir = "asc" | "desc";
  const [sortField, setSortField] = useState<SortField>("numero_articulo");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [inventoryView, setInventoryView] = useState<"warehouse" | "subwarehouse">("warehouse");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, whRes] = await Promise.all([
        fetch("/api/inventory"),
        fetch("/api/warehouses"),
      ]);
      const subRes = await fetch("/api/inventory/subview");
      const invData = await invRes.json();
      const whData = await whRes.json();
      const subData = await subRes.json();
      if (invData.success) setItems(invData.data);
      if (whData.success) setWarehouses(whData.data);
      if (subData.success) setSubItems(subData.data);
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Error al cargar datos" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Upload handler
  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast({ variant: "destructive", title: "Error", description: "Please select a file first" });
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (data.success) {
        toast({
          title: "Upload successful",
          description: `Processed: ${data.data.processed} | Created: ${data.data.created} | Updated: ${data.data.updated} | Errors: ${data.data.failed}`,
        });
        if (fileRef.current) fileRef.current.value = "";
        fetchData();
      } else {
        toast({ variant: "destructive", title: "Upload failed", description: data.error });
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Upload failed" });
    } finally {
      setUploading(false);
    }
  };

  // Kenworth Sync handler
  const handleSync = async () => {
    const file = syncFileRef.current?.files?.[0];
    if (!file) {
      toast({ variant: "destructive", title: "Error", description: "Selecciona el archivo Excel de Kenworth" });
      return;
    }
    setSyncing(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/inventory/sync", { method: "POST", body: form });
      const data = await res.json();
      if (data.success) {
        toast({
          title: "Sincronización exitosa",
          description: `Total: ${data.data.total} | Creados: ${data.data.created} | Actualizados: ${data.data.updated} | Errores: ${data.data.failed}`,
        });
        if (syncFileRef.current) syncFileRef.current.value = "";
        setShowSyncDialog(false);
        fetchData();
      } else {
        toast({ variant: "destructive", title: "Error", description: data.error });
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Error al sincronizar" });
    } finally {
      setSyncing(false);
    }
  };

  // Edit handlers
  const openEdit = (item: InventoryItem) => {
    setEditItem(item);
    setEditForm({ existencia: item.existencia, precio_traxion: item.precio_traxion, ubicacion: item.ubicacion, stand: item.stand, tipo_articulo: item.tipo_articulo || "Normal", sucursal: item.sucursal || "", movement: item.movement });
  };
  const handleSaveEdit = async () => {
    if (!editItem) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/inventory/${editItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Actualizado", description: `${editItem.numero_articulo} actualizado correctamente` });
        setEditItem(null);
        fetchData();
      } else {
        toast({ variant: "destructive", title: "Error", description: data.error });
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Error al actualizar" });
    } finally {
      setSaving(false);
    }
  };

  // Delete handlers
  const handleDelete = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/inventory/${deleteItem.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Eliminado", description: `${deleteItem.numero_articulo} eliminado` });
        setDeleteItem(null);
        fetchData();
      } else {
        toast({ variant: "destructive", title: "Error", description: data.error });
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Error al eliminar" });
    } finally {
      setDeleting(false);
    }
  };

  // Clear all inventory
  const handleClearAll = async () => {
    setClearingAll(true);
    try {
      const res = await fetch("/api/inventory", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Inventario limpiado", description: `${data.data.deleted} artículos eliminados` });
        setShowClearDialog(false);
        fetchData();
      } else {
        toast({ variant: "destructive", title: "Error", description: data.error });
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Error al limpiar inventario" });
    } finally {
      setClearingAll(false);
    }
  };

  // Sortable column toggle
  const handleSort = (field: "numero_articulo" | "descripcion" | "ubicacion" | "stand" | "warehouse_name" | "sucursal" | "existencia" | "dias_cobertura") => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return field;
      }
      setSortDir("asc");
      return field;
    });
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 text-muted-foreground" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  // Filter items
  const filtered = [...items.filter((item) => {
    const matchesSearch =
      !search ||
      item.numero_articulo.toLowerCase().includes(search.toLowerCase()) ||
      item.descripcion.toLowerCase().includes(search.toLowerCase());
    const matchesTab =
      activeTab === "all" || item.warehouse_id === Number(activeTab);
    const matchesRisk = riskFilter === "all" || item.riesgo_quiebre === riskFilter;
    return matchesSearch && matchesTab && matchesRisk;
  })].sort((a, b) => {
    let aVal: any = a[sortField as keyof InventoryItem] ?? "";
    let bVal: any = b[sortField as keyof InventoryItem] ?? "";
    if (sortField === "existencia" || sortField === "dias_cobertura") {
      aVal = Number(aVal) || 0;
      bVal = Number(bVal) || 0;
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    }
    const cmp = String(aVal).localeCompare(String(bVal), "es");
    return sortDir === "asc" ? cmp : -cmp;
  });

  const suggestedQty = suggestItem
    ? Math.max(1, Math.ceil((suggestItem.consumo_mensual || 0) - suggestItem.existencia))
    : 0;

  const filteredSubItems = subItems.filter((item) => {
    const matchesSearch =
      !search ||
      item.numero_articulo.toLowerCase().includes(search.toLowerCase()) ||
      item.descripcion.toLowerCase().includes(search.toLowerCase()) ||
      item.sub_warehouse_name.toLowerCase().includes(search.toLowerCase());
    const matchesRisk = riskFilter === "all" || item.riesgo_quiebre === riskFilter;
    return matchesSearch && matchesRisk;
  });

  return (
    <>
      <PageHeader title="Inventario" description="Analiza niveles de stock e identifica artículos de bajo movimiento." />

      <div className="grid gap-6">
        {/* Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle>Subir Datos de Inventario</CardTitle>
            <CardDescription>Sube un archivo Excel (.xlsx) o CSV para actualizar el inventario.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-center gap-4">
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="inventory-file">Archivo de Inventario</Label>
              <Input id="inventory-file" type="file" accept=".xlsx,.xls,.csv" ref={fileRef} />
            </div>
            <Button className="w-full sm:w-auto mt-4 sm:mt-0 self-end" onClick={handleUpload} disabled={uploading}>
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {uploading ? "Subiendo..." : "Subir"}
            </Button>
            <Button variant="outline" className="w-full sm:w-auto mt-4 sm:mt-0 self-end" onClick={() => setShowSyncDialog(true)}>
              <RefreshCw className="mr-2 h-4 w-4" /> Sincronizar desde Kenworth
            </Button>
            <Button variant="destructive" className="w-full sm:w-auto mt-4 sm:mt-0 self-end" onClick={() => setShowClearDialog(true)}>
              <Eraser className="mr-2 h-4 w-4" /> Limpiar Inventario
            </Button>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-[220px]">
            <Label className="mb-1 block">Vista</Label>
            <Select value={inventoryView} onValueChange={(value: any) => setInventoryView(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona vista" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="warehouse">Almacenes Padre</SelectItem>
                <SelectItem value="subwarehouse">Sub-Almacenes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número o descripción..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={riskFilter} onValueChange={(value: any) => setRiskFilter(value)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filtro de riesgo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los riesgos</SelectItem>
              <SelectItem value="alto">Riesgo Alto</SelectItem>
              <SelectItem value="medio">Riesgo Medio</SelectItem>
              <SelectItem value="sano">Sano</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : inventoryView === "subwarehouse" ? (
          <Card>
            <CardHeader>
              <CardTitle>Inventario por Sub-Almacén</CardTitle>
              <CardDescription>
                {filteredSubItems.length} registros — Valor total estimado: {formatCurrency(filteredSubItems.reduce((s, i) => s + i.existencia_sub * i.precio_traxion, 0))}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredSubItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Search className="h-10 w-10 mb-3" />
                  <p className="text-lg font-medium">Sin inventario en sub-almacenes</p>
                  <p className="text-sm">Completa movimientos de requisiciones/transferencias para ver existencias por sub-almacén.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sub-Almacén</TableHead>
                        <TableHead>Almacén Padre</TableHead>
                        <TableHead>Núm. Parte</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">Existencia</TableHead>
                        <TableHead className="text-right">Días Cobertura</TableHead>
                        <TableHead>Riesgo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSubItems.map((item, idx) => (
                        <TableRow key={`${item.sub_warehouse_id}-${item.numero_articulo}-${idx}`}>
                          <TableCell className="font-medium">{item.sub_warehouse_name}</TableCell>
                          <TableCell>{item.parent_warehouse_name || "—"}</TableCell>
                          <TableCell>{item.numero_articulo}</TableCell>
                          <TableCell>{item.descripcion}</TableCell>
                          <TableCell className="text-right">{item.existencia_sub}</TableCell>
                          <TableCell className="text-right">{formatCoverageDays(item.dias_cobertura)}</TableCell>
                          <TableCell><RiskBadge risk={item.riesgo_quiebre} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">Todos los Almacenes</TabsTrigger>
              {warehouses.map((wh) => (
                <TabsTrigger key={wh.id} value={String(wh.id)}>
                  {wh.name}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value={activeTab}>
              <Card>
                <CardHeader>
                  <CardTitle>
                    {activeTab === "all"
                      ? "Todos los Almacenes"
                      : warehouses.find((w) => w.id === Number(activeTab))?.name}
                  </CardTitle>
                  <CardDescription>
                    {filtered.length} artículos — Valor total:{" "}
                    {formatCurrency(filtered.reduce((s, i) => s + i.existencia * i.precio_traxion, 0))}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <InventoryTable items={filtered} onEdit={openEdit} onDelete={setDeleteItem} onSuggest={setSuggestItem} sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar {editItem?.numero_articulo}</DialogTitle>
            <DialogDescription>{editItem?.descripcion}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Existencia</Label>
              <Input
                type="number"
                className="col-span-3"
                value={editForm.existencia}
                onChange={(e) => setEditForm({ ...editForm, existencia: Number(e.target.value) })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Precio Traxion</Label>
              <Input
                type="number"
                step="0.01"
                className="col-span-3"
                value={editForm.precio_traxion}
                onChange={(e) => setEditForm({ ...editForm, precio_traxion: Number(e.target.value) })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Ubicación</Label>
              <Input
                className="col-span-3"
                value={editForm.ubicacion}
                onChange={(e) => setEditForm({ ...editForm, ubicacion: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Stand</Label>
              <Input
                className="col-span-3"
                value={editForm.stand}
                onChange={(e) => setEditForm({ ...editForm, stand: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Tipo Artículo</Label>
              <Input
                className="col-span-3"
                value={editForm.tipo_articulo}
                onChange={(e) => setEditForm({ ...editForm, tipo_articulo: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Sucursal</Label>
              <Input
                className="col-span-3"
                value={editForm.sucursal}
                onChange={(e) => setEditForm({ ...editForm, sucursal: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Movimiento</Label>
              <Select value={editForm.movement} onValueChange={(v) => setEditForm({ ...editForm, movement: v })}>
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">Alto</SelectItem>
                  <SelectItem value="medium">Medio</SelectItem>
                  <SelectItem value="low">Bajo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {deleteItem?.numero_articulo}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esto eliminará permanentemente &quot;{deleteItem?.descripcion}&quot; del inventario. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Kenworth Sync Dialog */}
      <Dialog open={showSyncDialog} onOpenChange={setShowSyncDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sincronizar desde Kenworth</DialogTitle>
            <DialogDescription>
              Sube el archivo Excel descargado del sistema de Kenworth. Se importarán las columnas: Núm. Parte, Descripción, Ubicación, Stand, Tipo Artículo, Almacén, Sucursal, Exist. Actual, PrecioLista, Moneda y Tipo de Cambio.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="sync-file">Archivo Excel de Kenworth</Label>
              <Input id="sync-file" type="file" accept=".xlsx,.xls" ref={syncFileRef} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSyncDialog(false)}>Cancelar</Button>
            <Button onClick={handleSync} disabled={syncing}>
              {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {syncing ? "Sincronizando..." : "Sincronizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sugerencia de Requisición */}
      <Dialog open={!!suggestItem} onOpenChange={(open) => !open && setSuggestItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Sugerencia de Reposición</DialogTitle>
            <DialogDescription>Recomendación basada en consumo mensual vs stock actual.</DialogDescription>
          </DialogHeader>
          {suggestItem && (
            <div className="space-y-2 text-sm">
              <p><strong>Artículo:</strong> {suggestItem.numero_articulo}</p>
              <p><strong>Descripción:</strong> {suggestItem.descripcion}</p>
              <p><strong>Existencia actual:</strong> {suggestItem.existencia}</p>
              <p><strong>Consumo mensual:</strong> {suggestItem.consumo_mensual || 0}</p>
              <p><strong>Días de cobertura:</strong> {formatCoverageDays(suggestItem.dias_cobertura)}</p>
              <p className="text-base"><strong>Sugerencia de requisición:</strong> {suggestedQty} pieza(s)</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuggestItem(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear All Inventory Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Limpiar todo el inventario?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán <strong>todos</strong> los artículos del inventario. Esta acción no se puede deshacer.
              Podrás subir un nuevo inventario después.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearingAll}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAll}
              disabled={clearingAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {clearingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {clearingAll ? "Eliminando..." : "Sí, limpiar inventario"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
