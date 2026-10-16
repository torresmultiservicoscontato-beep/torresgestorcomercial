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
import {
  limparRepresentanteAdministrado,
  obterRepresentanteAdministrado,
  type RepresentanteAdministrado,
} from "../lib/adminContext";
import { type PerfilComercial, sincronizarPerfilDoUsuario } from "../lib/perfil";
import { supabase } from "../lib/supabase";

const menuBase = [
  { label: "Início", href: "/", icon: Home, enabled: true },
  { label: "Clientes", href: "/clientes", icon: Users, enabled: true },
  { label: "Rotas", href: "#", icon: MapPinned, enabled: false },
  { label: "Visitas", href: "/visitas", icon: ClipboardCheck, enabled: true },
  { label: "Vendas", href: "#", icon: ShoppingCart, enabled: false },
  { label: "Agenda", href: "#", icon: CalendarDays, enabled: false },
  { label: "Relatórios", href: "#", icon: BarChart3, enabled: false },
  { label: "Configurações", href: "/configuracoes", icon: Settings, enabled: true },
];

function redirecionar(destino: string) {
  window.location.replace(destino);
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [estadoAcesso, setEstadoAcesso] = useState<
    "verificando" | "autenticado" | "sem-acesso"
  >("verificando");
  const [email, setEmail] = useState("");
  const [perfil, setPerfil] = useState<PerfilComercial | null>(null);
  const [representanteAdministrado, setRepresentanteAdministrado] =
    useState<RepresentanteAdministrado | null>(null);

  useEffect(() => {
    if (!supabase) {
      setEstadoAcesso("sem-acesso");
      redirecionar("/login");
      return;
    }

    let ativo = true;

    async function autenticar(session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]) {
      if (!ativo) return;

      if (!session?.user) {
        setEmail("");
        setPerfil(null);
        setRepresentanteAdministrado(null);
        setEstadoAcesso("sem-acesso");
        redirecionar("/login");
        return;
      }

      setEmail(session.user.email ?? "Usuário autenticado");

      try {
        const perfilAtual = await sincronizarPerfilDoUsuario();
        if (!ativo) return;

        if (!perfilAtual) {
          setPerfil(null);
          setEstadoAcesso("verificando");
          redirecionar("/primeiro-acesso");
          return;
        }

        setPerfil(perfilAtual);
        setRepresentanteAdministrado(
          perfilAtual.papel === "admin" ? obterRepresentanteAdministrado() : null,
        );
        setEstadoAcesso("autenticado");
      } catch {
        if (!ativo) return;
        setPerfil(null);
        setEstadoAcesso("verificando");
        redirecionar("/primeiro-acesso");
      }
    }

    void supabase.auth.getSession().then(({ data }) => autenticar(data.session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evento, session) => {
      void autenticar(session);
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

  if (estadoAcesso !== "autenticado") {
    return (
      <main className="authLoading">
        <div className="brandMark">T</div>
        <strong>Verificando acesso...</strong>
      </main>
    );
  }

  const menu = perfil?.papel === "admin"
    ? [
        ...menuBase,
        { label: "Admin", href: "/admin", icon: ShieldCheck, enabled: true },
      ]
    : menuBase;

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
          <strong>{perfil?.nomeRepresentacao}</strong>
          {perfil?.nome && <span>{perfil.nome}</span>}
          {perfil?.papel === "admin" && <span className="adminRole">Administrador</span>}
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
