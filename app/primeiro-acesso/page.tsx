"use client";

import { FormEvent, useEffect, useState } from "react";
import { Building2, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { carregarAcessoAtual } from "../lib/acesso";
import { salvarPerfilAtual } from "../lib/perfil";
import { supabase } from "../lib/supabase";

type Cadastro = {
  nome: string;
  nomeRepresentacao: string;
  documentoTipo: "CPF" | "CNPJ";
  documento: string;
  whatsapp: string;
  representadas: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
};

const cadastroInicial: Cadastro = {
  nome: "", nomeRepresentacao: "", documentoTipo: "CNPJ", documento: "", whatsapp: "", representadas: "",
  cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "",
};

function listaRepresentadas(valor: string) {
  return Array.from(new Set(valor.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean)));
}

export default function PrimeiroAcessoPage() {
  const router = useRouter();
  const [cadastro, setCadastro] = useState<Cadastro>(cadastroInicial);
  const [verificando, setVerificando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [validado, setValidado] = useState(false);

  useEffect(() => {
    if (!supabase) { router.replace("/login"); return; }

    const clienteSupabase = supabase;

    let ativo = true;
    void (async () => {
      try {
        const { data, error } = await clienteSupabase.auth.getUser();
        if (!ativo) return;
        if (error || !data.user) {
          router.replace("/login");
          return;
        }

        if (data.user.user_metadata?.tipo_conta === "preposto") {
          router.replace("/preposto/cadastro");
          return;
        }

        const acesso = await carregarAcessoAtual();
        if (!ativo) return;
        if (acesso) { router.replace("/"); return; }
        if (ativo) { setValidado(true); setVerificando(false); }
      } catch (falha) {
        if (ativo) {
          setErro(falha instanceof Error ? falha.message : "Não foi possível verificar seu cadastro.");
          setVerificando(false);
        }
      }
    })();
    return () => { ativo = false; };
  }, [router]);

  function atualizar(campo: keyof Cadastro, valor: string) {
    setCadastro((atual) => ({ ...atual, [campo]: valor }));
  }

  async function concluir(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (salvando || !validado) return;

    const representadas = listaRepresentadas(cadastro.representadas);
    if (representadas.length === 0) { setErro("Informe pelo menos uma representada."); return; }

    setSalvando(true);
    setErro("");
    try {
      await salvarPerfilAtual({
        nome: cadastro.nome.trim(), nomeRepresentacao: cadastro.nomeRepresentacao.trim(), documentoTipo: cadastro.documentoTipo,
        documento: cadastro.documento.trim(), whatsapp: cadastro.whatsapp.trim(), cep: cadastro.cep.trim(), logradouro: cadastro.logradouro.trim(),
        numero: cadastro.numero.trim(), complemento: cadastro.complemento.trim(), bairro: cadastro.bairro.trim(), cidade: cadastro.cidade.trim(),
        uf: cadastro.uf.trim().toUpperCase().slice(0, 2), representadas,
      });
      router.replace("/");
      router.refresh();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível concluir o primeiro acesso.");
    } finally { setSalvando(false); }
  }

  async function sair() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (verificando) return <main className="authLoading"><div className="brandMark">T</div><strong>Preparando seu primeiro acesso...</strong></main>;

  if (!validado) return <main className="loginPage"><section className="loginCard">
    <h1>Não foi possível verificar seu cadastro</h1>
    <p role="alert">{erro}</p>
    <button className="primary" onClick={() => window.location.reload()}>Tentar novamente</button>
    <button className="loginSwitch" onClick={() => { void sair(); }}>Sair</button>
  </section></main>;

  return (
    <main className="loginPage onboardingPage">
      <section className="loginCard onboardingCard">
        <div className="loginBrand"><div className="brandMark">T</div><div><strong>TORRES</strong><span>Gestor Comercial</span></div></div>
        <div className="loginIntro onboardingIntro"><p className="eyebrow">PRIMEIRO ACESSO</p><h1>Vamos configurar seu perfil comercial</h1><p>Preencha estes dados uma única vez. Eles serão usados para personalizar seu painel e organizar sua operação comercial.</p></div>
        {erro && <div className="loginAlert error">{erro}</div>}
        <form onSubmit={concluir}>
          <div className="onboardingSectionTitle"><Building2 size={18} /><strong>Dados do representante</strong></div>
          <div className="signupGrid">
            <label className="field">Seu nome<input type="text" required autoFocus value={cadastro.nome} onChange={(e) => atualizar("nome", e.target.value)} placeholder="Ex.: Bruno Torres" /></label>
            <label className="field">Nome da representação<input type="text" required value={cadastro.nomeRepresentacao} onChange={(e) => atualizar("nomeRepresentacao", e.target.value)} placeholder="Ex.: Torres Multi Representações" /></label>
            <label className="field">Tipo de documento<select value={cadastro.documentoTipo} onChange={(e) => atualizar("documentoTipo", e.target.value as "CPF" | "CNPJ")}><option value="CPF">CPF</option><option value="CNPJ">CNPJ</option></select></label>
            <label className="field">{cadastro.documentoTipo}<input type="text" required value={cadastro.documento} onChange={(e) => atualizar("documento", e.target.value)} /></label>
            <label className="field">WhatsApp<input type="tel" required value={cadastro.whatsapp} onChange={(e) => atualizar("whatsapp", e.target.value)} /></label>
            <label className="field">CEP<input type="text" required value={cadastro.cep} onChange={(e) => atualizar("cep", e.target.value)} /></label>
            <label className="field signupSpan2">Representadas<textarea required value={cadastro.representadas} onChange={(e) => atualizar("representadas", e.target.value)} placeholder={"Digite uma por linha. Ex.:\nKing Ouro\nArgamil"} /><small>Você pode cadastrar várias representadas.</small></label>
            <label className="field signupSpan2">Endereço<input type="text" required value={cadastro.logradouro} onChange={(e) => atualizar("logradouro", e.target.value)} /></label>
            <label className="field">Número<input type="text" required value={cadastro.numero} onChange={(e) => atualizar("numero", e.target.value)} /></label>
            <label className="field">Complemento<input type="text" value={cadastro.complemento} onChange={(e) => atualizar("complemento", e.target.value)} /></label>
            <label className="field">Bairro<input type="text" required value={cadastro.bairro} onChange={(e) => atualizar("bairro", e.target.value)} /></label>
            <label className="field">Cidade<input type="text" required value={cadastro.cidade} onChange={(e) => atualizar("cidade", e.target.value)} /></label>
            <label className="field">UF<input type="text" required maxLength={2} value={cadastro.uf} onChange={(e) => atualizar("uf", e.target.value.toUpperCase())} /></label>
          </div>
          <button className="primary wide onboardingSubmit" type="submit" disabled={salvando}>{salvando ? "Salvando..." : "Concluir primeiro acesso"}</button>
        </form>
        <button className="loginSwitch onboardingLogout" type="button" onClick={sair}><LogOut size={15} />Sair e usar outra conta</button>
      </section>
    </main>
  );
}
