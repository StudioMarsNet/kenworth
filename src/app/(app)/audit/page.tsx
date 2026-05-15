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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ScrollText, Shield, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type AuditRow = {
  id: number;
  user_id: number | null;
  username: string;
  action: string;
  module: string;
  details: string | null;
  ip_address: string | null;
  created_at: string;
};

function getUserFromCookie(): { id: number; role: string } | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith("user_info="));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match.split("=").slice(1).join("=")));
  } catch {
    return null;
  }
}

const moduleBadgeColors: Record<string, string> = {
  consumption: "bg-blue-100 text-blue-800",
  quotes: "bg-green-100 text-green-800",
  requisitions: "bg-purple-100 text-purple-800",
  transfers: "bg-orange-100 text-orange-800",
  inventory: "bg-yellow-100 text-yellow-800",
  users: "bg-red-100 text-red-800",
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: number; role: string } | null>(null);
  const { toast } = useToast();

  const [filterModule, setFilterModule] = useState("all");
  const [filterUsername, setFilterUsername] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterModule && filterModule !== "all") params.set("module", filterModule);
      if (filterUsername) params.set("username", filterUsername);
      if (filterDateFrom) params.set("fecha_inicio", filterDateFrom);
      if (filterDateTo) params.set("fecha_fin", filterDateTo);

      const res = await fetch(`/api/audit?${params.toString()}`);
      const data = await res.json();
      if (data.success) setLogs(data.data);
      else if (res.status === 403) {
        toast({ variant: "destructive", title: "Acceso denegado", description: "Solo administradores y gerentes pueden ver la bitácora." });
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Error al cargar bitácora" });
    } finally {
      setLoading(false);
    }
  }, [filterModule, filterUsername, filterDateFrom, filterDateTo, toast]);

  useEffect(() => {
    setCurrentUser(getUserFromCookie());
    fetchLogs();
  }, [fetchLogs]);

  if (currentUser && currentUser.role !== "admin" && currentUser.role !== "gerente") {
    return (
      <>
        <PageHeader title="Bitácora de Acciones" description="No tienes permisos para acceder a esta sección." />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Shield className="h-12 w-12 mb-4" />
            <p className="text-lg font-medium">Acceso restringido</p>
            <p className="text-sm">Solo administradores y gerentes pueden ver la bitácora.</p>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Bitácora de Acciones" description="Historial de acciones críticas del sistema." />

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Label>Módulo:</Label>
              <Select value={filterModule} onValueChange={setFilterModule}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="consumption">Consumo</SelectItem>
                  <SelectItem value="quotes">Cotizaciones</SelectItem>
                  <SelectItem value="requisitions">Requisiciones</SelectItem>
                  <SelectItem value="transfers">Traspasos</SelectItem>
                  <SelectItem value="inventory">Inventario</SelectItem>
                  <SelectItem value="users">Usuarios</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label>Usuario:</Label>
              <Input className="w-40" placeholder="Buscar..." value={filterUsername} onChange={(e) => setFilterUsername(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Label>Desde:</Label>
              <Input type="date" className="w-40" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Label>Hasta:</Label>
              <Input type="date" className="w-40" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
            </div>
            <Button onClick={fetchLogs} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Filtrar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Registros ({logs.length})</CardTitle>
          <CardDescription>Últimas acciones registradas en el sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ScrollText className="h-10 w-10 mb-3" />
              <p className="text-lg font-medium">Sin registros</p>
              <p className="text-sm">No se encontraron acciones con los filtros aplicados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Módulo</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Detalles</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("es-MX")}
                      </TableCell>
                      <TableCell>{log.username}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={moduleBadgeColors[log.module] || ""}>
                          {log.module}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{log.action}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">
                        {log.details || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
