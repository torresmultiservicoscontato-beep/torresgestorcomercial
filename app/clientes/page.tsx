"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Building2, Pencil, Plus, Search, X } from "lucide-react";
import AppShell from "../components/AppShell";
import { carregarAcessoAtual, pode } from "../lib/acesso";
import {
  Cliente,
  RepresentadaOperacional,
  atualizarCliente,
  carregarClientes,
  carregarRepresentadasOperacionais,
  criarCliente,
} from "../lib/data";

const formInicial = {
  nome: "",
  cidade: "",
  bairro: "",
  representadaIds: [] as string[],
  telefone: "",
  status: "Ativo",
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [representadas, setRepresentadas] = useState<RepresentadaOperacional[]>([]);
  const [busca, setBusca] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(formInicial);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [podeCadastrar, setPodeCadastrar] = useState(false);
  const [podeEditar, setPodeEditar] = useState(false);

  useEffect(() => {
    let ativo = true;

    void Promise.all([carregarClientes(), carregarRepresentadasOperacionais(), carregarAcessoAtual()])
      .then(([listaClientes, listaRepresentadas, acesso]) => {
        if (!ativo) return;
        setClientes(listaClientes);
        setRepresentadas(listaRepresentadas);
        setPodeCadastrar(pode(acesso, "clientes", "cadastrar"));
        setPodeEditar(pode(acesso, "clientes", "editar"));
        setForm((atual) => ({
          ...atual,
          representadaIds:
            atual.representadaIds.length > 0
              ? atual.representadaIds
              : listaRepresentadas.length === 1
                ? [listaRepresentadas[0].id]
                : [],
        }));
      })
      .catch((falha: Error) => {
        if (!ativo) return;
        setErro(falha.message);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  const clientesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return clientes;

    return clientes.filter((cliente) =>
      [
        cliente.nome,
        cliente.cidade,
        cliente.bairro,
        cliente.representada,
        cliente.telefone,
        cliente.responsavelNome,
      ]
        .join(" ")
        .toLowerCase()
        .includes(termo),
    );
  }, [busca, clientes]);

  function representadasPadrao() {
    return representadas.length === 1 ? [representadas[0].id] : [];
  }

  function fecharFormulario() {
    setEditandoId(null);
    setMostrarForm(false);
    setForm({ ...formInicial, representadaIds: representadasPadrao() });
  }

  function alterarRepresentada(id: string, marcada: boolean) {
    setForm((atual) => ({
      ...atual,
      representadaIds: marcada
        ? Array.from(new Set([...atual.representadaIds, id]))
        : atual.representadaIds.filter((item) => item !== id),
    }));
  }

  function editar(cliente: Cliente) {
    if (!podeEditar) return;
    setEditandoId(cliente.id);
    setForm({
      nome: cliente.nome,
      cidade: cliente.cidade,
      bairro: cliente.bairro,
      representadaIds: cliente.representadas.map((item) => item.id),
      telefone: cliente.telefone,
      status: cliente.status,
    });
    setMostrarForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function salvarCliente(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.nome.trim() || salvando) return;
    if (form.representadaIds.length === 0) {
      setErro("Selecione pelo menos uma representada para este cliente.");
      return;
    }

    const clienteExistente = editandoId
      ? clientes.find((cliente) => cliente.id === editandoId)
      : null;

    const representadasSelecionadas = representadas.filter((item) => form.representadaIds.includes(item.id));
    if (representadasSelecionadas.length !== form.representadaIds.length) {
      setErro("Uma das representadas selecionadas não está disponível nesta operação.");
      return;
    }

    const clienteParaSalvar: Cliente = {
      id: editandoId ?? `cliente-${crypto.randomUUID()}`,
      nome: form.nome.trim(),
      cidade: form.cidade.trim(),
      bairro: form.bairro.trim(),
      representada: representadasSelecionadas.map((item) => item.nome).join(" • "),
      representadas: representadasSelecionadas,
      telefone: form.telefone.trim(),
      status: form.status,
      responsavelUserId: clienteExistente?.responsavelUserId,
      responsavelNome: clienteExistente?.responsavelNome,
      responsavelTipo: clienteExistente?.responsavelTipo,
    };

    setSalvando(true);
    setErro("");

    try {
      const clienteSalvo = editandoId
        ? await atualizarCliente(clienteParaSalvar)
        : await criarCliente(clienteParaSalvar);

      setClientes((lista) =>
        editandoId
          ? lista.map((cliente) => (cliente.id === clienteSalvo.id ? clienteSalvo : cliente))
          : [clienteSalvo, ...lista],
      );
      fecharFormulario();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível salvar o cliente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <AppShell>
      <header className="pageHeader">
        <div>
          <p className="eyebrow">CARTEIRA COMERCIAL</p>
          <h1>Clientes</h1>
          <p>Cadastre, localize e acompanhe a carteira comercial da operação.</p>
          <span className="tag">Banco online</span>
        </div>
        {podeCadastrar && (
          <button
            className="primary"
            onClick={() => {
              if (mostrarForm) fecharFormulario();
              else {
                setForm({ ...formInicial, representadaIds: representadasPadrao() });
                setMostrarForm(true);
              }
            }}
          >
            {mostrarForm ? <X size={18} /> : <Plus size={18} />}
            {mostrarForm ? "Fechar" : "Novo cliente"}
          </button>
        )}
      </header>

      {erro && <div className="emptyState">{erro}</div>}

      {mostrarForm && (
        <form className="panel formPanel" onSubmit={salvarCliente}>
          <div className="panelTitle">
            <div>
              <p className="eyebrow">{editandoId ? "ALTERAÇÃO" : "CADASTRO"}</p>
              <h2>{editandoId ? "Editar cliente" : "Novo cliente"}</h2>
            </div>
          </div>

          <div className="formGrid">
            <label className="field span2">
              Nome do cliente
              <input autoFocus required value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} placeholder="Ex.: Loja Central Materiais" />
            </label>
            <label className="field">
              Cidade
              <input value={form.cidade} onChange={(event) => setForm({ ...form, cidade: event.target.value })} placeholder="Ex.: Magé" />
            </label>
            <label className="field">
              Bairro
              <input value={form.bairro} onChange={(event) => setForm({ ...form, bairro: event.target.value })} placeholder="Ex.: Centro" />
            </label>
          </div>

          <div className="permissionsBlock">
            <div className="settingsSectionTitle">
              <Building2 size={18} />
              <div>
                <strong>Representadas atendidas pelo cliente</strong>
                <span>Marque uma ou mais representadas com as quais este cliente compra nesta carteira.</span>
              </div>
            </div>

            {representadas.length > 0 ? (
              <div className="representadasChecklist">
                {representadas.map((representada) => {
                  const selecionada = form.representadaIds.includes(representada.id);
                  return (
                    <label className="representadaOption" key={representada.id}>
                      <input
                        type="checkbox"
                        checked={selecionada}
                        onChange={(event) => alterarRepresentada(representada.id, event.target.checked)}
                      />
                      <span>
                        <strong>{representada.nome}</strong>
                        <small>{selecionada ? "Selecionada para este cliente" : "Disponível"}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="emptyState">Nenhuma representada disponível para esta operação.</div>
            )}
          </div>

          <div className="formGrid">
            <label className="field">
              Telefone / WhatsApp
              <input value={form.telefone} onChange={(event) => setForm({ ...form, telefone: event.target.value })} placeholder="(21) 99999-9999" />
            </label>
            <label className="field">
              Status
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option>Ativo</option>
                <option>Visitar hoje</option>
                <option>Retorno pendente</option>
                <option>Inativo</option>
              </select>
            </label>
          </div>

          <div className="formActions">
            <button className="secondary" type="button" onClick={fecharFormulario}>Cancelar</button>
            <button className="primary" type="submit" disabled={salvando || representadas.length === 0}>
              {salvando ? "Salvando..." : editandoId ? "Salvar alterações" : "Salvar cliente"}
            </button>
          </div>
        </form>
      )}

      <div className="search">
        <Search size={19} />
        <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar por cliente, cidade, bairro, telefone, representada ou responsável..." />
      </div>

      <section className="panel">
        <div className="panelTitle">
          <div>
            <p className="eyebrow">CARTEIRA</p>
            <h2>{carregando ? "Carregando clientes..." : `${clientesFiltrados.length} clientes encontrados`}</h2>
          </div>
        </div>

        <div className="clientList">
          {!carregando && clientesFiltrados.map((cliente, indice) => (
            <div className="client clientDetailed" key={cliente.id}>
              <div className="avatar">{cliente.nome.slice(0, 1).toUpperCase()}</div>
              <div className="clientInfo">
                <strong>{cliente.nome}</strong>
                <span>{[cliente.bairro, cliente.cidade].filter(Boolean).join(" • ") || "Local não informado"}</span>
                {cliente.telefone && <span>{cliente.telefone}</span>}
                <div className="representadasTags">
                  {cliente.representadas.map((representada) => (
                    <span className="tag" key={representada.id}>{representada.nome}</span>
                  ))}
                </div>
              </div>
              <span className={cliente.responsavelTipo === "preposto" ? "adminBadge" : "tag"}>
                {cliente.responsavelTipo === "preposto"
                  ? `Preposto: ${cliente.responsavelNome ?? "Não identificado"}`
                  : "Titular"}
              </span>
              <span className={indice === 0 && cliente.status === "Visitar hoje" ? "status attention" : "status"}>{cliente.status}</span>
              {podeEditar && (
                <button className="iconBtn editDataButton" type="button" onClick={() => editar(cliente)} title="Editar cliente">
                  <Pencil size={15} />
                </button>
              )}
            </div>
          ))}

          {!carregando && clientesFiltrados.length === 0 && <div className="emptyState">Nenhum cliente cadastrado ainda.</div>}
        </div>
      </section>
    </AppShell>
  );
}
