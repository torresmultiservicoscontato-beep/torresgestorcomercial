"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  Home,
  LogOut,
  MapPinned,
  ShoppingCart,
  Users,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

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
  const router = useRouter();
  const [estadoAcesso, setEstadoAcesso] = useState<
    "verificando" | "autenticado" | "sem-acesso"
  >("verificando");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!supabase) {
      setEstadoAcesso("sem-acesso");
      router.replace("/login");
      return;
    }

    let ativo = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return;

      if (data.session?.user) {
        setEmail(data.session.user.email ?? "Usuário autenticado");
        setEstadoAcesso("autenticado");
      } else {
        setEstadoAcesso("sem-acesso");
        router.replace("/login");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evento, session) => {
      if (!ativo) return;

      if (session?.user) {
        setEmail(session.user.email ?? "Usuário autenticado");
        setEstadoAcesso("autenticado");
      } else {
        setEmail("");
        setEstadoAcesso("sem-acesso");
        router.replace("/login");
      }
    });

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, [router]);

  async function sair() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (estadoAcesso !== "autenticado") {
    return (
      <main className="authLoading">
        <div className="brandMark">T</div>
        <strong>Verificando acesso...</strong>
      </main>
    );
  }

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
          <span className="userEmail">{email}</span>
          <button className="logoutButton" type="button" onClick={sair}>
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      <section className="content">{children}</section>
    </main>
  );
}
