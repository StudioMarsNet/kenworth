"use client";

import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import { getForecast } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, Bot, Sparkles, Lightbulb, TrendingUp, Package, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const initialState = {
  predictedCommissionImpact: "",
  error: "",
};

type ConsumptionSummary = {
  numero_articulo: string;
  descripcion: string;
  warehouse_name: string;
  total_cantidad: number;
  total_monto: number;
  dias: number;
  promedio_diario: number;
};

function SubmitButton() {
  return (
    <Button type="submit" className="w-full">
      <Sparkles className="mr-2 h-4 w-4" />
      Forecast Impact
    </Button>
  );
}

export function ForecastForm() {
  const [state, formAction] = useActionState(getForecast, initialState);
  const { toast } = useToast();

  // Real consumption data
  const [consumptionData, setConsumptionData] = useState<ConsumptionSummary[]>([]);
  const [loadingConsumption, setLoadingConsumption] = useState(false);
  const [scenario, setScenario] = useState<"base" | "optimista" | "pesimista">("base");
  const [warehouses, setWarehouses] = useState<{ id: number; name: string }[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("all");
  const [daysBack, setDaysBack] = useState("30");

  useEffect(() => {
    if (state.error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: state.error,
      });
    }
  }, [state.error, toast]);

  // Load warehouses
  useEffect(() => {
    fetch("/api/warehouses")
      .then((r) => r.json())
      .then((d) => { if (d.success) setWarehouses(d.data); })
      .catch(() => {});
  }, []);

  // Load real consumption summary
  const loadConsumption = useCallback(async () => {
    setLoadingConsumption(true);
    try {
      const params = new URLSearchParams();
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - Number(daysBack));
      params.set("fecha_inicio", startDate.toISOString().split("T")[0]);
      params.set("fecha_fin", endDate.toISOString().split("T")[0]);
      if (selectedWarehouse !== "all") params.set("warehouse_id", selectedWarehouse);

      const res = await fetch(`/api/consumption?${params.toString()}`);
      const data = await res.json();

      if (data.success && Array.isArray(data.data)) {
        // Aggregate by article + warehouse
        const map = new Map<string, ConsumptionSummary>();
        for (const row of data.data) {
          const key = `${row.numero_articulo}||${row.warehouse_id}`;
          const existing = map.get(key);
          if (existing) {
            existing.total_cantidad += Number(row.cantidad);
            existing.total_monto += Number(row.cantidad) * Number(row.precio_unitario);
            existing.dias = Number(daysBack);
            existing.promedio_diario = existing.total_cantidad / Number(daysBack);
          } else {
            map.set(key, {
              numero_articulo: row.numero_articulo,
              descripcion: row.descripcion,
              warehouse_name: row.warehouse_name || `Almacén ${row.warehouse_id}`,
              total_cantidad: Number(row.cantidad),
              total_monto: Number(row.cantidad) * Number(row.precio_unitario),
              dias: Number(daysBack),
              promedio_diario: Number(row.cantidad) / Number(daysBack),
            });
          }
        }
        setConsumptionData(Array.from(map.values()).sort((a, b) => b.total_cantidad - a.total_cantidad));
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Error al cargar consumo" });
    } finally {
      setLoadingConsumption(false);
    }
  }, [daysBack, selectedWarehouse, toast]);

  // Scenario multipliers
  const scenarioMultiplier = useMemo(() => {
    switch (scenario) {
      case "optimista": return 1.2;
      case "pesimista": return 0.8;
      default: return 1.0;
    }
  }, [scenario]);

  // Build CSV from real data for AI forecast
  const buildHistoricalCSV = useCallback(() => {
    if (consumptionData.length === 0) return "";
    const lines = ["Articulo,Almacen,CantidadTotal,PromediodiarioDiario,ProyeccionMensual,Escenario"];
    for (const item of consumptionData) {
      const projected = Math.round(item.promedio_diario * 30 * scenarioMultiplier);
      lines.push(`${item.numero_articulo},${item.warehouse_name},${item.total_cantidad},${item.promedio_diario.toFixed(2)},${projected},${scenario}`);
    }
    return lines.join("\n");
  }, [consumptionData, scenarioMultiplier, scenario]);

  // Generate requisition suggestions
  const requisitionSuggestions = useMemo(() => {
    return consumptionData
      .filter((item) => item.promedio_diario * 30 * scenarioMultiplier > item.total_cantidad * 0.5)
      .map((item) => ({
        ...item,
        suggested_qty: Math.ceil(item.promedio_diario * 30 * scenarioMultiplier),
      }))
      .slice(0, 10);
  }, [consumptionData, scenarioMultiplier]);

  const createRequisitionFromForecast = async (item: ConsumptionSummary & { suggested_qty: number }) => {
    // This would require knowing the item_id - for now show a toast with suggestion
    toast({
      title: "Sugerencia de requisición",
      description: `Artículo ${item.numero_articulo}: solicitar ${item.suggested_qty} unidades para ${item.warehouse_name}`,
    });
  };

  let isPending = false;

  return (
    <div className="space-y-6">
      {/* Real consumption analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Análisis de Consumo Real
          </CardTitle>
          <CardDescription>Carga datos de consumo histórico para proyecciones basadas en datos reales.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Label>Últimos:</Label>
              <Select value={daysBack} onValueChange={setDaysBack}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 días</SelectItem>
                  <SelectItem value="15">15 días</SelectItem>
                  <SelectItem value="30">30 días</SelectItem>
                  <SelectItem value="60">60 días</SelectItem>
                  <SelectItem value="90">90 días</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label>Almacén:</Label>
              <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label>Escenario:</Label>
              <Select value={scenario} onValueChange={(v) => setScenario(v as "base" | "optimista" | "pesimista")}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="optimista">Optimista (+20%)</SelectItem>
                  <SelectItem value="base">Base</SelectItem>
                  <SelectItem value="pesimista">Pesimista (-20%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={loadConsumption} disabled={loadingConsumption}>
              {loadingConsumption ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-2 h-4 w-4" />}
              Cargar Datos
            </Button>
          </div>

          {consumptionData.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Artículo</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Almacén</TableHead>
                    <TableHead className="text-right">Consumo Total</TableHead>
                    <TableHead className="text-right">Prom. Diario</TableHead>
                    <TableHead className="text-right">Proyección 30d</TableHead>
                    <TableHead>Escenario</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consumptionData.slice(0, 20).map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{item.numero_articulo}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{item.descripcion}</TableCell>
                      <TableCell>{item.warehouse_name}</TableCell>
                      <TableCell className="text-right">{item.total_cantidad}</TableCell>
                      <TableCell className="text-right">{item.promedio_diario.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {Math.round(item.promedio_diario * 30 * scenarioMultiplier)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={scenario === "optimista" ? "default" : scenario === "pesimista" ? "destructive" : "secondary"}>
                          {scenario}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Requisition suggestions from forecast */}
      {requisitionSuggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" /> Sugerencias de Requisición
            </CardTitle>
            <CardDescription>Artículos con alta proyección de consumo que podrían necesitar reabastecimiento.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Artículo</TableHead>
                    <TableHead>Almacén</TableHead>
                    <TableHead className="text-right">Prom. Diario</TableHead>
                    <TableHead className="text-right">Sugerido</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requisitionSuggestions.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{item.numero_articulo}</TableCell>
                      <TableCell>{item.warehouse_name}</TableCell>
                      <TableCell className="text-right">{item.promedio_diario.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">{item.suggested_qty}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => createRequisitionFromForecast(item)}>
                          Crear Requisición
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Forecast (original) */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <form action={formAction}>
            <CardHeader>
              <CardTitle>AI Trend Forecasting</CardTitle>
              <CardDescription>
                Use historical data and proposed adjustments to predict commission impact.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="historicalSalesData">
                  Historical Sales Data (CSV Format)
                </Label>
                <Textarea
                  id="historicalSalesData"
                  name="historicalSalesData"
                  placeholder="Paste your historical sales data here...&#10;ProductID,SalesDate,QuantitySold,SellingPrice&#10;P001,2024-01-15,10,125&#10;P002,2024-01-16,5,250"
                  className="min-h-[150px] font-mono text-xs"
                  defaultValue={buildHistoricalCSV()}
                  required
                />
                {consumptionData.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Se cargaron automáticamente {consumptionData.length} registros de consumo real.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="inventoryAdjustments">
                  Proposed Inventory Adjustments
                </Label>
                <Textarea
                  id="inventoryAdjustments"
                  name="inventoryAdjustments"
                  placeholder="Describe your proposed changes...&#10;e.g., Transfer 5 units of P003 from Exclusa to Bisonte."
                  className="min-h-[100px]"
                  required
                />
              </div>
            </CardContent>
            <CardFooter>
              <SubmitButton />
            </CardFooter>
          </form>
        </Card>
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-6 w-6" /> AI Analysis
            </CardTitle>
            <CardDescription>
              The predicted impact on your commissions will appear here.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {isPending && !state.predictedCommissionImpact && !state.error && (
              <div className="space-y-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            )}
            {state.predictedCommissionImpact && (
              <Alert>
                <Lightbulb className="h-4 w-4" />
                <AlertTitle>Analysis Complete</AlertTitle>
                <AlertDescription className="prose prose-sm dark:prose-invert whitespace-pre-wrap">
                  {state.predictedCommissionImpact}
                </AlertDescription>
              </Alert>
            )}
            {!isPending && !state.predictedCommissionImpact && !state.error && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg">
                <Sparkles className="h-10 w-10 mb-4" />
                <p>Your forecast results will be displayed here.</p>
                <p className="text-xs mt-1">Fill out the form to get started.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
