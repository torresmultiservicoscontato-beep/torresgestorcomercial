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
  CreditCard,
  LifeBuoy,
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
import { supabase, supabaseConfigured, supabaseUrl } from "../lib/supabase";

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
  const ambiente = process.env.NEXT_PUBLIC_APP_ENV;
  const testes = supabaseConfigured && ambiente === "test" && new URL(supabaseUrl).hostname === "bwoxqsbqbtrkfvrsswrq.supabase.co";
  const producao = supabaseConfigured && ambiente === "production" && new URL(supabaseUrl).hostname === "sqlrhvxiluzgeldxcmyf.supabase.co";
  const [estadoAcesso, setEstadoAcesso] = useState<"verificando" | "autenticado" | "sem-acesso" | "erro">("verificando");
  const [erroAcesso, setErroAcesso] = useState("");
  const [email, setEmail] = useState("");
  const [modulosPlano, setModulosPlano] = useState<string[] | null>(null);
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
      try {
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

        // Administradores mantêm acesso global. Demais contas seguem o plano do titular.
        if (acessoAtual.papel === "admin") {
          setModulosPlano(null);
        } else {
          const { data: assinatura, error: erroPlano } = await clienteSupabase
            .from("assinaturas_contas").select("status,planos_assinatura(modulos_incluidos)")
            .eq("titular_user_id", acessoAtual.titularUserId).maybeSingle();
          if (erroPlano) throw new Error("Não foi possível validar seu plano: " + erroPlano.message);
          const ativo = assinatura && ["ativa", "teste"].includes(assinatura.status);
          const registro = assinatura?.planos_assinatura;
          const plano = Array.isArray(registro) ? registro[0] : registro;
          setModulosPlano(ativo && plano && "modulos_incluidos" in plano && Array.isArray(plano.modulos_incluidos)
            ? plano.modulos_incluidos : []);
        }
        setAcesso(acessoAtual);
        setRepresentanteAdministrado(representante);
        setPrepostoAdministrado(preposto);
        setErroAcesso("");
        setEstadoAcesso("autenticado");
      } catch (falha) {
        if (!ativo) return;
        setErroAcesso(falha instanceof Error ? falha.message : "Não foi possível carregar seu acesso.");
        setAcesso(null);
        setEstadoAcesso("erro");
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

  if (estadoAcesso === "erro") {
    return <main className="loginPage"><section className="loginCard">
      <h1>Não foi possível carregar o painel</h1>
      <p role="alert">{erroAcesso}</p>
      <button className="primary" onClick={() => window.location.reload()}>Tentar novamente</button>
      <button className="loginSwitch" onClick={() => { void sair(); }}>Sair</button>
    </section></main>;
  }

  if (estadoAcesso !== "autenticado" || !acesso) {
    return (
      <main className="authLoading">
        <div className="brandMark">T</div>
        <strong>Verificando acesso...</strong>
      </main>
    );
  }

  const permitidoPlano = (modulo: string) => acesso.papel === "admin" || modulo === "inicio" || modulo === "meu-plano" || (modulosPlano?.includes(modulo) ?? false);
  const menuOperacional = operacionais.map(item => ({
    ...item,
    enabled: permitidoPlano(item.modulo) && (item.modulo === "inicio" || pode(acesso, item.modulo, "visualizar")),
  }));

  const suporteItem = { label: "Suporte", href: "/meus-chamados", icon: LifeBuoy, modulo: "suporte", enabled: true };
  const menu = acesso.papel === "preposto"
    ? [...menuOperacional, { label: "Meu plano", href: "/meu-plano", icon: CreditCard, modulo: "meu-plano", enabled: true }, suporteItem]
    : [
        ...menuOperacional,
        { label: "Meu plano", href: "/meu-plano", icon: CreditCard, modulo: "meu-plano", enabled: true },
        suporteItem,
        { label: "Equipe", href: "/equipe", icon: Users, modulo: "equipe", enabled: permitidoPlano("equipe") },
        { label: "Configurações", href: "/configuracoes", icon: Settings, modulo: "configuracoes", enabled: permitidoPlano("configuracoes") },
        { label: "Histórico", href: "/historico", icon: ClipboardCheck, modulo: "historico", enabled: permitidoPlano("historico") },
        ...(acesso.papel === "admin"
          ? [{ label: "Admin", href: "/admin", icon: ShieldCheck, modulo: "admin", enabled: true }]
          : []),
      ];

  const rotasModulos: Record<string,string> = {
    "/clientes":"clientes", "/representadas":"representadas", "/produtos":"produtos",
    "/rotas":"rotas", "/visitas":"visitas", "/vendas":"vendas",
    "/comissoes":"comissoes", "/despesas":"despesas", "/agenda":"agenda",
    "/relatorios":"relatorios", "/equipe":"equipe", "/configuracoes":"configuracoes",
    "/historico":"historico"
  };
  const moduloRota = Object.entries(rotasModulos).find(([rota]) => pathname === rota || pathname.startsWith(rota + "/"))?.[1];
  const acessoNegado = moduloRota && !permitidoPlano(moduloRota);

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
                <span className="navDisabled" key={label} title="Não incluído no seu plano ou sem permissão de acesso" aria-disabled="true">
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
        <div role="status" aria-label="Ambiente conectado" style={{
          position: "sticky", top: 0, zIndex: 40, padding: "9px 16px",
          background: testes ? "#dcfce7" : producao ? "#fee2e2" : "#fef3c7",
          color: testes ? "#166534" : producao ? "#991b1b" : "#92400e",
          borderBottom: "1px solid currentColor", fontWeight: 800, fontSize: 12,
          letterSpacing: "0.06em", textAlign: "center",
        }}>
          {testes ? "AMBIENTE DE TESTES — Supabase de testes" : producao ? "AMBIENTE DE PRODUÇÃO — Dados reais" : "AMBIENTE NÃO VERIFICADO — Confira a configuração"}
        </div>
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

        {acessoNegado ? <section className="panel settingsPanel" role="alert">
          <h2>Funcionalidade não incluída no seu plano</h2>
          <p>Este módulo está indisponível na assinatura atual. Você pode solicitar uma mudança ao Administrador Geral.</p>
          <Link href="/meu-plano">Ver meu plano e solicitar alteração</Link>
        </section> : children}
      </section>
    </main>
  );
}
