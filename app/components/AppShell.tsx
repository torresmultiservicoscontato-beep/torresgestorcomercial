"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  Home,
  LogOut,
  MapPinned,
  Settings,
  ShieldCheck,
  ShoppingCart,
  UserRoundCog,
  Users,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { carregarAcessoAtual, pode, type AcessoSistema } from "../lib/acesso";
import {
  limparRepresentanteAdministrado,
  obterRepresentanteAdministrado,
  type RepresentanteAdministrado,
} from "../lib/adminContext";
import { supabase } from "../lib/supabase";

const operacionais = [
  { label: "Início", href: "/", icon: Home, modulo: "inicio", enabled: true },
  { label: "Clientes", href: "/clientes", icon: Users, modulo: "clientes", enabled: true },
  { label: "Rotas", href: "#", icon: MapPinned, modulo: "rotas", enabled: false },
  { label: "Visitas", href: "/visitas", icon: ClipboardCheck, modulo: "visitas", enabled: true },
  { label: "Vendas", href: "#", icon: ShoppingCart, modulo: "vendas", enabled: false },
  { label: "Agenda", href: "#", icon: CalendarDays, modulo: "agenda", enabled: false },
  { label: "Relatórios", href: "#", icon: BarChart3, modulo: "relatorios", enabled: false },
];

function redirecionar(destino: string) {
  window.location.replace(destino);
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [estadoAcesso, setEstadoAcesso] = useState<"verificando" | "autenticado" | "sem-acesso">("verificando");
  const [email, setEmail] = useState("");
  const [acesso, setAcesso] = useState<AcessoSistema | null>(null);
  const [representanteAdministrado, setRepresentanteAdministrado] = useState<RepresentanteAdministrado | null>(null);

  useEffect(() => {
    if (!supabase) {
      setEstadoAcesso("sem-acesso");
      redirecionar("/login");
      return;
    }

    let ativo = true;

    async function autenticar() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!ativo) return;
      if (error || !user) {
        setEstadoAcesso("sem-acesso");
        redirecionar("/login");
        return;
      }

      if (user.user_metadata?.must_change_password) {
        redirecionar("/preposto/ativar");
        return;
      }

      setEmail(user.email ?? "Usuário autenticado");

      try {
        const acessoAtual = await carregarAcessoAtual();
        if (!ativo) return;

        if (!acessoAtual) {
          redirecionar("/primeiro-acesso");
          return;
        }

        setAcesso(acessoAtual);
        setRepresentanteAdministrado(
          acessoAtual.papel === "admin" ? obterRepresentanteAdministrado() : null,
        );
        setEstadoAcesso("autenticado");
      } catch {
        if (!ativo) return;
        setEstadoAcesso("sem-acesso");
        await supabase.auth.signOut();
        redirecionar("/login");
      }
    }

    void autenticar();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void autenticar();
    });

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, []);

  async function sair() {
    if (!supabase) return;
    limparRepresentanteAdministrado();
    await supabase.auth.signOut();
    redirecionar("/login");
  }

  function encerrarAdministracao() {
    limparRepresentanteAdministrado();
    setRepresentanteAdministrado(null);
    redirecionar("/admin");
  }

  if (estadoAcesso !== "autenticado" || !acesso) {
    return (
      <main className="authLoading">
        <div className="brandMark">T</div>
        <strong>Verificando acesso...</strong>
      </main>
    );
  }

  const menuOperacional = operacionais.filter((item) => {
    if (item.modulo === "inicio") return true;
    return pode(acesso, item.modulo, "visualizar");
  });

  const menu = acesso.papel === "preposto"
    ? menuOperacional
    : [
        ...menuOperacional,
        { label: "Equipe", href: "/equipe", icon: Users, modulo: "equipe", enabled: true },
        { label: "Configurações", href: "/configuracoes", icon: Settings, modulo: "configuracoes", enabled: true },
        ...(acesso.papel === "admin"
          ? [{ label: "Admin", href: "/admin", icon: ShieldCheck, modulo: "admin", enabled: true }]
          : []),
      ];

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
            const active = enabled && (href === "/" ? pathname === "/" : pathname.startsWith(href));

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
          <strong>{acesso.nomeRepresentacao}</strong>
          <span>{acesso.nome}</span>
          {acesso.papel === "admin" && <span className="adminRole">Administrador</span>}
          {acesso.papel === "preposto" && <span className="adminRole">Preposto</span>}
          <span className="userEmail">{email}</span>
          <button className="logoutButton" type="button" onClick={sair}>
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      <section className="content">
        {representanteAdministrado && (
          <div className="adminContextBar">
            <div>
              <UserRoundCog size={18} />
              <div>
                <strong>Administrando: {representanteAdministrado.nome}</strong>
                <span>
                  {representanteAdministrado.nomeRepresentacao}
                  {representanteAdministrado.email ? ` • ${representanteAdministrado.email}` : ""}
                </span>
              </div>
            </div>
            <button type="button" onClick={encerrarAdministracao}>
              <X size={16} />
              Encerrar visualização
            </button>
          </div>
        )}
        {children}
      </section>
    </main>
  );
}
