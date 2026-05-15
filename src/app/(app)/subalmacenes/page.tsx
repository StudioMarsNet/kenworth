"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, PlusCircle, Trash2, Loader2, Warehouse } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

type SubWarehouse = {
  id: number;
  nombre: string;
  parent_warehouse_id: number | null;
  parent_warehouse_name: string | null;
  ubicacion: string | null;
  descripcion: string | null;
  activo: number;
  created_at: string;
};

type Warehouse = { id: number; name: string };

const EMPTY_FORM = { nombre: "", parent_warehouse_id: "", ubicacion: "", descripcion: "" };

export default function SubalmacenesPage() {
  const [subWarehouses, setSubWarehouses] = useState<SubWarehouse[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SubWarehouse | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<SubWarehouse | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [swRes, whRes] = await Promise.all([
        fetch("/api/subalmacenes"),
        fetch("/api/warehouses"),
      ]);
      const swData = await swRes.json();
      const whData = await whRes.json();
      if (swData.success) setSubWarehouses(swData.data);
      if (whData.success) setWarehouses(whData.data);
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Error al cargar datos" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (sw: SubWarehouse) => {
    setEditing(sw);
    setForm({
      nombre: sw.nombre,
      parent_warehouse_id: sw.parent_warehouse_id ? String(sw.parent_warehouse_id) : "",
      ubicacion: sw.ubicacion || "",
      descripcion: sw.descripcion || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) {
      toast({ variant: "destructive", title: "Error", description: "El nombre es obligatorio" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nombre: form.nombre.trim(),
        parent_warehouse_id: form.parent_warehouse_id ? Number(form.parent_warehouse_id) : null,
        ubicacion: form.ubicacion.trim() || null,
        descripcion: form.descripcion.trim() || null,
      };

      const url = editing ? `/api/subalmacenes/${editing.id}` : "/api/subalmacenes";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      toast({ title: editing ? "Sub-almacén actualizado" : "Sub-almacén creado" });
      setDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/subalmacenes/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "No se pudo eliminar");
      toast({ title: "Sub-almacén eliminado" });
      setDeleteTarget(null);
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Sub-Almacenes"
        description="Gestiona las ubicaciones y sub-almacenes para requisiciones y traspasos."
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lista de Sub-Almacenes</CardTitle>
              <CardDescription>
                {subWarehouses.length} sub-almacén{subWarehouses.length !== 1 ? "es" : ""} registrado{subWarehouses.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            <Button onClick={openCreate}>
              <PlusCircle className="mr-2 h-4 w-4" /> Nuevo Sub-Almacén
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : subWarehouses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
              <Warehouse className="h-10 w-10 mb-3" />
              <p className="text-lg font-medium">No hay sub-almacenes registrados</p>
              <p className="text-sm">Crea el primero con el botón de arriba.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Almacén Padre</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subWarehouses.map((sw) => (
                    <TableRow key={sw.id}>
                      <TableCell className="font-medium">{sw.id}</TableCell>
                      <TableCell className="font-semibold">{sw.nombre}</TableCell>
                      <TableCell>
                        {sw.parent_warehouse_name ? (
                          <Badge variant="outline">{sw.parent_warehouse_name}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>{sw.ubicacion || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{sw.descripcion || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>
                        <Badge variant={sw.activo ? "default" : "secondary"}>
                          {sw.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(sw)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(sw)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
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

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) setDialogOpen(false); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Sub-Almacén" : "Nuevo Sub-Almacén"}</DialogTitle>
            <DialogDescription>
              {editing ? "Actualiza los datos del sub-almacén." : "Completa los datos para crear un nuevo sub-almacén."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Nombre *</Label>
              <Input
                className="col-span-3"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej. Almacén Norte, Rack A-3..."
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Almacén Padre</Label>
              <Select
                value={form.parent_warehouse_id}
                onValueChange={(v) => setForm({ ...form, parent_warehouse_id: v === "none" ? "" : v })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Ninguno (independiente)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguno (independiente)</SelectItem>
                  {warehouses.map((wh) => (
                    <SelectItem key={wh.id} value={String(wh.id)}>{wh.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Ubicación</Label>
              <Input
                className="col-span-3"
                value={form.ubicacion}
                onChange={(e) => setForm({ ...form, ubicacion: e.target.value })}
                placeholder="Ej. Piso 2, Pasillo 3..."
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label className="text-right pt-2">Descripción</Label>
              <Textarea
                className="col-span-3"
                rows={3}
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Descripción opcional..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar sub-almacén?</AlertDialogTitle>
            <AlertDialogDescription>
              Se desactivará <strong>{deleteTarget?.nombre}</strong>. Las requisiciones existentes que lo referencian no se verán afectadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {deleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
