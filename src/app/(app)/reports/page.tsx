"use client";

import { useEffect, useState, useCallback } from "react";
import { Line, LineChart, XAxis, YAxis, Tooltip, Bar, BarChart } from "recharts";
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
import { Skeleton } from "@/components/ui/skeleton";
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CalendarDays, RefreshCw, Boxes, DollarSign, FileText, ShoppingCart, ArrowRightLeft, TrendingUp, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";

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

const chartConfig: ChartConfig = {
  commission: {
    label: "Comisión",
    color: "hsl(var(--primary))",
  },
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat("es-MX").format(value);

type ReportsData = {
  movementDistribution: { movement: string; count: number; total_value: number }[];
  inventarioResumen: { total_skus: number; total_unidades: number; valor_total: number; skus_con_stock: number; skus_sin_stock: number; precio_promedio: number };
  cotizacionesResumen: { total_cotizaciones: number; borradores: number; enviadas: number; aceptadas: number; rechazadas: number; monto_total: number; monto_aceptado: number; monto_pendiente: number };
  requisicionesResumen: { total: number; abiertas: number; completadas: number; transferencias: number };
  warehouseReport: { warehouse: string; items: number; total_qty: number; total_value: number }[];
  requisitionsByStatus: { status: string; count: number }[];
  transfersByMonth: { month: string; transfers: number; items_moved: number }[];
  topItems: { descripcion: string; numero_articulo: string; warehouse: string; existencia: number; precio_traxion: number; precio_bisonte: number; total: number }[];
  commissionProjection: { reduction: number; commission: number }[];
  consumoMensual: { mes: string; total_piezas: number; total_monto: number }[];
  topConsumoArticulos: { numero_articulo: string; descripcion: string; total_piezas: number; total_monto: number }[];
  topConsumoConSub: { numero_articulo: string; descripcion: string; sub_almacen: string; total_piezas: number; total_monto: number }[];
  consumoPorAlmacen: { almacen: string; total_piezas: number; total_monto: number }[];
  consumoPorSubAlmacen: { sub_almacen: string; total_piezas: number; total_monto: number }[];
  comparativoStock: { numero_articulo: string; descripcion: string; consumo_3m: number; existencia_actual: number }[];
  correccionesResumen: { ediciones: number; borrados: number; total_afectado: number };
  correccionesPorUsuario: { usuario: string; ediciones: number; borrados: number; total: number }[];
  correccionesDetalle: { id: number; action: string; record_id: number | null; records_affected: number; changed_by: string; details: string | null; created_at: string }[];
};

const movementLabel: Record<string, string> = { High: "Alto", Medium: "Medio", Low: "Bajo" };
const movementColor: Record<string, "default" | "secondary" | "destructive"> = {
  High: "default",
  Medium: "secondary",
  Low: "destructive",
};

export default function ReportsPage() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [rangePreset, setRangePreset] = useState<RangePreset>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("rpt_preset") as RangePreset) || "30";
    }
    return "30";
  });
  const [fechaInicio, setFechaInicio] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rpt_fi");
      if (saved) return saved;
    }
    return getPresetRange(30).start;
  });
  const [fechaFin, setFechaFin] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rpt_ff");
      if (saved) return saved;
    }
    return getPresetRange(30).end;
  });

  const fetchReports = useCallback(async () => {
    try {
      setLoadError("");
      const params = new URLSearchParams();
      if (fechaInicio) params.set("fecha_inicio", fechaInicio);
      if (fechaFin) params.set("fecha_fin", fechaFin);
      const qs = params.toString();
      const res = await fetch(`/api/reports${qs ? `?${qs}` : ""}`);
      const json = await res.json();
      if (json.success) setData(json.data);
      else setLoadError(json?.error || "No se pudieron cargar los reportes");
    } catch {
      setLoadError("No se pudieron cargar los reportes");
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  useEffect(() => {
    if (rangePreset === "custom") return;
    const days = Number(rangePreset);
    const range = getPresetRange(days);
    setFechaInicio(range.start);
    setFechaFin(range.end);
  }, [rangePreset]);

  useEffect(() => {
    localStorage.setItem("rpt_preset", rangePreset);
    localStorage.setItem("rpt_fi", fechaInicio);
    localStorage.setItem("rpt_ff", fechaFin);
  }, [rangePreset, fechaInicio, fechaFin]);

  const formatDateRange = () => {
    if (!fechaInicio || !fechaFin) return "";
    const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
    return `${fmt(fechaInicio)} — ${fmt(fechaFin)}`;
  };

  const exportSection = (rows: any[], fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Reportes y Proyecciones" description="Reportes de salud de inventario, consumo y proyecciones." />
        <div className="grid gap-6 md:grid-cols-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[350px]" />)}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Reportes y Proyecciones" description="Reportes de salud de inventario, consumo y proyecciones." />

      {loadError && (
        <Card className="mb-6 border-destructive/40 bg-destructive/5">
          <CardContent className="py-3 flex items-center justify-between">
            <span className="text-sm text-destructive">{loadError}</span>
            <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchReports(); }}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Reintentar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Resumen Ejecutivo */}
      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total Inventario</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data?.inventarioResumen?.valor_total || 0)}</div>
            <p className="text-xs text-muted-foreground">{formatNumber(data?.inventarioResumen?.total_unidades || 0)} unidades en stock</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SKUs Registrados</CardTitle>
            <Boxes className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data?.inventarioResumen?.total_skus || 0)}</div>
            <p className="text-xs text-muted-foreground">{formatNumber(data?.inventarioResumen?.skus_con_stock || 0)} con stock · {formatNumber(data?.inventarioResumen?.skus_sin_stock || 0)} agotados</p>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Consumo del Periodo</CardTitle>
            <ShoppingCart className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency((data?.consumoMensual || []).reduce((acc, row) => acc + Number(row.total_monto || 0), 0))}
            </div>
            <p className="text-xs text-muted-foreground">{formatNumber((data?.consumoMensual || []).reduce((acc, row) => acc + Number(row.total_piezas || 0), 0))} piezas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Correcciones</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data?.correccionesResumen?.total_afectado || 0)}</div>
            <p className="text-xs text-muted-foreground">{formatNumber(data?.correccionesResumen?.ediciones || 0)} ediciones · {formatNumber(data?.correccionesResumen?.borrados || 0)} borrados</p>
          </CardContent>
        </Card>
      </div>

      {/* KPIs Secundarios: Cotizaciones y Requisiciones */}
      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cotizaciones</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data?.cotizacionesResumen?.total_cotizaciones || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {data?.cotizacionesResumen?.borradores || 0} borrador · {data?.cotizacionesResumen?.enviadas || 0} enviadas · {data?.cotizacionesResumen?.aceptadas || 0} aceptadas
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monto Cotizado</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data?.cotizacionesResumen?.monto_aceptado || 0)}</div>
            <p className="text-xs text-muted-foreground">Aceptado de {formatCurrency(data?.cotizacionesResumen?.monto_total || 0)} total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Requisiciones</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data?.requisicionesResumen?.total || 0)}</div>
            <p className="text-xs text-muted-foreground">{data?.requisicionesResumen?.abiertas || 0} abiertas · {data?.requisicionesResumen?.completadas || 0} completadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Precio Promedio</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data?.inventarioResumen?.precio_promedio || 0)}</div>
            <p className="text-xs text-muted-foreground">Precio Traxion promedio por artículo</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle>Filtros y Exportación</CardTitle>
          <CardDescription>Selecciona el periodo y exporta reportes.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <label className="text-xs text-muted-foreground">Rango</label>
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
            <label className="text-xs text-muted-foreground">Desde</label>
            <Input
              type="date"
              value={fechaInicio}
              onChange={(e) => { setRangePreset("custom"); setFechaInicio(e.target.value); }}
              className="w-[170px]"
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs text-muted-foreground">Hasta</label>
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
            <Button variant="ghost" size="sm" onClick={() => { setLoading(true); fetchReports(); }} title="Recargar datos">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRangePreset("30")}>Restablecer 30 días</Button>
            <Button variant="outline" size="sm" onClick={() => exportSection(data?.topConsumoArticulos || [], "reporte-consumo-filtrado")}>Exportar Consumo</Button>
            <Button variant="outline" size="sm" onClick={() => exportSection(data?.correccionesDetalle || [], "reporte-trazabilidad-correcciones")}>Exportar Trazabilidad</Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="inventario" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 max-w-[700px]">
          <TabsTrigger value="inventario">Inventario</TabsTrigger>
          <TabsTrigger value="consumo">Consumo</TabsTrigger>
          <TabsTrigger value="cotizaciones">Cotizaciones</TabsTrigger>
          <TabsTrigger value="operaciones">Operaciones</TabsTrigger>
        </TabsList>

        {/* ========== TAB: INVENTARIO ========== */}
        <TabsContent value="inventario" className="space-y-6">
          {/* KPI Row */}
          <div className="grid gap-4 md:grid-cols-3">
            {(data?.movementDistribution || []).map((m) => (
              <Card key={m.movement}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    Movimiento {movementLabel[m.movement] || m.movement}
                    <Badge variant={movementColor[m.movement] || "secondary"}>{m.count} artículos</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(m.total_value)}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Commission Projection */}
            <Card>
              <CardHeader>
                <CardTitle>Proyección de Comisión</CardTitle>
                <CardDescription>Comisión proyectada basada en reducción de inventario de bajo movimiento.</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <LineChart data={data?.commissionProjection || []} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <XAxis dataKey="reduction" tickFormatter={(v) => `${v}%`} stroke="#888888" fontSize={12} />
                    <YAxis tickFormatter={(v) => `$${(v as number).toLocaleString()}`} stroke="#888888" fontSize={12} />
                    <Tooltip cursor={false} content={<ChartTooltipContent formatter={(value) => formatCurrency(value as number)} labelFormatter={(label) => `Reducción: ${label}%`} />} />
                    <Line type="monotone" dataKey="commission" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Warehouse Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Inventario por Almacén</CardTitle>
                <CardDescription>Artículos, cantidades y valor por almacén.</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={{}} className="h-[300px] w-full">
                  <BarChart data={data?.warehouseReport || []}>
                    <XAxis dataKey="warehouse" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip cursor={false} content={<ChartTooltipContent />} />
                    <Bar dataKey="total_value" name="Valor" fill="hsl(var(--chart-1))" radius={4} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          {/* Top Items Table */}
          <Card>
            <CardHeader>
              <CardTitle>Top 10 Artículos de Mayor Valor</CardTitle>
              <CardDescription>Artículos con mayor valor total de inventario.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Núm. Artículo</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Almacén</TableHead>
                      <TableHead className="text-right">Existencia</TableHead>
                      <TableHead className="text-right">Precio Traxion</TableHead>
                      <TableHead className="text-right">Precio Bisonte</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.topItems || []).map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{item.numero_articulo}</TableCell>
                        <TableCell>{item.descripcion}</TableCell>
                        <TableCell>{item.warehouse}</TableCell>
                        <TableCell className="text-right">{item.existencia}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.precio_traxion)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.precio_bisonte)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(item.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== TAB: CONSUMO ========== */}
        <TabsContent value="consumo" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Consumo Mensual Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Consumo Mensual</CardTitle>
                <CardDescription>Monto de consumo por mes (últimos 6 meses).</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={{}} className="h-[300px] w-full">
                  <BarChart data={data?.consumoMensual || []}>
                    <XAxis dataKey="mes" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip cursor={false} content={<ChartTooltipContent />} />
                    <Bar dataKey="total_monto" name="Monto" fill="hsl(var(--primary))" radius={4} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Consumo por Almacén */}
            <Card>
              <CardHeader>
                <CardTitle>Consumo por Almacén</CardTitle>
                <CardDescription>Distribución de consumo por almacén (últimos 3 meses).</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={{}} className="h-[300px] w-full">
                  <BarChart data={data?.consumoPorAlmacen || []} layout="vertical">
                    <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="almacen" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} width={100} />
                    <Tooltip cursor={false} content={<ChartTooltipContent />} />
                    <Bar dataKey="total_monto" name="Monto" fill="hsl(var(--chart-2))" radius={4} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          {/* Top Consumo Artículos */}
          <Card>
            <CardHeader>
              <CardTitle>Top 10 Artículos Más Consumidos</CardTitle>
              <CardDescription>Artículos con mayor consumo en el periodo seleccionado.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Núm. Artículo</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Total Piezas</TableHead>
                      <TableHead className="text-right">Total Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.topConsumoArticulos || []).length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sin datos de consumo</TableCell></TableRow>
                    ) : (data?.topConsumoArticulos || []).map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{item.numero_articulo}</TableCell>
                        <TableCell>{item.descripcion}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.total_piezas)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.total_monto)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Consumo detallado con sub-almacén */}
          <Card>
            <CardHeader>
              <CardTitle>Consumo Detallado por Sub-Almacén</CardTitle>
              <CardDescription>Top artículos consumidos desglosados por sub-almacén.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Núm. Artículo</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Sub-Almacén</TableHead>
                      <TableHead className="text-right">Piezas</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.topConsumoConSub || []).length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sin datos</TableCell></TableRow>
                    ) : (data?.topConsumoConSub || []).map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{item.numero_articulo}</TableCell>
                        <TableCell>{item.descripcion}</TableCell>
                        <TableCell><Badge variant="secondary">{item.sub_almacen}</Badge></TableCell>
                        <TableCell className="text-right">{formatNumber(item.total_piezas)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.total_monto)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Consumo por Sub-Almacén</CardTitle>
              <CardDescription>Distribución de consumo por sub-almacén en el periodo seleccionado.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sub-Almacén</TableHead>
                      <TableHead className="text-right">Piezas</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.consumoPorSubAlmacen || []).length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Sin datos en el periodo</TableCell></TableRow>
                    ) : (data?.consumoPorSubAlmacen || []).map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{row.sub_almacen}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.total_piezas)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.total_monto)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Comparativo Existencia vs Consumo */}
          <Card>
            <CardHeader>
              <CardTitle>Comparativo: Existencia vs Consumo</CardTitle>
              <CardDescription>Existencia actual vs consumo acumulado de 3 meses (top 10 consumidos).</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[350px] w-full">
                <BarChart data={data?.comparativoStock || []}>
                  <XAxis dataKey="numero_articulo" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} angle={-20} textAnchor="end" height={60} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={false} content={<ChartTooltipContent />} />
                  <Bar dataKey="existencia_actual" name="Existencia" fill="hsl(var(--chart-1))" radius={4} />
                  <Bar dataKey="consumo_3m" name="Consumo 3M" fill="hsl(var(--chart-3))" radius={4} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Correcciones (Ediciones)</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{formatNumber(data?.correccionesResumen?.ediciones || 0)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Correcciones (Borrados)</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{formatNumber(data?.correccionesResumen?.borrados || 0)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Registros Afectados</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{formatNumber(data?.correccionesResumen?.total_afectado || 0)}</div></CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Resumen por Usuario (Sube/Edita)</CardTitle>
              <CardDescription>Totales de ediciones y borrados por usuario.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead className="text-right">Ediciones</TableHead>
                    <TableHead className="text-right">Borrados</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.correccionesPorUsuario || []).length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sin correcciones en el rango seleccionado</TableCell></TableRow>
                  ) : (data?.correccionesPorUsuario || []).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row.usuario || "system"}</TableCell>
                      <TableCell className="text-right">{formatNumber(row.ediciones)}</TableCell>
                      <TableCell className="text-right">{formatNumber(row.borrados)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatNumber(row.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trazabilidad de Cambios en Consumo</CardTitle>
              <CardDescription>Incluye datos antes/después cuando están disponibles.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Acción</TableHead>
                      <TableHead>Registro</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead className="text-right">Afectados</TableHead>
                      <TableHead>Detalle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.correccionesDetalle || []).length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sin trazabilidad en el rango seleccionado</TableCell></TableRow>
                    ) : (data?.correccionesDetalle || []).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{new Date(row.created_at).toLocaleString("es-MX")}</TableCell>
                        <TableCell>
                          <Badge variant={row.action === "delete" ? "destructive" : "secondary"}>{row.action}</Badge>
                        </TableCell>
                        <TableCell>{row.record_id ?? "-"}</TableCell>
                        <TableCell>{row.changed_by || "system"}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.records_affected)}</TableCell>
                        <TableCell className="max-w-[420px] truncate">{row.details || "Sin detalle"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== TAB: COTIZACIONES ========== */}
        <TabsContent value="cotizaciones" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Cotizaciones</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(data?.cotizacionesResumen?.total_cotizaciones || 0)}</div>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Borradores</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(data?.cotizacionesResumen?.borradores || 0)}</div>
                <p className="text-xs text-muted-foreground">{formatCurrency(data?.cotizacionesResumen?.monto_pendiente || 0)}</p>
              </CardContent>
            </Card>
            <Card className="border-green-200 bg-green-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Aceptadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(data?.cotizacionesResumen?.aceptadas || 0)}</div>
                <p className="text-xs text-muted-foreground">{formatCurrency(data?.cotizacionesResumen?.monto_aceptado || 0)}</p>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Rechazadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(data?.cotizacionesResumen?.rechazadas || 0)}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Monto por Estatus</CardTitle>
                <CardDescription>Distribución de montos cotizados por estado.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { label: "Aceptado", value: data?.cotizacionesResumen?.monto_aceptado || 0, color: "bg-green-500" },
                    { label: "Pendiente (Borrador)", value: data?.cotizacionesResumen?.monto_pendiente || 0, color: "bg-amber-500" },
                    { label: "Total Cotizado", value: data?.cotizacionesResumen?.monto_total || 0, color: "bg-primary" },
                  ].map((item) => (
                    <div key={item.label} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{item.label}</span>
                        <span className="font-semibold">{formatCurrency(item.value)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${item.color}`}
                          style={{ width: `${(data?.cotizacionesResumen?.monto_total || 0) > 0 ? Math.min((item.value / (data?.cotizacionesResumen?.monto_total || 1)) * 100, 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resumen de Estado</CardTitle>
                <CardDescription>Distribución de cotizaciones por estatus.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { label: "Borrador", count: data?.cotizacionesResumen?.borradores || 0, variant: "secondary" as const },
                    { label: "Enviadas", count: data?.cotizacionesResumen?.enviadas || 0, variant: "outline" as const },
                    { label: "Aceptadas", count: data?.cotizacionesResumen?.aceptadas || 0, variant: "default" as const },
                    { label: "Rechazadas", count: data?.cotizacionesResumen?.rechazadas || 0, variant: "destructive" as const },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <Badge variant={item.variant}>{item.label}</Badge>
                      <span className="text-2xl font-bold">{item.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ========== TAB: OPERACIONES ========== */}
        <TabsContent value="operaciones" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Transfers by Month */}
            {data?.transfersByMonth && data.transfersByMonth.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Transferencias Mensuales</CardTitle>
                  <CardDescription>Volumen de transferencias en los últimos 6 meses.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={{}} className="h-[300px] w-full">
                    <BarChart data={data.transfersByMonth}>
                      <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip cursor={false} content={<ChartTooltipContent />} />
                      <Bar dataKey="items_moved" name="Artículos Movidos" fill="hsl(var(--chart-2))" radius={4} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}

            {/* Requisitions by Status */}
            <Card>
              <CardHeader>
                <CardTitle>Requisiciones por Estado</CardTitle>
                <CardDescription>Desglose de todas las requisiciones.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(data?.requisitionsByStatus || []).map((s) => (
                    <div key={s.status} className="flex items-center justify-between">
                      <Badge variant={s.status === "Completed" ? "default" : s.status === "Rejected" ? "destructive" : "secondary"}>
                        {s.status}
                      </Badge>
                      <span className="text-2xl font-bold">{s.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
