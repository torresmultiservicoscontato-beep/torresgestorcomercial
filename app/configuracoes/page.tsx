"use client";

import { FormEvent, useEffect, useState } from "react";
import { Building2, Save, ShieldCheck } from "lucide-react";
import AppShell from "../components/AppShell";
import { carregarPerfilAtual, salvarPerfilAtual } from "../lib/perfil";
import { supabase } from "../lib/supabase";

type FormPerfil = {
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

const vazio: FormPerfil = {
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

function normalizarRepresentadas(valor: string) {
  return Array.from(
    new Set(
      valor
        .split(/[\n,;]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export default function ConfiguracoesPage() {
  const [form, setForm] = useState<FormPerfil>(vazio);
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<"usuario" | "admin">("usuario");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  useEffect(() => {
    let ativo = true;

    void Promise.all([
      carregarPerfilAtual(),
      supabase?.auth.getUser() ?? Promise.resolve({ data: { user: null }, error: null }),
    ])
      .then(([perfil, usuario]) => {
        if (!ativo) return;
        if (!perfil) throw new Error("Perfil não encontrado.");

        setForm({
          nome: perfil.nome,
          nomeRepresentacao: perfil.nomeRepresentacao,
          documentoTipo: perfil.documentoTipo,
          documento: perfil.documento,
          whatsapp: perfil.whatsapp,
          representadas: perfil.representadas.join("\n"),
          cep: perfil.cep,
          logradouro: perfil.logradouro,
          numero: perfil.numero,
          complemento: perfil.complemento,
          bairro: perfil.bairro,
          cidade: perfil.cidade,
          uf: perfil.uf,
        });
        setPapel(perfil.papel);
        setEmail(usuario.data.user?.email ?? "");
      })
      .catch((falha: Error) => {
        if (ativo) setErro(falha.message);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  function atualizar(campo: keyof FormPerfil, valor: string) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (salvando) return;

    const representadas = normalizarRepresentadas(form.representadas);
    if (representadas.length === 0) {
      setErro("Informe pelo menos uma representada.");
      return;
    }

    setSalvando(true);
    setErro("");
    setSucesso("");

    try {
      const salvo = await salvarPerfilAtual({
        nome: form.nome,
        nomeRepresentacao: form.nomeRepresentacao,
        documentoTipo: form.documentoTipo,
        documento: form.documento,
        whatsapp: form.whatsapp,
        cep: form.cep,
        logradouro: form.logradouro,
        numero: form.numero,
        complemento: form.complemento,
        bairro: form.bairro,
        cidade: form.cidade,
        uf: form.uf,
        representadas,
      });

      setForm((atual) => ({ ...atual, representadas: salvo.representadas.join("\n") }));
      setSucesso("Configurações salvas com sucesso.");
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível salvar as configurações.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <AppShell>
      <header className="pageHeader">
        <div>
          <p className="eyebrow">MINHA CONTA</p>
          <h1>Configurações</h1>
          <p>Revise e atualize os dados informados no seu primeiro acesso.</p>
        </div>
      </header>

      {erro && <div className="loginAlert error settingsAlert">{erro}</div>}
      {sucesso && <div className="loginAlert success settingsAlert">{sucesso}</div>}

      {carregando ? (
        <section className="panel settingsPanel">Carregando suas configurações...</section>
      ) : (
        <form onSubmit={salvar}>
          <section className="panel settingsPanel">
            <div className="settingsSectionTitle">
              <ShieldCheck size={18} />
              <div>
                <strong>Conta</strong>
                <span>Dados de acesso e permissão.</span>
              </div>
            </div>

            <div className="formGrid">
              <label className="field">
                E-mail de acesso
                <input value={email} readOnly />
              </label>
              <label className="field">
                Nível de acesso
                <input value={papel === "admin" ? "Administrador" : "Usuário"} readOnly />
              </label>
            </div>
          </section>

          <section className="panel settingsPanel">
            <div className="settingsSectionTitle">
              <Building2 size={18} />
              <div>
                <strong>Perfil comercial</strong>
                <span>Informações usadas no painel e na operação.</span>
              </div>
            </div>

            <div className="formGrid">
              <label className="field">
                Seu nome
                <input
                  required
                  value={form.nome}
                  onChange={(event) => atualizar("nome", event.target.value)}
                />
              </label>

              <label className="field">
                Nome da representação
                <input
                  required
                  value={form.nomeRepresentacao}
                  onChange={(event) => atualizar("nomeRepresentacao", event.target.value)}
                />
              </label>

              <label className="field">
                Tipo de documento
                <select
                  value={form.documentoTipo}
                  onChange={(event) =>
                    atualizar("documentoTipo", event.target.value as "CPF" | "CNPJ")
                  }
                >
                  <option value="CPF">CPF</option>
                  <option value="CNPJ">CNPJ</option>
                </select>
              </label>

              <label className="field">
                {form.documentoTipo}
                <input
                  required
                  value={form.documento}
                  onChange={(event) => atualizar("documento", event.target.value)}
                />
              </label>

              <label className="field">
                WhatsApp
                <input
                  required
                  value={form.whatsapp}
                  onChange={(event) => atualizar("whatsapp", event.target.value)}
                />
              </label>

              <label className="field">
                CEP
                <input
                  required
                  value={form.cep}
                  onChange={(event) => atualizar("cep", event.target.value)}
                />
              </label>

              <label className="field span2">
                Representadas
                <textarea
                  required
                  rows={5}
                  value={form.representadas}
                  onChange={(event) => atualizar("representadas", event.target.value)}
                  placeholder={"Uma por linha. Ex.:\nKing Ouro\nArgamil"}
                />
                <small>Para adicionar outra representada, escreva o nome em uma nova linha.</small>
              </label>

              <label className="field span2">
                Endereço
                <input
                  required
                  value={form.logradouro}
                  onChange={(event) => atualizar("logradouro", event.target.value)}
                />
              </label>

              <label className="field">
                Número
                <input
                  required
                  value={form.numero}
                  onChange={(event) => atualizar("numero", event.target.value)}
                />
              </label>

              <label className="field">
                Complemento
                <input
                  value={form.complemento}
                  onChange={(event) => atualizar("complemento", event.target.value)}
                />
              </label>

              <label className="field">
                Bairro
                <input
                  required
                  value={form.bairro}
                  onChange={(event) => atualizar("bairro", event.target.value)}
                />
              </label>

              <label className="field">
                Cidade
                <input
                  required
                  value={form.cidade}
                  onChange={(event) => atualizar("cidade", event.target.value)}
                />
              </label>

              <label className="field">
                UF
                <input
                  required
                  maxLength={2}
                  value={form.uf}
                  onChange={(event) => atualizar("uf", event.target.value.toUpperCase())}
                />
              </label>
            </div>

            <div className="formActions">
              <button className="primary" type="submit" disabled={salvando}>
                <Save size={18} />
                {salvando ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </section>
        </form>
      )}
    </AppShell>
  );
}
