"use client";

import { FormEvent, useEffect, useState } from "react";
import { LockKeyhole, Mail } from "lucide-react";
import { carregarAcessoAtual } from "../lib/acesso";
import { supabase } from "../lib/supabase";

type ModoAcesso = "entrar" | "cadastrar" | "recuperar";

function redirecionar(destino: string) {
  window.location.replace(destino);
}

export default function LoginPage() {
  const [modo, setModo] = useState<ModoAcesso>("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!supabase) return;

    void supabase.auth.getUser().then(async ({ data, error }) => {
      if (error || !data.user) {
        await supabase.auth.signOut();
        return;
      }

      if (data.user.user_metadata?.must_change_password) {
        redirecionar("/preposto/ativar");
        return;
      }

      const acesso = await carregarAcessoAtual().catch(() => null);
      redirecionar(acesso ? "/" : "/primeiro-acesso");
    });
  }, []);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || carregando) return;

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
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: senha,
        });

        if (error) throw error;
        if (data.user?.user_metadata?.must_change_password) {
          redirecionar("/preposto/ativar");
          return;
        }

        const acesso = await carregarAcessoAtual().catch(() => null);
        redirecionar(acesso ? "/" : "/primeiro-acesso");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: senha,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (error) throw error;

      if (data.session) {
        redirecionar("/primeiro-acesso");
        return;
      }

      setMensagem("Acesso criado. Confirme o e-mail recebido e depois entre para completar seu primeiro acesso.");
      setModo("entrar");
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível concluir o acesso.");
    } finally {
      setCarregando(false);
    }
  }

  const titulo = modo === "entrar" ? "Entrar no sistema" : modo === "cadastrar" ? "Criar meu acesso" : "Recuperar minha senha";
  const descricao = modo === "entrar"
    ? "Use seu e-mail e senha para acessar o Torres Gestor Comercial."
    : modo === "cadastrar"
      ? "Crie seu acesso com e-mail e senha. Seus dados comerciais serão preenchidos na próxima etapa."
      : "Informe seu e-mail. Enviaremos um link seguro para você criar uma nova senha.";

  return (
    <main className="loginPage">
      <section className="loginCard">
        <div className="loginBrand">
          <div className="brandMark">T</div>
          <div>
            <strong>TORRES</strong>
            <span>Gestor Comercial</span>
          </div>
        </div>

        <div className="loginIntro">
          <p className="eyebrow">ACESSO SEGURO</p>
          <h1>{titulo}</h1>
          <p>{descricao}</p>
        </div>

        {erro && <div className="loginAlert error">{erro}</div>}
        {mensagem && <div className="loginAlert success">{mensagem}</div>}

        <form onSubmit={enviar}>
          <label className="field">
            E-mail
            <div className="loginInput">
              <Mail size={18} />
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="seuemail@exemplo.com"
              />
            </div>
          </label>

          {modo !== "recuperar" && (
            <label className="field">
              Senha
              <div className="loginInput">
                <LockKeyhole size={18} />
                <input
                  type="password"
                  autoComplete={modo === "entrar" ? "current-password" : "new-password"}
                  required
                  minLength={6}
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                />
              </div>
            </label>
          )}

          {modo === "entrar" && (
            <button
              className="forgotPassword"
              type="button"
              onClick={() => {
                setModo("recuperar");
                setErro("");
                setMensagem("");
              }}
            >
              Esqueceu a senha?
            </button>
          )}

          <button className="primary wide" type="submit" disabled={carregando}>
            {carregando ? "Aguarde..." : modo === "entrar" ? "Entrar" : modo === "cadastrar" ? "Criar acesso" : "Enviar link de recuperação"}
          </button>
        </form>

        {modo === "recuperar" ? (
          <button
            className="loginSwitch"
            type="button"
            onClick={() => {
              setModo("entrar");
              setErro("");
              setMensagem("");
            }}
          >
            Voltar para o login
          </button>
        ) : (
          <button
            className="loginSwitch"
            type="button"
            onClick={() => {
              setModo((atual) => (atual === "entrar" ? "cadastrar" : "entrar"));
              setErro("");
              setMensagem("");
            }}
          >
            {modo === "entrar" ? "Primeiro acesso? Criar conta" : "Já tenho acesso? Entrar"}
          </button>
        )}
      </section>
    </main>
  );
}
