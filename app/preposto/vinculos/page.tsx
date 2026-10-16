"use client";

import { useEffect, useState } from "react";
import { Check, LogOut, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { definirOperacaoPreposto } from "../../lib/acesso";
import { carregarPerfilPrepostoAtual } from "../../lib/prepostoPerfil";
import { listarVinculosPrepostoAtual, responderVinculoPreposto, type VinculoPreposto } from "../../lib/prepostos";
import { supabase } from "../../lib/supabase";

export default function VinculosPrepostoPage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [vinculos, setVinculos] = useState<VinculoPreposto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  async function carregar() {
    try {
      const [perfil, lista] = await Promise.all([
        carregarPerfilPrepostoAtual(),
        listarVinculosPrepostoAtual(),
      ]);
      if (!perfil) {
        router.replace("/preposto/cadastro");
        return;
      }
      setNome(perfil.nome);
      setVinculos(lista);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível carregar seus vínculos.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { void carregar(); }, []);

  async function responder(id: string, aceitar: boolean) {
    try {
      await responderVinculoPreposto(id, aceitar);
      await carregar();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível responder ao convite.");
    }
  }

  function acessar(vinculo: VinculoPreposto) {
    definirOperacaoPreposto(vinculo.titularUserId);
    router.replace("/");
    router.refresh();
  }

  async function sair() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <main className="loginPage onboardingPage">
      <section className="loginCard onboardingCard">
        <div className="loginBrand">
          <div className="brandMark">T</div>
          <div><strong>TORRES</strong><span>Gestor Comercial</span></div>
        </div>

        <div className="loginIntro onboardingIntro">
          <p className="eyebrow">MINHAS OPERAÇÕES</p>
          <h1>{nome ? `Olá, ${nome}.` : "Seus vínculos"}</h1>
          <p>Aceite solicitações de representantes e escolha em qual operação deseja trabalhar.</p>
        </div>

        {erro && <div className="loginAlert error">{erro}</div>}
        {carregando && <div className="emptyState">Carregando vínculos...</div>}

        {!carregando && vinculos.length === 0 && (
          <div className="emptyState">Seu cadastro está pronto. Quando um representante solicitar seu vínculo pelo e-mail, o convite aparecerá aqui.</div>
        )}

        <div className="teamList">
          {vinculos.map((vinculo) => (
            <article className="teamMember" key={vinculo.id}>
              <div className="avatar">{vinculo.nomeRepresentacao.slice(0, 1).toUpperCase()}</div>
              <div className="teamMemberInfo">
                <strong>{vinculo.nomeRepresentacao}</strong>
                <span>Representante: {vinculo.nomeRepresentante}</span>
              </div>

              {vinculo.status === "pendente" && (
                <div className="visitItemActions">
                  <button className="secondary adminAccessButton" type="button" onClick={() => responder(vinculo.id, false)}><X size={15} />Recusar</button>
                  <button className="primary adminAccessButton" type="button" onClick={() => responder(vinculo.id, true)}><Check size={15} />Aceitar</button>
                </div>
              )}

              {vinculo.status === "ativo" && (
                <button className="primary adminAccessButton" type="button" onClick={() => acessar(vinculo)}>Acessar operação</button>
              )}

              {vinculo.status === "inativo" && <span className="status attention">Acesso inativo</span>}
              {vinculo.status === "recusado" && <span className="tag">Recusado</span>}
            </article>
          ))}
        </div>

        <button className="loginSwitch onboardingLogout" type="button" onClick={sair}><LogOut size={15} />Sair</button>
      </section>
    </main>
  );
}
