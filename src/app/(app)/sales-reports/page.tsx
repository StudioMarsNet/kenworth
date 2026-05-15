"use client";

import { useState, useEffect, useCallback } from "react";
import { BarChart3, TrendingUp, Package, FileCheck, RefreshCw, Search, Filter, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const ALL_ESTADOS = [
  "Devuelta",
  "Facturada",
  "Impresa",
  "Parcialmente Devuelta",
  "Parcialmente Devuelta y Parcialmente Facturada",
  "Parcialmente Facturada",
  "Sin Imprimir",
];

type Stats = {
  kpis: Record<string, number>;
  porEstado: { estado_venta: string; count: number; cantidad: number }[];
  porMes: { mes: string; count: number; cantidad: number }[];
  topArticulos: { numero_articulo: string; descripcion: string; cantidad_total: number; num_transacciones: number }[];
  topUsuarios: { usuario_alta: string; count: number; cantidad: number }[];
};

type Venta = {
  id: number;
  numero_articulo: string;
  descripcion: string;
  cantidad_surtida: number;
  cantidad_por_facturar: number;
  id_docto_cargo: number;
  folio_factura: string;
  serie_factura: string;
  estado_venta: string;
  fecha: string;
  usuario_alta: string;
  oc_cliente: string;
  tiene_rescate: number;
};

const PIE_COLORS = ["#22c55e","#3b82f6","#a855f7","#f59e0b","#f97316","#ef4444","#6b7280"];

function estadoBadge(e: string) {
  if (!e) return <Badge variant="secondary">—</Badge>;
  if (e === "Facturada") return <Badge className="bg-green-500/15 text-green-400 border-green-500/30 border text-xs">{e}</Badge>;
  if (e === "Devuelta") return <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 border text-xs">{e}</Badge>;
  if (e === "Impresa") return <Badge className="bg-purple-500/15 text-purple-400 border-purple-500/30 border text-xs">{e}</Badge>;
  if (e === "Sin Imprimir") return <Badge className="bg-red-500/15 text-red-400 border-red-500/30 border text-xs">{e}</Badge>;
  if (e.includes("Parcialmente")) return <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 border text-xs">Parcial</Badge>;
  return <Badge variant="outline" className="text-xs">{e}</Badge>;
}

function KpiCard({ label, value, sub, icon: Icon, color }: { label: string; value: string|number; sub?: string; icon: any; color: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 flex gap-3 items-start">
      <div className={`p-2 rounded-lg ${color}`}><Icon className="h-5 w-5" /></div>
      <div>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
        {sub && <div className="text-xs text-muted-foreground/70 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

const fmtMes = (m: string) => {
  const [y, mo] = m.split("-");
  return `${["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][parseInt(mo)-1]} ${y.slice(2)}`;
};

export default function SalesReportsPage() {
  const [stats, setStats] = useState<Stats|null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingVentas, setLoadingVentas] = useState(false);
  const [q, setQ] = useState("");
  const [filterEstado, setFilterEstado] = useState("all");
  const [filterUsuario, setFilterUsuario] = useState("all");
  const [filterFechaDesde, setFilterFechaDesde] = useState("");
  const [filterFechaHasta, setFilterFechaHasta] = useState("");
  const LIMIT = 50;

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await fetch("/api/sales-report/stats");
      const json = await res.json();
      if (json.success) setStats(json.data);
    } finally { setLoadingStats(false); }
  }, []);

  const fetchVentas = useCallback(async () => {
    setLoadingVentas(true);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (q) params.set("q", q);
    if (filterEstado !== "all") params.set("estado", filterEstado);
    if (filterUsuario !== "all") params.set("usuario", filterUsuario);
    if (filterFechaDesde) params.set("fecha_desde", filterFechaDesde);
    if (filterFechaHasta) params.set("fecha_hasta", filterFechaHasta);
    try {
      const res = await fetch(`/api/sales-report?${params}`);
      const json = await res.json();
      if (json.success) { setVentas(json.data); setTotal(json.pagination.total); }
    } finally { setLoadingVentas(false); }
  }, [page, q, filterEstado, filterUsuario, filterFechaDesde, filterFechaHasta]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchVentas(); }, [fetchVentas]);

  const pages = Math.ceil(total / LIMIT);
  const kpis = stats?.kpis;
  const uniqueUsuarios = stats?.topUsuarios.map(u => u.usuario_alta) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <BarChart3 className="h-6 w-6 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reportes y Análisis de Ventas</h1>
          <p className="text-sm text-muted-foreground">Consigna Kenworth · Bisonte SLP — Actualizado al 14/05/2026</p>
        </div>
        <Button variant="outline" size="icon" className="ml-auto" onClick={() => { fetchStats(); fetchVentas(); }}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* KPIs */}
      {loadingStats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_,i) => <div key={i} className="h-24 rounded-xl border bg-card animate-pulse" />)}
        </div>
      ) : kpis ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Total registros" value={Number(kpis.total_registros).toLocaleString()} sub={`${kpis.total_documentos} documentos únicos`} icon={Package} color="bg-indigo-500/10 text-indigo-400" />
          <KpiCard label="Cantidad surtida total" value={Number(kpis.total_cantidad_surtida).toLocaleString()} sub="Piezas / unidades" icon={TrendingUp} color="bg-green-500/10 text-green-400" />
          <KpiCard label="Facturadas" value={Number(kpis.facturadas).toLocaleString()} sub={`${kpis.con_factura} con folio de factura`} icon={FileCheck} color="bg-emerald-500/10 text-emerald-400" />
          <KpiCard label="Artículos distintos" value={Number(kpis.total_articulos_distintos).toLocaleString()} sub={`${kpis.sin_imprimir} sin imprimir · ${kpis.parciales} parciales`} icon={BarChart3} color="bg-purple-500/10 text-purple-400" />
        </div>
      ) : null}

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 rounded-xl border bg-card p-4">
          <div className="font-semibold text-sm mb-4">Actividad Mensual — Registros de venta</div>
          {stats?.porMes?.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.porMes} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tickFormatter={fmtMes} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} labelFormatter={fmtMes} />
                <Bar dataKey="count" fill="#6366f1" radius={[4,4,0,0]} name="Registros" />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>}
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="font-semibold text-sm mb-4">Distribución por Estado</div>
          {stats?.porEstado?.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={stats.porEstado} dataKey="count" nameKey="estado_venta" cx="50%" cy="50%" outerRadius={75} innerRadius={40}>
                  {stats.porEstado.map((_,i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>}
        </div>
      </div>

      {/* Top artículos */}
      {stats?.topArticulos?.length ? (
        <div className="rounded-xl border bg-card p-4">
          <div className="font-semibold text-sm mb-4">Top 15 Artículos por Cantidad Surtida</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.topArticulos} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis type="category" dataKey="numero_articulo" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={90} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                formatter={(v: any, _: any, { payload }: any) => [`${v} uds`, payload.descripcion?.slice(0, 40)]} />
              <Bar dataKey="cantidad_total" fill="#f59e0b" radius={[0,4,4,0]} name="Cantidad" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      {/* Table */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Detalle de Registros</span>
          <Badge variant="outline" className="ml-1">{total.toLocaleString()}</Badge>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Artículo, descripción, folio…" className="pl-9" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} />
          </div>
          <Select value={filterEstado} onValueChange={v => { setFilterEstado(v); setPage(1); }}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Estado de venta" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {ALL_ESTADOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterUsuario} onValueChange={v => { setFilterUsuario(v); setPage(1); }}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Usuario" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los usuarios</SelectItem>
              {uniqueUsuarios.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" className="w-36" value={filterFechaDesde} onChange={e => { setFilterFechaDesde(e.target.value); setPage(1); }} />
          <Input type="date" className="w-36" value={filterFechaHasta} onChange={e => { setFilterFechaHasta(e.target.value); setPage(1); }} />
        </div>

        <div className="rounded-xl border overflow-x-auto">
          <table className="w-full text-sm min-w-[1000px]">
            <thead>
              <tr className="border-b bg-muted/30">
                {["Artículo","Descripción","Surtida","Por facturar","Folio Doc.","Factura","Estado","Usuario","Fecha","Rescate","OC"].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingVentas ? (
                <tr><td colSpan={11} className="text-center py-16 text-muted-foreground">Cargando…</td></tr>
              ) : ventas.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-16 text-muted-foreground">Sin resultados</td></tr>
              ) : ventas.map(v => (
                <tr key={v.id} className="border-b hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2 font-mono text-xs">{v.numero_articulo}</td>
                  <td className="px-3 py-2 max-w-[180px] truncate text-xs" title={v.descripcion}>{v.descripcion}</td>
                  <td className="px-3 py-2 text-center text-xs">{v.cantidad_surtida}</td>
                  <td className="px-3 py-2 text-center text-xs">
                    {v.cantidad_por_facturar > 0 ? <span className="text-yellow-400 font-semibold">{v.cantidad_por_facturar}</span> : <span className="text-muted-foreground">0</span>}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{v.id_docto_cargo}</td>
                  <td className="px-3 py-2 font-mono text-xs">{v.folio_factura ? `${v.folio_factura} ${v.serie_factura||""}` : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2">{estadoBadge(v.estado_venta)}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{v.usuario_alta}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{v.fecha?.slice(0,10)}</td>
                  <td className="px-3 py-2 text-center">
                    {v.tiene_rescate > 0 ? <span title="Tiene rescate enlazado"><Link2 className="h-3.5 w-3.5 text-orange-400 inline" /></span> : <span className="text-muted-foreground/40">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs">{v.oc_cliente||"—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Mostrando {((page-1)*LIMIT)+1}–{Math.min(page*LIMIT,total)} de {total.toLocaleString()}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page===1} onClick={() => setPage(p => p-1)}>Anterior</Button>
              <span className="flex items-center px-2 text-muted-foreground">{page}/{pages}</span>
              <Button variant="outline" size="sm" disabled={page>=pages} onClick={() => setPage(p => p+1)}>Siguiente</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
