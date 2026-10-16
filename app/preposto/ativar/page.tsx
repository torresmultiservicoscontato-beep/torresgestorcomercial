"use client";

import { FormEvent, useEffect, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { supabase } from "../../lib/supabase";

export default function AtivarPrepostoPage() {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!supabase) return;

    void supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) {
        window.location.replace("/login");
        return;
      }

      if (!data.user.user_metadata?.must_change_password) {
        window.location.replace("/");
      }
    });
  }, []);

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || carregando) return;

    if (senha.length < 8) {
      setErro("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (senha !== confirmacao) {
      setErro("As senhas não coincidem.");
      return;
    }

    setCarregando(true);
    setErro("");

    try {
      const { error } = await supabase.auth.updateUser({
        password: senha,
        data: { must_change_password: false, tipo_acesso: "preposto" },
      });

      if (error) throw error;
      window.location.replace("/");
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
          <p className="eyebrow">PRIMEIRO LOGIN DO PREPOSTO</p>
          <h1>Crie sua senha definitiva</h1>
          <p>A senha temporária foi criada pelo representante apenas para o primeiro acesso.</p>
        </div>

        {erro && <div className="loginAlert error">{erro}</div>}

        <form onSubmit={salvar}>
          <label className="field">
            Nova senha
            <div className="loginInput">
              <LockKeyhole size={18} />
              <input
                type="password"
                minLength={8}
                required
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                placeholder="Mínimo de 8 caracteres"
              />
            </div>
          </label>

          <label className="field">
            Confirmar nova senha
            <div className="loginInput">
              <LockKeyhole size={18} />
              <input
                type="password"
                minLength={8}
                required
                value={confirmacao}
                onChange={(event) => setConfirmacao(event.target.value)}
                placeholder="Digite novamente"
              />
            </div>
          </label>

          <button className="primary wide" type="submit" disabled={carregando}>
            {carregando ? "Salvando..." : "Definir senha e entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}
