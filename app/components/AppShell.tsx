"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  Home,
  MapPinned,
  ShoppingCart,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

const menu = [
  { label: "Início", href: "/", icon: Home, enabled: true },
  { label: "Clientes", href: "/clientes", icon: Users, enabled: true },
  { label: "Rotas", href: "#", icon: MapPinned, enabled: false },
  { label: "Visitas", href: "/visitas", icon: ClipboardCheck, enabled: true },
  { label: "Vendas", href: "#", icon: ShoppingCart, enabled: false },
  { label: "Agenda", href: "#", icon: CalendarDays, enabled: false },
  { label: "Relatórios", href: "#", icon: BarChart3, enabled: false },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">T</div>
          <div>
            <strong>TORRES</strong>
            <span>Gestor Comercial</span>
          </div>
        </div>

        <nav>
          {menu.map(({ label, href, icon: Icon, enabled }) => {
            const active =
              enabled &&
              (href === "/" ? pathname === "/" : pathname.startsWith(href));

            if (!enabled) {
              return (
                <span className="navDisabled" key={label} title="Em breve">
                  <Icon size={20} />
                  {label}
                </span>
              );
            }

            return (
              <Link className={active ? "active" : ""} href={href} key={label}>
                <Icon size={20} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="company">
          <small>EMPRESA ATIVA</small>
          <strong>Torres Multi Representações</strong>
          <span>Administrador</span>
        </div>
      </aside>

      <section className="content">{children}</section>
    </main>
  );
}
