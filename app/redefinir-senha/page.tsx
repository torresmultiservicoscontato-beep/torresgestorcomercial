"use client";

import { FormEvent, useEffect, useState } from "react";
import { LockKeyhole } from "lucide-react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

export default function RedefinirSenhaPage() {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [sessaoValida, setSessaoValida] = useState(false);
  const [verificando, setVerificando] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!supabase) {
      setErro("A conexão com o sistema de acesso não está configurada.");
      setVerificando(false);
      return;
    }

    let ativo = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!ativo) return;
      if (error) setErro(error.message);
      setSessaoValida(Boolean(data.session));
      setVerificando(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((evento, session) => {
      if (!ativo) return;
      if (evento === "PASSWORD_RECOVERY" || session) {
        setSessaoValida(true);
        setVerificando(false);
        setErro("");
      }
    });

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, []);

  async function redefinir(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || carregando) return;

    if (senha.length < 6) {
      setErro("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (senha !== confirmacao) {
      setErro("As duas senhas precisam ser iguais.");
      return;
    }

    setCarregando(true);
    setErro("");

    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;

      await supabase.auth.signOut();
      setSucesso(true);
      setSenha("");
      setConfirmacao("");
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível atualizar a senha.");
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
          <p className="eyebrow">RECUPERAÇÃO DE ACESSO</p>
          <h1>Definir nova senha</h1>
          <p>Crie uma nova senha para voltar a acessar o Torres Gestor Comercial.</p>
        </div>

        {erro && <div className="loginAlert error">{erro}</div>}

        {sucesso ? (
          <>
            <div className="loginAlert success">
              Senha alterada com sucesso. Agora entre novamente usando a nova senha.
            </div>
            <Link className="primary wide" href="/login">
              Voltar para o login
            </Link>
          </>
        ) : verificando ? (
          <div className="authLoading compact">Verificando link de recuperação...</div>
        ) : sessaoValida ? (
          <form onSubmit={redefinir}>
            <label className="field">
              Nova senha
              <div className="loginInput">
                <LockKeyhole size={18} />
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                />
              </div>
            </label>

            <label className="field">
              Confirmar nova senha
              <div className="loginInput">
                <LockKeyhole size={18} />
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={confirmacao}
                  onChange={(event) => setConfirmacao(event.target.value)}
                  placeholder="Digite a nova senha novamente"
                />
              </div>
            </label>

            <button className="primary wide" type="submit" disabled={carregando}>
              {carregando ? "Salvando..." : "Salvar nova senha"}
            </button>
          </form>
        ) : (
          <>
            <div className="loginAlert error">
              Este link de recuperação é inválido ou expirou. Solicite um novo link na tela de login.
            </div>
            <Link className="secondary wide" href="/login">
              Voltar para o login
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
