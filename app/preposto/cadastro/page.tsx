"use client";

import { FormEvent, useEffect, useState } from "react";
import { IdCard, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { carregarPerfilPrepostoAtual, salvarPerfilPrepostoAtual } from "../../lib/prepostoPerfil";
import { supabase } from "../../lib/supabase";

type Cadastro = {
  nome: string;
  documentoTipo: "CPF" | "CNPJ";
  documento: string;
  whatsapp: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
};

const inicial: Cadastro = {
  nome: "",
  documentoTipo: "CPF",
  documento: "",
  whatsapp: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
};

export default function CadastroPrepostoPage() {
  const router = useRouter();
  const [cadastro, setCadastro] = useState(inicial);
  const [verificando, setVerificando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!supabase) {
      router.replace("/login");
      return;
    }

    const clienteSupabase = supabase;

    void clienteSupabase.auth.getUser().then(async ({ data, error }) => {
      if (error || !data.user) {
        await clienteSupabase.auth.signOut();
        router.replace("/login");
        return;
      }

      const perfil = await carregarPerfilPrepostoAtual().catch(() => null);
      if (perfil) {
        router.replace("/preposto/vinculos");
        return;
      }

      setVerificando(false);
    });
  }, [router]);

  function atualizar(campo: keyof Cadastro, valor: string) {
    setCadastro((atual) => ({ ...atual, [campo]: valor }));
  }

  async function concluir(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (salvando) return;

    setSalvando(true);
    setErro("");

    try {
      await salvarPerfilPrepostoAtual(cadastro);
      router.replace("/preposto/vinculos");
      router.refresh();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível concluir seu cadastro.");
    } finally {
      setSalvando(false);
    }
  }

  async function sair() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (verificando) {
    return (
      <main className="authLoading">
        <div className="brandMark">T</div>
        <strong>Preparando seu cadastro...</strong>
      </main>
    );
  }

  return (
    <main className="loginPage onboardingPage">
      <section className="loginCard onboardingCard">
        <div className="loginBrand">
          <div className="brandMark">T</div>
          <div>
            <strong>TORRES</strong>
            <span>Gestor Comercial</span>
          </div>
        </div>

        <div className="loginIntro onboardingIntro">
          <p className="eyebrow">CADASTRO DO PREPOSTO</p>
          <h1>Crie sua identidade profissional</h1>
          <p>Seus dados pertencem à sua conta. Os representantes poderão apenas localizar seu cadastro pelo e-mail e solicitar um vínculo.</p>
        </div>

        {erro && <div className="loginAlert error">{erro}</div>}

        <form onSubmit={concluir}>
          <div className="onboardingSectionTitle">
            <IdCard size={18} />
            <strong>Dados pessoais</strong>
          </div>

          <div className="signupGrid">
            <label className="field signupSpan2">
              Nome completo
              <input required autoFocus value={cadastro.nome} onChange={(event) => atualizar("nome", event.target.value)} placeholder="Ex.: João da Silva" />
            </label>

            <label className="field">
              Tipo de documento
              <select value={cadastro.documentoTipo} onChange={(event) => atualizar("documentoTipo", event.target.value as "CPF" | "CNPJ")}>
                <option value="CPF">CPF</option>
                <option value="CNPJ">CNPJ</option>
              </select>
            </label>

            <label className="field">
              {cadastro.documentoTipo}
              <input required value={cadastro.documento} onChange={(event) => atualizar("documento", event.target.value)} />
            </label>

            <label className="field">
              WhatsApp
              <input type="tel" required value={cadastro.whatsapp} onChange={(event) => atualizar("whatsapp", event.target.value)} placeholder="(21) 99999-9999" />
            </label>

            <label className="field">
              CEP
              <input required value={cadastro.cep} onChange={(event) => atualizar("cep", event.target.value)} placeholder="00000-000" />
            </label>

            <label className="field signupSpan2">
              Endereço
              <input required value={cadastro.logradouro} onChange={(event) => atualizar("logradouro", event.target.value)} placeholder="Rua, avenida, estrada..." />
            </label>

            <label className="field">
              Número
              <input required value={cadastro.numero} onChange={(event) => atualizar("numero", event.target.value)} />
            </label>

            <label className="field">
              Complemento
              <input value={cadastro.complemento} onChange={(event) => atualizar("complemento", event.target.value)} placeholder="Opcional" />
            </label>

            <label className="field">
              Bairro
              <input required value={cadastro.bairro} onChange={(event) => atualizar("bairro", event.target.value)} />
            </label>

            <label className="field">
              Cidade
              <input required value={cadastro.cidade} onChange={(event) => atualizar("cidade", event.target.value)} />
            </label>

            <label className="field">
              UF
              <input required maxLength={2} value={cadastro.uf} onChange={(event) => atualizar("uf", event.target.value.toUpperCase())} placeholder="RJ" />
            </label>
          </div>

          <button className="primary wide onboardingSubmit" type="submit" disabled={salvando}>
            {salvando ? "Salvando..." : "Concluir cadastro de preposto"}
          </button>
        </form>

        <button className="loginSwitch onboardingLogout" type="button" onClick={sair}>
          <LogOut size={15} />
          Sair e usar outra conta
        </button>
      </section>
    </main>
  );
}
