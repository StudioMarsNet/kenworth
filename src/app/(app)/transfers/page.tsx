"use client";

import { useCallback, useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowRightLeft,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Loader2,
  PlusCircle,
  ThumbsUp,
  Truck,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

type TransferRow = {
  id: number;
  request_id: string;
  type: "Transfer";
  item_id: number | null;
  numero_articulo: string | null;
  item_name: string | null;
  quantity: number;
  from_warehouse_id: number | null;
  from_warehouse_name: string | null;
  from_sub_warehouse_id: number | null;
  to_warehouse_id: number | null;
  to_warehouse_name: string | null;
  to_sub_warehouse_id: number | null;
  folio_sitic: string | null;
  status: "Pending" | "Approved" | "In Transit" | "Completed" | "Closed" | "Rejected";
  is_stalled?: boolean;
  created_at: string;
};

type TransferLogRow = {
  id: number;
  request_id: string;
  numero_articulo: string;
  item_name: string;
  from_warehouse_name: string;
  to_warehouse_name: string;
  quantity: number;
  received_quantity: number | null;
  discrepancy_notes: string | null;
  received_by: string | null;
  transferred_at: string;
  status: string;
};

type Warehouse = { id: number; name: string };
type SubWarehouse = { id: number; nombre: string; parent_warehouse_id: number | null; parent_warehouse_name: string | null };

const getDaysSince = (dateStr: string): number => {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
  const d = new Date(dateStr);
  return Math.floor((now.getTime() - d.getTime()) / 86400000);
};

const formatMXDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("es-MX");

const DelayBadge = ({ createdAt }: { createdAt: string }) => {
  const days = getDaysSince(createdAt);
  if (days <= 3) return <Badge className="ml-2 bg-green-100 text-green-700 text-xs">{days}d — En tiempo</Badge>;
  if (days === 4) return <Badge className="ml-2 bg-yellow-100 text-yellow-700 text-xs">{days}d — Atención</Badge>;
  if (days === 5) return <Badge className="ml-2 bg-orange-100 text-orange-700 text-xs">{days}d — URGENTE</Badge>;
  return <Badge className="ml-2 bg-red-100 text-red-700 text-xs">{days}d — CRÍTICO</Badge>;
};

const StatusBadge = ({ status }: { status: TransferRow["status"] }) => {
  const variant: Record<TransferRow["status"], "default" | "secondary" | "outline" | "destructive"> = {
    Pending: "secondary",
    Approved: "default",
    "In Transit": "outline",
    Completed: "default",
    Closed: "default",
    Rejected: "destructive",
  };
  const className: Record<TransferRow["status"], string> = {
    Pending: "bg-yellow-200 text-yellow-800",
    Approved: "bg-blue-200 text-blue-800",
    "In Transit": "bg-purple-200 text-purple-800",
    Completed: "bg-green-200 text-green-800",
    Closed: "bg-gray-200 text-gray-800",
    Rejected: "",
  };

  return (
    <Badge variant={variant[status]} className={className[status]}>
      {status}
    </Badge>
  );
};

export default function TransfersPage() {
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [subWarehouses, setSubWarehouses] = useState<SubWarehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusTab, setStatusTab] = useState("all");
  const [submitting, setSubmitting] = useState(false);
  const [formTransferNumber, setFormTransferNumber] = useState("");
  const [formRealizationDate, setFormRealizationDate] = useState(new Date().toISOString().split("T")[0]);
  const [formFrom, setFormFrom] = useState("");
  const [formTo, setFormTo] = useState("");
  const [editFolioId, setEditFolioId] = useState<number | null>(null);
  const [editFolioValue, setEditFolioValue] = useState("");
  const [savingFolio, setSavingFolio] = useState(false);
  const { toast } = useToast();

  // Receipt confirmation
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptTransfer, setReceiptTransfer] = useState<TransferRow | null>(null);
  const [receiptQty, setReceiptQty] = useState("");
  const [receiptNotes, setReceiptNotes] = useState("");
  const [receiptSubmitting, setReceiptSubmitting] = useState(false);

  // Transfer report
  const [reportData, setReportData] = useState<TransferLogRow[]>([]);
  const [reportSummary, setReportSummary] = useState<{ total: number; totalQty: number; discrepancies: number }>({ total: 0, totalQty: 0, discrepancies: 0 });
  const [reportDateFrom, setReportDateFrom] = useState("");
  const [reportDateTo, setReportDateTo] = useState("");
  const [reportWarehouse, setReportWarehouse] = useState("all");
  const [reportLoading, setReportLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [transferRes, warehouseRes, subWarehouseRes] = await Promise.all([
        fetch("/api/requisitions?type=Transfer"),
        fetch("/api/warehouses"),
        fetch("/api/subalmacenes"),
      ]);

      const transferData = await transferRes.json();
      const warehouseData = await warehouseRes.json();
      const subWarehouseData = await subWarehouseRes.json();

      if (transferData.success) {
        setTransfers(transferData.data);
      }
      if (warehouseData.success) {
        setWarehouses(warehouseData.data);
      }
      if (subWarehouseData.success) {
        setSubWarehouses(subWarehouseData.data);
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load transfers data",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setFormTransferNumber("");
    setFormRealizationDate(new Date().toISOString().split("T")[0]);
    setFormFrom("");
    setFormTo("");
  };

  const handleSubmit = async () => {
    if (!formTransferNumber || !formRealizationDate || !formFrom || !formTo) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Número de traspaso, fecha, origen y destino son obligatorios",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/requisitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "Transfer",
          transfer_number: formTransferNumber.trim(),
          realization_date: formRealizationDate,
          from_sub_warehouse_id: Number(formFrom),
          to_sub_warehouse_id: Number(formTo),
        }),
      });
      const data = await response.json();

      if (!data.success) {
        const errorMessage = typeof data.error === "string" ? data.error : JSON.stringify(data.error);
        toast({ variant: "destructive", title: "Error", description: errorMessage });
        return;
      }

      toast({
        title: "Created",
        description: `Transfer ${data.data.request_id} created`,
      });
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to create transfer" });
    } finally {
      setSubmitting(false);
    }
  };

  const saveFolioSitic = async (id: number) => {
    setSavingFolio(true);
    try {
      const res = await fetch(`/api/requisitions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folio_sitic: editFolioValue.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Folio SITIC guardado" });
        setEditFolioId(null);
        fetchData();
      } else {
        toast({ variant: "destructive", title: "Error", description: data.error });
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Error al guardar folio" });
    } finally { setSavingFolio(false); }
  };

  const updateStatus = async (id: number, status: TransferRow["status"]) => {
    try {
      const response = await fetch(`/api/requisitions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();

      if (!data.success) {
        toast({ variant: "destructive", title: "Error", description: data.error });
        return;
      }

      toast({ title: "Updated", description: `Transfer changed to ${status}` });
      fetchData();
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to update transfer" });
    }
  };

  // Open receipt confirmation dialog
  const openReceiptDialog = (transfer: TransferRow) => {
    setReceiptTransfer(transfer);
    setReceiptQty(String(transfer.quantity || 0));
    setReceiptNotes("");
    setReceiptOpen(true);
  };

  // Confirm receipt with optional discrepancy
  const handleConfirmReceipt = async () => {
    if (!receiptTransfer) return;
    setReceiptSubmitting(true);
    try {
      const response = await fetch(`/api/requisitions/${receiptTransfer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Completed",
          received_quantity: Number(receiptQty),
          discrepancy_notes: receiptNotes || undefined,
          received_by: "system",
        }),
      });
      const data = await response.json();
      if (!data.success) {
        toast({ variant: "destructive", title: "Error", description: data.error });
        return;
      }
      const hasDisc = Number(receiptQty) !== receiptTransfer.quantity;
      toast({
        title: hasDisc ? "Recibido con discrepancia" : "Recibido",
        description: hasDisc
          ? `Enviado: ${receiptTransfer.quantity}, Recibido: ${receiptQty}`
          : `Transferencia completada exitosamente`,
      });
      setReceiptOpen(false);
      setReceiptTransfer(null);
      fetchData();
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Error al confirmar recepción" });
    } finally {
      setReceiptSubmitting(false);
    }
  };

  // Fetch transfer report
  const fetchReport = async () => {
    setReportLoading(true);
    try {
      const params = new URLSearchParams();
      if (reportDateFrom) params.set("fecha_inicio", reportDateFrom);
      if (reportDateTo) params.set("fecha_fin", reportDateTo);
      if (reportWarehouse && reportWarehouse !== "all") params.set("warehouse_id", reportWarehouse);

      const res = await fetch(`/api/transfers?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setReportData(data.data);
        setReportSummary(data.summary);
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Error al cargar reporte" });
    } finally {
      setReportLoading(false);
    }
  };

  const filteredTransfers = transfers.filter((transfer) => {
    if (statusTab === "all") {
      return true;
    }

    return transfer.status === statusTab;
  });

  const getSubWarehouseName = (id: number | null | undefined) => {
    if (!id) return "—";
    return subWarehouses.find((sw) => sw.id === id)?.nombre || `ID:${id}`;
  };

  const getFromLabel = (t: TransferRow) => {
    if (t.from_sub_warehouse_id) return getSubWarehouseName(t.from_sub_warehouse_id);
    return t.from_warehouse_name || "—";
  };

  const getToLabel = (t: TransferRow) => {
    if (t.to_sub_warehouse_id) return getSubWarehouseName(t.to_sub_warehouse_id);
    return t.to_warehouse_name || "—";
  };

  return (
    <>
      <PageHeader
        title="Transfers"
        description="Manage inter-warehouse stock movements with a dedicated workflow."
      />

      {/* Tracking: Traspasos por Recibir */}
      {(() => {
        const pending = transfers.filter((t) => t.status === "In Transit" || t.status === "Approved" || t.status === "Pending");
        if (pending.length === 0) return null;
        return (
          <Card className="mb-6 border-amber-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-5 w-5" /> Traspasos por Recibir
              </CardTitle>
              <CardDescription>Movimientos pendientes / en tránsito con días de retraso.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No. Traspaso</TableHead>
                      <TableHead>Folio SITIC</TableHead>
                      <TableHead>Almacén de Origen</TableHead>
                      <TableHead>Almacén de Destino</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead>Fecha Realización</TableHead>
                      <TableHead>Días de Retraso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pending.map((t) => {
                      const days = getDaysSince(t.created_at);
                      let delayClass = "text-green-700";
                      if (days >= 6) delayClass = "text-red-700 font-bold";
                      else if (days === 5) delayClass = "text-orange-600 font-semibold";
                      else if (days === 4) delayClass = "text-yellow-600 font-semibold";
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">{t.request_id}</TableCell>
                          <TableCell>
                            {editFolioId === t.id ? (
                              <div className="flex items-center gap-1">
                                <Input autoFocus className="h-7 w-28 text-xs" value={editFolioValue} onChange={(e) => setEditFolioValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveFolioSitic(t.id); if (e.key === "Escape") setEditFolioId(null); }} />
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => saveFolioSitic(t.id)} disabled={savingFolio}><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /></Button>
                              </div>
                            ) : (
                              <button className="text-sm text-left hover:underline" onClick={() => { setEditFolioId(t.id); setEditFolioValue(t.folio_sitic || ""); }}>
                                {t.folio_sitic ? <span className="font-medium text-blue-700">{t.folio_sitic}</span> : <span className="text-muted-foreground italic text-xs">+ Agregar</span>}
                              </button>
                            )}
                          </TableCell>
                          <TableCell>{getFromLabel(t)}</TableCell>
                          <TableCell>{getToLabel(t)}</TableCell>
                          <TableCell className="text-right">{t.quantity > 0 ? t.quantity : "—"}</TableCell>
                          <TableCell>{formatMXDate(t.created_at)}</TableCell>
                          <TableCell><span className={delayClass}>{days} día{days !== 1 ? "s" : ""}</span></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Transfers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transfers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transfers.filter((item) => item.status === "Pending").length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">In Transit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transfers.filter((item) => item.status === "In Transit").length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transfers.filter((item) => item.status === "Completed").length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Transfer Queue</CardTitle>
              <CardDescription>Approve, dispatch and complete inter-warehouse movements.</CardDescription>
            </div>
            <Dialog
              open={dialogOpen}
              onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) {
                  resetForm();
                }
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  New Transfer
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                  <DialogTitle>Create New Transfer</DialogTitle>
                  <DialogDescription>Captura número de traspaso, fecha de realización, origen y destino.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">No. Traspaso</Label>
                    <Input
                      className="col-span-3"
                      value={formTransferNumber}
                      onChange={(e) => setFormTransferNumber(e.target.value)}
                      placeholder="Ej. TRASP-000123"
                      maxLength={20}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Fecha Realización</Label>
                    <Input
                      type="date"
                      className="col-span-3"
                      value={formRealizationDate}
                      onChange={(e) => setFormRealizationDate(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">From</Label>
                    <Select value={formFrom} onValueChange={(value) => {
                      setFormFrom(value);
                    }}>
                      <SelectTrigger className="col-span-3"><SelectValue placeholder="Source sub-warehouse" /></SelectTrigger>
                      <SelectContent>
                        {subWarehouses.map((sw) => (
                          <SelectItem key={sw.id} value={String(sw.id)}>{sw.nombre}{sw.parent_warehouse_name ? ` (${sw.parent_warehouse_name})` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">To</Label>
                    <Select value={formTo} onValueChange={setFormTo}>
                      <SelectTrigger className="col-span-3"><SelectValue placeholder="Destination sub-warehouse" /></SelectTrigger>
                      <SelectContent>
                        {subWarehouses
                          .filter((sw) => String(sw.id) !== formFrom)
                          .map((sw) => (
                            <SelectItem key={sw.id} value={String(sw.id)}>{sw.nombre}{sw.parent_warehouse_name ? ` (${sw.parent_warehouse_name})` : ""}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleSubmit} disabled={submitting}>
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Create Transfer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={statusTab} onValueChange={setStatusTab} className="mb-4">
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="Pending">Pending</TabsTrigger>
              <TabsTrigger value="Approved">Approved</TabsTrigger>
              <TabsTrigger value="In Transit">In Transit</TabsTrigger>
              <TabsTrigger value="Completed">Completed</TabsTrigger>
              <TabsTrigger value="Closed">Closed</TabsTrigger>
              <TabsTrigger value="Rejected">Rejected</TabsTrigger>
            </TabsList>
          </Tabs>

          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredTransfers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ArrowRightLeft className="h-10 w-10 mb-3" />
              <p className="text-lg font-medium">No transfers found</p>
              <p className="text-sm">Create the first warehouse transfer to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Folio SITIC</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransfers.map((transfer) => (
                    <TableRow key={transfer.id}>
                      <TableCell className="font-medium">{transfer.request_id}</TableCell>
                      <TableCell>
                        {editFolioId === transfer.id ? (
                          <div className="flex items-center gap-1">
                            <Input autoFocus className="h-7 w-28 text-xs" value={editFolioValue} onChange={(e) => setEditFolioValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveFolioSitic(transfer.id); if (e.key === "Escape") setEditFolioId(null); }} />
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => saveFolioSitic(transfer.id)} disabled={savingFolio}><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /></Button>
                          </div>
                        ) : (
                          <button className="text-sm text-left hover:underline" onClick={() => { setEditFolioId(transfer.id); setEditFolioValue(transfer.folio_sitic || ""); }}>
                            {transfer.folio_sitic ? <span className="font-medium text-blue-700">{transfer.folio_sitic}</span> : <span className="text-muted-foreground italic text-xs">+ Agregar</span>}
                          </button>
                        )}
                      </TableCell>
                      <TableCell>{transfer.item_name || "—"}</TableCell>
                      <TableCell>{getFromLabel(transfer as any)}</TableCell>
                      <TableCell>{getToLabel(transfer as any)}</TableCell>
                      <TableCell className="text-right">{transfer.quantity > 0 ? transfer.quantity : "—"}</TableCell>
                      <TableCell>{formatMXDate(transfer.created_at)}</TableCell>
                      <TableCell>
                        <StatusBadge status={transfer.status} />
                        {["Pending", "Approved", "In Transit"].includes(transfer.status) && (
                          <DelayBadge createdAt={transfer.created_at} />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {transfer.status === "Pending" ? (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => updateStatus(transfer.id, "Approved")}>
                                <ThumbsUp className="h-4 w-4 mr-1" /> Approve
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => updateStatus(transfer.id, "Rejected")}>
                                <XCircle className="h-4 w-4 mr-1 text-destructive" /> Reject
                              </Button>
                            </>
                          ) : null}
                          {transfer.status === "Approved" ? (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => updateStatus(transfer.id, "In Transit")}>
                                <Truck className="h-4 w-4 mr-1" /> In Transit
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => updateStatus(transfer.id, "Rejected")}>
                                <XCircle className="h-4 w-4 mr-1 text-destructive" /> Reject
                              </Button>
                            </>
                          ) : null}
                          {transfer.status === "In Transit" ? (
                            transfer.quantity > 0 ? (
                              <Button variant="ghost" size="sm" onClick={() => openReceiptDialog(transfer)}>
                                <ClipboardCheck className="h-4 w-4 mr-1" /> Confirmar Recepción
                              </Button>
                            ) : (
                              <Button variant="ghost" size="sm" onClick={() => updateStatus(transfer.id, "Completed")}>
                                <CheckCircle2 className="h-4 w-4 mr-1" /> Completar
                              </Button>
                            )
                          ) : null}
                          {transfer.status === "Completed" ? (
                            <Button variant="ghost" size="sm" onClick={() => updateStatus(transfer.id, "Closed")}>
                              <CheckCircle2 className="h-4 w-4 mr-1" /> Cerrar
                            </Button>
                          ) : null}
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

      {/* Receipt Confirmation Dialog */}
      <Dialog open={receiptOpen} onOpenChange={(open) => { if (!open) { setReceiptOpen(false); setReceiptTransfer(null); } }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Confirmar Recepción</DialogTitle>
            <DialogDescription>
              Transferencia {receiptTransfer?.request_id} — {receiptTransfer?.item_name || "Sin artículo"}
              <br />Cantidad enviada: <strong>{receiptTransfer?.quantity || 0}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Recibido</Label>
              <Input
                type="number"
                min={0}
                className="col-span-3"
                value={receiptQty}
                onChange={(e) => setReceiptQty(e.target.value)}
                placeholder="Cantidad recibida"
              />
            </div>
            {receiptTransfer && Number(receiptQty) !== receiptTransfer.quantity && (
              <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-md">
                <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
                <span className="text-sm text-orange-700">
                  Discrepancia detectada: enviado {receiptTransfer.quantity}, recibido {receiptQty || 0}
                  {Number(receiptQty) < receiptTransfer.quantity ? ` (faltante: ${receiptTransfer.quantity - Number(receiptQty)})` : ` (sobrante: ${Number(receiptQty) - receiptTransfer.quantity})`}
                </span>
              </div>
            )}
            <div className="grid grid-cols-4 items-start gap-4">
              <Label className="text-right pt-2">Notas</Label>
              <Textarea
                className="col-span-3"
                placeholder="Observaciones de recepción (opcional)"
                value={receiptNotes}
                onChange={(e) => setReceiptNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReceiptOpen(false); setReceiptTransfer(null); }}>Cancelar</Button>
            <Button onClick={handleConfirmReceipt} disabled={receiptSubmitting || !receiptQty}>
              {receiptSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-2 h-4 w-4" />}
              Confirmar Recepción
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Report Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Reporte de Transferencias</CardTitle>
          <CardDescription>Consulta transferencias por periodo y almacén.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Label>Desde:</Label>
              <Input type="date" value={reportDateFrom} onChange={(e) => setReportDateFrom(e.target.value)} className="w-40" />
            </div>
            <div className="flex items-center gap-2">
              <Label>Hasta:</Label>
              <Input type="date" value={reportDateTo} onChange={(e) => setReportDateTo(e.target.value)} className="w-40" />
            </div>
            <div className="flex items-center gap-2">
              <Label>Almacén:</Label>
              <Select value={reportWarehouse} onValueChange={setReportWarehouse}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={fetchReport} disabled={reportLoading}>
              {reportLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Consultar
            </Button>
          </div>

          {/* Report Summary */}
          {reportData.length > 0 && (
            <>
              <div className="grid gap-4 md:grid-cols-3 mb-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Total Transferencias</div>
                    <div className="text-2xl font-bold">{reportSummary.total}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Cantidad Total</div>
                    <div className="text-2xl font-bold">{reportSummary.totalQty.toLocaleString()}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Con Discrepancia</div>
                    <div className="text-2xl font-bold text-orange-600">{reportSummary.discrepancies}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Folio</TableHead>
                      <TableHead>Artículo</TableHead>
                      <TableHead>Origen</TableHead>
                      <TableHead>Destino</TableHead>
                      <TableHead className="text-right">Enviado</TableHead>
                      <TableHead className="text-right">Recibido</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Notas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.request_id}</TableCell>
                        <TableCell>{row.item_name}</TableCell>
                        <TableCell>{row.from_warehouse_name}</TableCell>
                        <TableCell>{row.to_warehouse_name}</TableCell>
                        <TableCell className="text-right">{row.quantity}</TableCell>
                        <TableCell className="text-right">
                          {row.received_quantity != null ? (
                            <span className={row.received_quantity !== row.quantity ? "text-orange-600 font-semibold" : ""}>
                              {row.received_quantity}
                            </span>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          {row.status === "Discrepancy" ? (
                            <Badge variant="outline" className="bg-orange-100 text-orange-700">Discrepancia</Badge>
                          ) : row.status === "Received" ? (
                            <Badge variant="outline" className="bg-green-100 text-green-700">Recibido</Badge>
                          ) : (
                            <Badge variant="secondary">{row.status || "—"}</Badge>
                          )}
                        </TableCell>
                        <TableCell>{row.transferred_at ? new Date(row.transferred_at).toLocaleDateString("es-MX") : "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{row.discrepancy_notes || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {!reportLoading && reportData.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              Selecciona un rango de fechas y haz clic en &quot;Consultar&quot; para ver el reporte.
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}