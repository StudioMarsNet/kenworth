"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Boxes,
  ArrowRightLeft,
  ClipboardList,
  FileText,
  Bot,
  Users,
  DollarSign,
  Receipt,
  ScrollText,
  Warehouse,
  Truck,
  BarChart3,
} from "lucide-react";

const baseNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventario", icon: Boxes },
  { href: "/subalmacenes", label: "Sub-Almacenes", icon: Warehouse },
  { href: "/pricing", label: "Precios", icon: DollarSign },
  { href: "/quotes", label: "Cotizaciones", icon: Receipt },
  { href: "/requisitions", label: "Requisiciones", icon: ClipboardList },
  { href: "/transfers", label: "Traspasos", icon: ArrowRightLeft },
  { href: "/reports", label: "Reportes", icon: FileText },
  { href: "/forecast", label: "AI Forecast", icon: Bot },
  { href: "/rescues", label: "Gestión de Rescates", icon: Truck },
  { href: "/sales-reports", label: "Reportes de Ventas", icon: BarChart3 },
];

const adminNavItems = [
  { href: "/users", label: "Usuarios", icon: Users },
  { href: "/audit", label: "Bitácora", icon: ScrollText },
];

function getUserRole(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith("user_info="));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match.split("=").slice(1).join("="))).role;
  } catch {
    return null;
  }
}

export function MainNav() {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    setRole(getUserRole());
  }, []);

  const navItems = role === "admin" || role === "gerente"
    ? [...baseNavItems, ...adminNavItems]
    : baseNavItems;

  return (
    <SidebarMenu>
      {navItems.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            asChild
            isActive={
              item.href === "/dashboard"
                ? pathname === item.href
                : pathname.startsWith(item.href)
            }
            tooltip={{ children: item.label, side: "right" }}
          >
            <Link href={item.href}>
              <item.icon />
              <span>{item.label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
