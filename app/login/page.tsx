"use client";

import { FormEvent, useEffect, useState } from "react";
import { LockKeyhole, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!supabase) return;

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router]);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || carregando) return;

    setCarregando(true);
    setErro("");
    setMensagem("");

    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: senha,
        });

        if (error) throw error;
        router.replace("/");
        router.refresh();
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: senha,
      });

      if (error) throw error;

      if (data.session) {
        router.replace("/");
        router.refresh();
      } else {
        setMensagem(
          "Acesso criado. Confirme o e-mail recebido e depois volte aqui para entrar.",
        );
        setModo("entrar");
      }
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível concluir o acesso.");
    } finally {
      setCarregando(false);
    }
  }

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
          <h1>{modo === "entrar" ? "Entrar no sistema" : "Criar meu acesso"}</h1>
          <p>
            {modo === "entrar"
              ? "Use seu e-mail e senha para acessar seus clientes e visitas."
              : "Crie seu usuário para que os dados fiquem vinculados à sua conta."}
          </p>
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

          <button className="primary wide" type="submit" disabled={carregando}>
            {carregando
              ? "Aguarde..."
              : modo === "entrar"
                ? "Entrar"
                : "Criar acesso"}
          </button>
        </form>

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
      </section>
    </main>
  );
}
