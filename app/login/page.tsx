"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { LockKeyhole, Mail, UserRound, Users } from "lucide-react";
import { carregarAcessoAtual } from "../lib/acesso";
import { carregarPerfilPrepostoAtual } from "../lib/prepostoPerfil";
import { supabase, supabaseConfigurationError } from "../lib/supabase";

type ModoAcesso = "entrar" | "cadastrar" | "recuperar";
type TipoConta = "representante" | "preposto";

function redirecionar(destino: string) {
  window.location.replace(destino);
}

async function destinoUsuarioLogado() {
  const perfilPreposto = await carregarPerfilPrepostoAtual();
  if (perfilPreposto) return "/preposto/vinculos";

  const acesso = await carregarAcessoAtual();
  if (acesso) return "/";

  if (!supabase) return "/login";
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.user_metadata?.tipo_conta === "preposto" ? "/preposto/cadastro" : "/primeiro-acesso";
}

export default function LoginPage() {
  const [modo, setModo] = useState<ModoAcesso>("entrar");
  const [tipoConta, setTipoConta] = useState<TipoConta>("representante");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!supabase) return;

    const clienteSupabase = supabase;
    let ativo = true;
    // Ausência de sessão não exige signOut: ele pode apagar um login em andamento.
    void (async () => {
      try {
        const { data, error } = await clienteSupabase.auth.getUser();
        if (error || !data.user || !ativo) return;
        const destino = await destinoUsuarioLogado();
        if (ativo) redirecionar(destino);
      } catch {
        if (ativo) setErro("Não foi possível verificar sua sessão. Confira a conexão e tente entrar novamente.");
      }
    })();
    return () => { ativo = false; };
  }, []);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (carregando) return;
    if (!supabase) {
      setErro(supabaseConfigurationError ?? "Supabase não configurado.");
      return;
    }

    setCarregando(true);
    setErro("");
    setMensagem("");

    try {
      if (modo === "recuperar") {
        const redirectTo = `${window.location.origin}/redefinir-senha`;
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        if (error) throw error;
        setMensagem("Se esse e-mail estiver cadastrado, você receberá um link para definir uma nova senha.");
        return;
      }

      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
        if (error) throw error;
        redirecionar(await destinoUsuarioLogado());
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: senha,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: { tipo_conta: tipoConta },
        },
      });

      if (error) throw error;

      if (data.session) {
        redirecionar(tipoConta === "preposto" ? "/preposto/cadastro" : "/primeiro-acesso");
        return;
      }

      setMensagem("Conta criada. Confirme o e-mail recebido e depois entre para completar seu cadastro.");
      setModo("entrar");
    } catch (falha) {
      const detalhe = falha instanceof Error ? falha.message : "Não foi possível concluir o acesso.";
      setErro(/failed to fetch|fetch failed|networkerror|network request failed/i.test(detalhe)
        ? "Não foi possível conectar ao serviço de acesso. Confira a conexão e a configuração do ambiente."
        : detalhe === "Invalid login credentials"
          ? "E-mail ou senha inválidos. Use uma conta do ambiente de testes quando estiver em testes."
          : detalhe);
    } finally {
      setCarregando(false);
    }
  }

  const titulo = modo === "entrar" ? "Entrar no sistema" : modo === "cadastrar" ? "Criar meu acesso" : "Recuperar minha senha";
  const descricao = modo === "entrar"
    ? "Use seu e-mail e senha para acessar o Torres Gestor Comercial."
    : modo === "cadastrar"
      ? "Escolha seu perfil e crie sua própria conta."
      : "Informe seu e-mail. Enviaremos um link seguro para você criar uma nova senha.";

  return (
    <main className="loginPage">
      <section className="loginCard">
        <div className="loginBrand">
          <div className="brandMark">T</div>
          <div><strong>TORRES</strong><span>Gestor Comercial</span></div>
        </div>

        <div className="loginIntro">
          <p className="eyebrow">ACESSO SEGURO</p>
          <h1>{titulo}</h1>
          <p>{descricao}</p>
        </div>

        {(supabaseConfigurationError || erro) && <div role="alert" className="loginAlert error">{supabaseConfigurationError || erro}</div>}
        {mensagem && <div className="loginAlert success">{mensagem}</div>}

        <form onSubmit={enviar}>
          {modo === "cadastrar" && (
            <div className="accountTypeSelector">
              <button className={tipoConta === "representante" ? "accountType active" : "accountType"} type="button" onClick={() => setTipoConta("representante")}>
                <UserRound size={18} /><strong>Representante</strong><span>Administra sua própria operação e equipe.</span>
              </button>
              <button className={tipoConta === "preposto" ? "accountType active" : "accountType"} type="button" onClick={() => setTipoConta("preposto")}>
                <Users size={18} /><strong>Preposto</strong><span>Cria seu cadastro e recebe vínculos de representantes.</span>
              </button>
            </div>
          )}

          <label className="field">
            E-mail
            <div className="loginInput"><Mail size={18} /><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seuemail@exemplo.com" /></div>
          </label>

          {modo !== "recuperar" && (
            <label className="field">
              Senha
              <div className="loginInput"><LockKeyhole size={18} /><input type="password" autoComplete={modo === "entrar" ? "current-password" : "new-password"} required minLength={6} value={senha} onChange={(event) => setSenha(event.target.value)} placeholder="Mínimo de 6 caracteres" /></div>
            </label>
          )}

          {modo === "entrar" && <button className="forgotPassword" type="button" onClick={() => { setModo("recuperar"); setErro(""); setMensagem(""); }}>Esqueceu a senha?</button>}

          <button className="primary wide" type="submit" disabled={carregando || !supabase}>
            {carregando ? "Aguarde..." : modo === "entrar" ? "Entrar" : modo === "cadastrar" ? "Criar acesso" : "Enviar link de recuperação"}
          </button>
        </form>

        {modo === "recuperar" ? (
          <button className="loginSwitch" type="button" onClick={() => { setModo("entrar"); setErro(""); setMensagem(""); }}>Voltar para o login</button>
        ) : (
          <button className="loginSwitch" type="button" onClick={() => { setModo((atual) => (atual === "entrar" ? "cadastrar" : "entrar")); setErro(""); setMensagem(""); }}>
            {modo === "entrar" ? "Primeiro acesso? Criar conta" : "Já tenho acesso? Entrar"}
          </button>
        )}
        <nav aria-label="Informações legais e atendimento" style={{display:"flex",flexWrap:"wrap",justifyContent:"center",gap:14,marginTop:24}}><Link href="/termos">Termos de Uso</Link><Link href="/privacidade">Privacidade</Link><Link href="/suporte">Suporte</Link></nav>
      </section>
    </main>
  );
}
