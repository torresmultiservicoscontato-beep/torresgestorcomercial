"use client";

import { FormEvent, useEffect, useState } from "react";
import { Building2, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { carregarPerfilAtual, salvarPerfilAtual } from "../lib/perfil";
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
  nome: "",
  nomeRepresentacao: "",
  documentoTipo: "CNPJ",
  documento: "",
  whatsapp: "",
  representadas: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
};

function listaRepresentadas(valor: string) {
  return Array.from(
    new Set(
      valor
        .split(/[\n,;]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export default function PrimeiroAcessoPage() {
  const router = useRouter();
  const [cadastro, setCadastro] = useState<Cadastro>(cadastroInicial);
  const [verificando, setVerificando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!supabase) {
      router.replace("/login");
      return;
    }

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.replace("/login");
        return;
      }

      const perfil = await carregarPerfilAtual().catch(() => null);
      if (perfil) {
        router.replace("/");
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

    const representadas = listaRepresentadas(cadastro.representadas);
    if (representadas.length === 0) {
      setErro("Informe pelo menos uma representada.");
      return;
    }

    setSalvando(true);
    setErro("");

    try {
      await salvarPerfilAtual({
        nome: cadastro.nome.trim(),
        nomeRepresentacao: cadastro.nomeRepresentacao.trim(),
        documentoTipo: cadastro.documentoTipo,
        documento: cadastro.documento.trim(),
        whatsapp: cadastro.whatsapp.trim(),
        cep: cadastro.cep.trim(),
        logradouro: cadastro.logradouro.trim(),
        numero: cadastro.numero.trim(),
        complemento: cadastro.complemento.trim(),
        bairro: cadastro.bairro.trim(),
        cidade: cadastro.cidade.trim(),
        uf: cadastro.uf.trim().toUpperCase().slice(0, 2),
        representadas,
      });

      router.replace("/");
      router.refresh();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível concluir o primeiro acesso.");
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
        <strong>Preparando seu primeiro acesso...</strong>
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
          <p className="eyebrow">PRIMEIRO ACESSO</p>
          <h1>Vamos configurar seu perfil comercial</h1>
          <p>
            Preencha estes dados uma única vez. Eles serão usados para personalizar seu painel e organizar sua operação comercial.
          </p>
        </div>

        {erro && <div className="loginAlert error">{erro}</div>}

        <form onSubmit={concluir}>
          <div className="onboardingSectionTitle">
            <Building2 size={18} />
            <strong>Dados do representante</strong>
          </div>

          <div className="signupGrid">
            <label className="field">
              Seu nome
              <input
                type="text"
                required
                autoFocus
                value={cadastro.nome}
                onChange={(event) => atualizar("nome", event.target.value)}
                placeholder="Ex.: Bruno Torres"
              />
            </label>

            <label className="field">
              Nome da representação
              <input
                type="text"
                required
                value={cadastro.nomeRepresentacao}
                onChange={(event) => atualizar("nomeRepresentacao", event.target.value)}
                placeholder="Ex.: Torres Multi Representações"
              />
            </label>

            <label className="field">
              Tipo de documento
              <select
                value={cadastro.documentoTipo}
                onChange={(event) => atualizar("documentoTipo", event.target.value as "CPF" | "CNPJ")}
              >
                <option value="CPF">CPF</option>
                <option value="CNPJ">CNPJ</option>
              </select>
            </label>

            <label className="field">
              {cadastro.documentoTipo}
              <input
                type="text"
                inputMode="numeric"
                required
                value={cadastro.documento}
                onChange={(event) => atualizar("documento", event.target.value)}
                placeholder={cadastro.documentoTipo === "CPF" ? "000.000.000-00" : "00.000.000/0000-00"}
              />
            </label>

            <label className="field">
              WhatsApp
              <input
                type="tel"
                required
                value={cadastro.whatsapp}
                onChange={(event) => atualizar("whatsapp", event.target.value)}
                placeholder="(21) 99999-9999"
              />
            </label>

            <label className="field">
              CEP
              <input
                type="text"
                inputMode="numeric"
                required
                value={cadastro.cep}
                onChange={(event) => atualizar("cep", event.target.value)}
                placeholder="00000-000"
              />
            </label>

            <label className="field signupSpan2">
              Representadas
              <textarea
                required
                value={cadastro.representadas}
                onChange={(event) => atualizar("representadas", event.target.value)}
                placeholder={"Digite uma por linha. Ex.:\nKing Ouro\nArgamil\nVedacit"}
              />
              <small>Você pode cadastrar várias representadas.</small>
            </label>

            <label className="field signupSpan2">
              Endereço
              <input
                type="text"
                required
                value={cadastro.logradouro}
                onChange={(event) => atualizar("logradouro", event.target.value)}
                placeholder="Rua, avenida, estrada..."
              />
            </label>

            <label className="field">
              Número
              <input
                type="text"
                required
                value={cadastro.numero}
                onChange={(event) => atualizar("numero", event.target.value)}
              />
            </label>

            <label className="field">
              Complemento
              <input
                type="text"
                value={cadastro.complemento}
                onChange={(event) => atualizar("complemento", event.target.value)}
                placeholder="Opcional"
              />
            </label>

            <label className="field">
              Bairro
              <input
                type="text"
                required
                value={cadastro.bairro}
                onChange={(event) => atualizar("bairro", event.target.value)}
              />
            </label>

            <label className="field">
              Cidade
              <input
                type="text"
                required
                value={cadastro.cidade}
                onChange={(event) => atualizar("cidade", event.target.value)}
              />
            </label>

            <label className="field">
              UF
              <input
                type="text"
                required
                maxLength={2}
                value={cadastro.uf}
                onChange={(event) => atualizar("uf", event.target.value.toUpperCase())}
                placeholder="RJ"
              />
            </label>
          </div>

          <button className="primary wide onboardingSubmit" type="submit" disabled={salvando}>
            {salvando ? "Salvando..." : "Concluir primeiro acesso"}
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
