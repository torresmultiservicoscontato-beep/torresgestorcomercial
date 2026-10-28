"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeDollarSign,
  BarChart3,
  Boxes,
  CalendarDays,
  ClipboardCheck,
  Home,
  Landmark,
  LogOut,
  MapPinned,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Wallet,
  UserRoundCog,
  Users,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import {
  carregarAcessoAtual,
  definirOperacaoPreposto,
  limparOperacaoPreposto,
  pode,
  type AcessoSistema,
} from "../lib/acesso";
import {
  limparRepresentanteAdministrado,
  obterRepresentanteAdministrado,
  type RepresentanteAdministrado,
} from "../lib/adminContext";
import {
  limparPrepostoAdministrado,
  obterPrepostoAdministrado,
  type PrepostoAdministrado,
} from "../lib/prepostoContext";
import { supabase } from "../lib/supabase";

const operacionais = [
  { label: "Início", href: "/", icon: Home, modulo: "inicio", enabled: true },
  { label: "Clientes", href: "/clientes", icon: Users, modulo: "clientes", enabled: true },
  { label: "Representadas", href: "/representadas", icon: Landmark, modulo: "representadas", enabled: true },
  { label: "Produtos", href: "/produtos", icon: Boxes, modulo: "produtos", enabled: true },
  { label: "Rotas", href: "/rotas", icon: MapPinned, modulo: "rotas", enabled: true },
  { label: "Visitas", href: "/visitas", icon: ClipboardCheck, modulo: "visitas", enabled: true },
  { label: "Vendas", href: "/vendas", icon: ShoppingCart, modulo: "vendas", enabled: true },
  { label: "Comissões", href: "/comissoes", icon: BadgeDollarSign, modulo: "comissoes", enabled: true },
  { label: "Despesas", href: "/despesas", icon: Wallet, modulo: "despesas", enabled: true },
  { label: "Agenda", href: "/agenda", icon: CalendarDays, modulo: "agenda", enabled: true },
  { label: "Relatórios", href: "/relatorios", icon: BarChart3, modulo: "relatorios", enabled: true },
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
  const [prepostoAdministrado, setPrepostoAdministrado] = useState<PrepostoAdministrado | null>(null);

  useEffect(() => {
    if (!supabase) {
      setEstadoAcesso("sem-acesso");
      redirecionar("/login");
      return;
    }

    const clienteSupabase = supabase;
    let ativo = true;

    async function autenticar() {
      const {
        data: { user },
        error,
      } = await clienteSupabase.auth.getUser();

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

        const representante = acessoAtual.papel === "admin" ? obterRepresentanteAdministrado() : null;
        const titularAtivo = representante?.userId ?? acessoAtual.titularUserId;
        let preposto = acessoAtual.papel === "preposto" ? null : obterPrepostoAdministrado();

        if (acessoAtual.papel === "preposto") {
          limparPrepostoAdministrado();
        } else if (preposto && preposto.titularUserId !== titularAtivo) {
          limparPrepostoAdministrado();
          preposto = null;
        }

        setAcesso(acessoAtual);
        setRepresentanteAdministrado(representante);
        setPrepostoAdministrado(preposto);
        setEstadoAcesso("autenticado");
      } catch {
        if (!ativo) return;
        setEstadoAcesso("sem-acesso");
        await clienteSupabase.auth.signOut();
        redirecionar("/login");
      }
    }

    void autenticar();

    const {
      data: { subscription },
    } = clienteSupabase.auth.onAuthStateChange(() => {
      void autenticar();
    });

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, []);

  async function sair() {
    if (!supabase) return;
    limparPrepostoAdministrado();
    limparRepresentanteAdministrado();
    limparOperacaoPreposto();
    await supabase.auth.signOut();
    redirecionar("/login");
  }

  function trocarOperacao(titularUserId: string) {
    if (!titularUserId || titularUserId === acesso?.titularUserId) return;
    definirOperacaoPreposto(titularUserId);
    redirecionar("/");
  }

  function encerrarAdministracao() {
    limparPrepostoAdministrado();
    limparRepresentanteAdministrado();
    setPrepostoAdministrado(null);
    setRepresentanteAdministrado(null);
    redirecionar("/admin");
  }

  function encerrarPreposto() {
    limparPrepostoAdministrado();
    setPrepostoAdministrado(null);
    redirecionar("/equipe");
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
    if (item.modulo === "inicio" || item.modulo === "representadas" || item.modulo === "produtos" || item.modulo === "comissoes") return true;
    return pode(acesso, item.modulo, "visualizar");
  });

  const menu = acesso.papel === "preposto"
    ? menuOperacional
    : [
        ...menuOperacional,
        { label: "Equipe", href: "/equipe", icon: Users, modulo: "equipe", enabled: true },
        { label: "Configurações", href: "/configuracoes", icon: Settings, modulo: "configuracoes", enabled: true },
        { label: "Histórico", href: "/historico", icon: ClipboardCheck, modulo: "historico", enabled: true },
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

          {acesso.papel === "preposto" && acesso.operacoes.length > 1 && (
            <label className="operationSwitcher">
              <small>OPERAÇÃO</small>
              <select
                value={acesso.titularUserId}
                onChange={(event) => trocarOperacao(event.target.value)}
                aria-label="Trocar operação do preposto"
              >
                {acesso.operacoes.map((operacao) => (
                  <option key={operacao.vinculoId} value={operacao.titularUserId}>
                    {operacao.nomeRepresentacao} — {operacao.nomeTitular}
                  </option>
                ))}
              </select>
            </label>
          )}

          <nav aria-label="Ajuda e informações legais" style={{display:"flex",flexDirection:"column",gap:8,margin:"14px 0"}}><Link href="/suporte">Suporte</Link><Link href="/termos">Termos de Uso</Link><Link href="/privacidade">Privacidade</Link></nav>
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
                <strong>Administrando representante: {representanteAdministrado.nome}</strong>
                <span>
                  {representanteAdministrado.nomeRepresentacao}
                  {representanteAdministrado.email ? ` • ${representanteAdministrado.email}` : ""}
                </span>
              </div>
            </div>
            <button type="button" onClick={encerrarAdministracao}>
              <X size={16} />
              Encerrar representante
            </button>
          </div>
        )}

        {prepostoAdministrado && (
          <div className="adminContextBar">
            <div>
              <UserRoundCog size={18} />
              <div>
                <strong>Painel do preposto: {prepostoAdministrado.nome}</strong>
                <span>{prepostoAdministrado.email || "Operação individual da equipe"}</span>
              </div>
            </div>
            <button type="button" onClick={encerrarPreposto}>
              <X size={16} />
              Voltar para Equipe
            </button>
          </div>
        )}

        {children}
      </section>
    </main>
  );
}
