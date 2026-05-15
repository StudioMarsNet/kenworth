"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  Tooltip,
  Pie,
  PieChart,
  Cell,
} from "recharts";
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
import { Badge } from "@/components/ui/badge";
import { DollarSign, Boxes, ArrowRightLeft, Truck, ShoppingCart, TrendingUp, FileText, CalendarDays, RefreshCw } from "lucide-react";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type RangePreset = "7" | "15" | "30" | "90" | "custom";

const toYMD = (d: Date) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const getPresetRange = (days: number) => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return { start: toYMD(start), end: toYMD(end) };
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat("es-MX").format(value);

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

const normalizeDistribution = (rows: { name: string; value: number }[] | undefined) => {
  const agg = new Map<string, number>();
  for (const row of rows || []) {
    const name = String(row?.name || "Sin nombre").trim() || "Sin nombre";
    const value = Number(row?.value || 0);
    if (value <= 0) continue;
    agg.set(name, (agg.get(name) || 0) + value);
  }
  return Array.from(agg.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
};

type DashboardStats = {
  totalInventoryValue: number;
  inventoryHealth: { skus: number; units: number; skus_with_stock: number; orphan_items: number };
  lowMovementCount: number;
  openRequisitionsCount: number;
  transfersThisMonth: number;
  warehouseDistribution: { name: string; value: number }[];
  subWarehouseDistribution: { name: string; value: number }[];
  subWarehouseDistributionSource?: "movements" | "consumption" | "none";
  subWarehouseStats: { activos: number; con_stock: number; total_value: number };
  recentActivity: { request_id: string; type: string; quantity: number; status: string; created_at: string; item_name: string }[];
  recentTransfers: { quantity: number; transferred_at: string; item_name: string; from_warehouse: string; to_warehouse: string }[];
  consumoDia: { piezas: number; monto: number };
  consumoMes: { piezas: number; monto: number };
  consumo30Dias: { dia: string; monto: number }[];
  topConsumo: { numero_articulo: string; descripcion: string; total_piezas: number; total_monto: number }[];
  cargasConsumoHoy: { registros: number; monto: number };
  correccionesDia: { ediciones: number; borrados: number };
  alertasConsumo7Dias: { numero_articulo: string; descripcion: string; total_piezas: number; total_monto: number }[];
  cotizacionesPendientes: { total: number; monto: number };
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [inventoryChartMode, setInventoryChartMode] = useState<"warehouse" | "subwarehouse">("warehouse");
  const [rangePreset, setRangePreset] = useState<RangePreset>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("dash_preset") as RangePreset) || "30";
    }
    return "30";
  });
  const [fechaInicio, setFechaInicio] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dash_fi");
      if (saved) return saved;
    }
    return getPresetRange(30).start;
  });
  const [fechaFin, setFechaFin] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dash_ff");
      if (saved) return saved;
    }
    return getPresetRange(30).end;
  });

  const fetchStats = useCallback(async () => {
    try {
      setLoadError("");
      const params = new URLSearchParams();
      if (fechaInicio) params.set("fecha_inicio", fechaInicio);
      if (fechaFin) params.set("fecha_fin", fechaFin);
      const res = await fetch(`/api/dashboard/stats${params.toString() ? `?${params.toString()}` : ""}`);
      const data = await res.json();
      if (data.success) setStats(data.data);
      else setLoadError(data?.error || "No se pudo cargar el dashboard");
    } catch {
      setLoadError("No se pudo cargar el dashboard");
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    if (rangePreset === "custom") return;
    const days = Number(rangePreset);
    const range = getPresetRange(days);
    setFechaInicio(range.start);
    setFechaFin(range.end);
  }, [rangePreset]);

  // Persist filter selection
  useEffect(() => {
    localStorage.setItem("dash_preset", rangePreset);
    localStorage.setItem("dash_fi", fechaInicio);
    localStorage.setItem("dash_ff", fechaFin);
  }, [rangePreset, fechaInicio, fechaFin]);

  const formatDateRange = () => {
    if (!fechaInicio || !fechaFin) return "";
    const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
    return `${fmt(fechaInicio)} — ${fmt(fechaFin)}`;
  };

  const recentActivityData = stats?.recentActivity.slice(0, 5).map((r) => ({
    name: r.request_id,
    quantity: r.quantity,
  })) || [];

  const warehousePieData = normalizeDistribution(stats?.warehouseDistribution);
  const subWarehousePieData = normalizeDistribution(stats?.subWarehouseDistribution);
  const showSubwarehouseConsumptionHint = inventoryChartMode === "subwarehouse" && stats?.subWarehouseDistributionSource === "consumption";

  const inventoryPieData = inventoryChartMode === "warehouse"
    ? warehousePieData
    : subWarehousePieData;

  const consumoChartData = (stats?.consumo30Dias || []).map((row) => ({
    dia: row.dia,
    monto: Number(row.monto || 0),
  }));
  const consumoMax = consumoChartData.reduce((acc, row) => Math.max(acc, row.monto), 0);
  const consumoAxisMax = consumoMax > 0 ? Math.ceil((consumoMax * 1.12) / 1000) * 1000 : 1000;

  if (loading) {
    return (
      <>
        <PageHeader title="Dashboard" description="Resumen general del inventario y operaciones." />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Skeleton className="h-[380px]" />
          <Skeleton className="h-[380px]" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Dashboard" description="Resumen general del inventario y operaciones." />

      <Card className="mb-4">
        <CardContent className="py-4 flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <span className="text-xs text-muted-foreground">Rango</span>
            <Select value={rangePreset} onValueChange={(v: RangePreset) => setRangePreset(v)}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 días</SelectItem>
                <SelectItem value="15">Últimos 15 días</SelectItem>
                <SelectItem value="30">Últimos 30 días</SelectItem>
                <SelectItem value="90">Últimos 90 días</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <span className="text-xs text-muted-foreground">Desde</span>
            <Input
              type="date"
              value={fechaInicio}
              onChange={(e) => { setRangePreset("custom"); setFechaInicio(e.target.value); }}
              className="w-[170px]"
            />
          </div>
          <div className="grid gap-1.5">
            <span className="text-xs text-muted-foreground">Hasta</span>
            <Input
              type="date"
              value={fechaFin}
              onChange={(e) => { setRangePreset("custom"); setFechaFin(e.target.value); }}
              className="w-[170px]"
            />
          </div>
          <Separator orientation="vertical" className="h-8 hidden md:block" />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            <span className="font-medium text-foreground">{formatDateRange()}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setLoading(true); fetchStats(); }} title="Recargar datos">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRangePreset("30")}>Restablecer 30 días</Button>
          </div>
        </CardContent>
      </Card>

      {loadError && (
        <Card className="mb-4 border-destructive/40 bg-destructive/5">
          <CardContent className="py-3 flex items-center justify-between">
            <span className="text-sm text-destructive">{loadError}</span>
            <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchStats(); }}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Reintentar
            </Button>
          </CardContent>
        </Card>
      )}

      {Number(stats?.inventoryHealth?.orphan_items || 0) > 0 && (
        <Card className="mb-4 border-amber-300 bg-amber-50">
          <CardContent className="py-3 text-sm text-amber-800">
            Se detectaron {formatNumber(stats?.inventoryHealth?.orphan_items || 0)} artículos sin almacén padre válido.
            Recomendación: volver a sincronizar inventario para asociarlos a KENWORTH.
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total Inventario</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.totalInventoryValue || 0)}</div>
            <p className="text-xs text-muted-foreground">Todos los almacenes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Artículos Bajo Movimiento</CardTitle>
            <Boxes className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.lowMovementCount || 0}</div>
            <p className="text-xs text-muted-foreground">Candidatos a reducción o transferencia</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SKUs con Existencia</CardTitle>
            <Boxes className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats?.inventoryHealth?.skus_with_stock || 0)}</div>
            <p className="text-xs text-muted-foreground">de {formatNumber(stats?.inventoryHealth?.skus || 0)} SKUs totales</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Requisiciones Abiertas</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.openRequisitionsCount || 0}</div>
            <p className="text-xs text-muted-foreground">Pendientes o en tránsito</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transferencias en Periodo</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.transfersThisMonth || 0}</div>
            <p className="text-xs text-muted-foreground">Movimientos entre almacenes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sub-Almacenes con Stock</CardTitle>
            <Boxes className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.subWarehouseStats?.con_stock || 0}</div>
            <p className="text-xs text-muted-foreground">de {stats?.subWarehouseStats?.activos || 0} sub-almacenes activos</p>
          </CardContent>
        </Card>
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Consumo en Periodo</CardTitle>
            <ShoppingCart className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.consumoDia?.monto || 0)}</div>
            <p className="text-xs text-muted-foreground">{formatNumber(stats?.consumoDia?.piezas || 0)} piezas consumidas</p>
          </CardContent>
        </Card>
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Registros de Consumo</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats?.cargasConsumoHoy?.registros || 0)}</div>
            <p className="text-xs text-muted-foreground">{formatCurrency(stats?.cargasConsumoHoy?.monto || 0)} total registrado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Correcciones en Periodo</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber((stats?.correccionesDia?.ediciones || 0) + (stats?.correccionesDia?.borrados || 0))}</div>
            <p className="text-xs text-muted-foreground">Ediciones: {formatNumber(stats?.correccionesDia?.ediciones || 0)} · Borrados: {formatNumber(stats?.correccionesDia?.borrados || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cotizaciones Pendientes</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats?.cotizacionesPendientes?.total || 0)}</div>
            <p className="text-xs text-muted-foreground">Borrador · {formatCurrency(stats?.cotizacionesPendientes?.monto || 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row: Consumo 30 días + Inventario por almacén */}
      <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Consumo del Periodo Seleccionado</CardTitle>
            <CardDescription>Monto diario de consumo (MXN).</CardDescription>
          </CardHeader>
          <CardContent>
            {consumoChartData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
                Sin consumo en el periodo seleccionado.
              </div>
            ) : (
              <ChartContainer config={{}} className="h-[300px] w-full">
                <BarChart data={consumoChartData} margin={{ top: 10, right: 10, left: 14, bottom: 0 }} barCategoryGap="22%">
                  <defs>
                    <linearGradient id="consumoBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.85} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="dia" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, consumoAxisMax]} allowDecimals={false} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip cursor={false} content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value || 0))} />} />
                  <Bar dataKey="monto" name="Monto" fill="url(#consumoBarGradient)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Distribución de Inventario</CardTitle>
                <CardDescription>Valor estimado por almacén padre o sub-almacén.</CardDescription>
              </div>
              <div className="w-[220px]">
                <Select value={inventoryChartMode} onValueChange={(v: any) => setInventoryChartMode(v)}>
                  <SelectTrigger><SelectValue placeholder="Vista" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warehouse">Por Almacén Padre</SelectItem>
                    <SelectItem value="subwarehouse">Por Sub-Almacén</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {inventoryPieData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
                No hay distribución para mostrar en esta vista.
              </div>
            ) : (
              <div className="space-y-2">
                {showSubwarehouseConsumptionHint && (
                  <p className="text-xs text-muted-foreground">
                    Distribución estimada con consumo del periodo por sub-almacén.
                  </p>
                )}
                <ChartContainer config={{}} className="h-[300px] w-full">
                  <PieChart>
                    <Tooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                    <Pie
                      data={inventoryPieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={105}
                      minAngle={2}
                      paddingAngle={1}
                      labelLine={false}
                      strokeWidth={5}
                    >
                      {inventoryPieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top 5 Consumidos + Actividad Reciente */}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Alertas de Alto Consumo</CardTitle>
            <CardDescription>Artículos con mayor consumo en el periodo seleccionado.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Artículo</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Piezas</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(stats?.alertasConsumo7Dias || []).length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sin alertas por ahora</TableCell></TableRow>
                ) : (stats?.alertasConsumo7Dias || []).map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{item.numero_articulo}</TableCell>
                    <TableCell className="max-w-[220px] truncate">{item.descripcion}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.total_piezas)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.total_monto)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Top 5 artículos más consumidos */}
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Artículos Más Consumidos</CardTitle>
            <CardDescription>Artículos con mayor consumo este mes.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Artículo</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Piezas</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(stats?.topConsumo || []).length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sin datos de consumo este mes</TableCell></TableRow>
                ) : (stats?.topConsumo || []).map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{item.numero_articulo}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{item.descripcion}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.total_piezas)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.total_monto)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Actividad reciente (bar chart) */}
        <Card>
          <CardHeader>
            <CardTitle>Actividad Reciente</CardTitle>
            <CardDescription>Cantidad de artículos en requisiciones recientes.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivityData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
                Aún no hay requisiciones/traspasos para mostrar actividad.
              </div>
            ) : (
              <ChartContainer config={{}} className="h-[300px] w-full">
                <BarChart data={recentActivityData}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={false} content={<ChartTooltipContent />} />
                  <Bar dataKey="quantity" fill="hsl(var(--chart-2))" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transferencias recientes */}
      {stats?.recentTransfers && stats.recentTransfers.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Transferencias Recientes</CardTitle>
            <CardDescription>Últimas 5 transferencias entre almacenes completadas.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Artículo</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recentTransfers.map((t, i) => (
                  <TableRow key={i}>
                    <TableCell>{t.item_name}</TableCell>
                    <TableCell>{t.from_warehouse}</TableCell>
                    <TableCell>{t.to_warehouse}</TableCell>
                    <TableCell className="text-right">{t.quantity}</TableCell>
                    <TableCell>{new Date(t.transferred_at).toLocaleDateString("es-MX")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Últimas Requisiciones */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Últimas Requisiciones</CardTitle>
          <CardDescription>Últimas 10 requisiciones y transferencias.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Artículo</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(stats?.recentActivity || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">Sin movimientos recientes</TableCell>
                  </TableRow>
                ) : (stats?.recentActivity || []).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.request_id}</TableCell>
                    <TableCell>{r.type}</TableCell>
                    <TableCell>{r.item_name}</TableCell>
                    <TableCell className="text-right">{r.quantity}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "Completed" ? "default" : r.status === "Rejected" ? "destructive" : "secondary"}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(r.created_at).toLocaleDateString("es-MX")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
