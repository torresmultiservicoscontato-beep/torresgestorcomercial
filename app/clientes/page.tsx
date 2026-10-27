"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Building2, CalendarClock, MapPinned, Pencil, Plus, Search, X } from "lucide-react";
import Paginacao from "../components/Paginacao";
import { usePaginacao } from "../hooks/usePaginacao";
import AppShell from "../components/AppShell";
import { carregarAcessoAtual, pode } from "../lib/acesso";
import {
  atualizarClienteDetalhado,
  carregarClientesDetalhados,
  criarClienteDetalhado,
  type ClienteDetalhado,
} from "../lib/clientesDetalhados";
import {
  carregarRepresentadasOperacionais,
  type RepresentadaOperacional,
} from "../lib/data";
import { listarRotasSemanais, type RotaSemanal } from "../lib/rotas";

const nomesDias: Record<number, string> = {
  1: "Segunda-feira",
  2: "Terça-feira",
  3: "Quarta-feira",
  4: "Quinta-feira",
  5: "Sexta-feira",
  6: "Sábado",
  7: "Domingo",
};

const formInicial = {
  nome: "",
  cidade: "",
  bairro: "",
  logradouro: "",
  numero: "",
  complemento: "",
  cep: "",
  representadaIds: [] as string[],
  telefone: "",
  status: "Ativo",
  rotaId: "",
  frequenciaVisita: "",
};

function enderecoResumido(cliente: ClienteDetalhado) {
  const linha1 = [cliente.logradouro, cliente.numero].filter(Boolean).join(", ");
  const linha2 = [cliente.bairro, cliente.cidade].filter(Boolean).join(" • ");
  return [linha1, linha2].filter(Boolean).join(" — ") || "Local não informado";
}

function nomeRota(rota: RotaSemanal) {
  const local = [rota.municipio, rota.bairros.join(" / ")].filter(Boolean).join(" • ");
  return `${nomesDias[rota.diaSemana] ?? "Dia"}${local ? ` — ${local}` : ""}`;
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<ClienteDetalhado[]>([]);
  const [representadas, setRepresentadas] = useState<RepresentadaOperacional[]>([]);
  const [rotas, setRotas] = useState<RotaSemanal[]>([]);
  const [rotasFormulario, setRotasFormulario] = useState<RotaSemanal[]>([]);
  const [busca, setBusca] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(formInicial);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [carregandoRotasFormulario, setCarregandoRotasFormulario] = useState(false);
  const [erro, setErro] = useState("");
  const [podeCadastrar, setPodeCadastrar] = useState(false);
  const [podeEditar, setPodeEditar] = useState(false);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        const acesso = await carregarAcessoAtual();
        if (!acesso) throw new Error("Não foi possível identificar seu acesso.");

        const podeVerRotas = pode(acesso, "rotas", "visualizar");
        const [listaClientes, listaRepresentadas, listaRotas] = await Promise.all([
          carregarClientesDetalhados(),
          carregarRepresentadasOperacionais(),
          podeVerRotas ? listarRotasSemanais() : Promise.resolve([] as RotaSemanal[]),
        ]);

        if (!ativo) return;
        setClientes(listaClientes);
        setRepresentadas(listaRepresentadas);
        setRotas(listaRotas);
        setRotasFormulario(listaRotas);
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
      } catch (falha) {
        if (!ativo) return;
        setErro(falha instanceof Error ? falha.message : "Não foi possível carregar os clientes.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void carregar();

    return () => {
      ativo = false;
    };
  }, []);

  const rotasPorId = useMemo(() => new Map(rotas.map((rota) => [rota.id, rota])), [rotas]);
  const rotasFormularioPorId = useMemo(
    () => new Map(rotasFormulario.map((rota) => [rota.id, rota])),
    [rotasFormulario],
  );

  const clientesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return clientes;

    return clientes.filter((cliente) => {
      const rota = cliente.rotaId ? rotasPorId.get(cliente.rotaId) : null;
      return [
        cliente.nome,
        cliente.cidade,
        cliente.bairro,
        cliente.logradouro,
        cliente.numero,
        cliente.complemento,
        cliente.cep,
        cliente.representada,
        cliente.telefone,
        cliente.frequenciaVisita,
        cliente.responsavelNome,
        rota ? nomeRota(rota) : "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(termo);
    });
  }, [busca, clientes, rotasPorId]);

  const paginacao = usePaginacao(clientesFiltrados, busca);

  function representadasPadrao() {
    return representadas.length === 1 ? [representadas[0].id] : [];
  }

  function fecharFormulario() {
    setEditandoId(null);
    setMostrarForm(false);
    setErro("");
    setRotasFormulario(rotas);
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

  async function editar(cliente: ClienteDetalhado) {
    if (!podeEditar) return;

    setEditandoId(cliente.id);
    setForm({
      nome: cliente.nome,
      cidade: cliente.cidade,
      bairro: cliente.bairro,
      logradouro: cliente.logradouro,
      numero: cliente.numero,
      complemento: cliente.complemento,
      cep: cliente.cep,
      representadaIds: cliente.representadas.map((item) => item.id),
      telefone: cliente.telefone,
      status: cliente.status,
      rotaId: cliente.rotaId ?? "",
      frequenciaVisita: cliente.frequenciaVisita,
    });
    setMostrarForm(true);
    setErro("");
    setCarregandoRotasFormulario(true);
    window.scrollTo({ top: 0, behavior: "smooth" });

    try {
      const rotasDoResponsavel = await listarRotasSemanais(cliente.responsavelUserId);
      setRotasFormulario(rotasDoResponsavel);
    } catch (falha) {
      setRotasFormulario([]);
      setErro(falha instanceof Error ? falha.message : "Não foi possível carregar as rotas deste responsável.");
    } finally {
      setCarregandoRotasFormulario(false);
    }
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

    const rotaSelecionada = form.rotaId ? rotasFormularioPorId.get(form.rotaId) : null;
    if (form.rotaId && !rotaSelecionada && form.rotaId !== clienteExistente?.rotaId) {
      setErro("A rota selecionada não está mais disponível para o responsável deste cliente.");
      return;
    }

    if (rotaSelecionada) {
      const compartilhaRepresentada = rotaSelecionada.representadas.some((representada) =>
        form.representadaIds.includes(representada.id),
      );
      if (!compartilhaRepresentada) {
        setErro("A rota escolhida precisa atender pelo menos uma das representadas deste cliente.");
        return;
      }

      if (!form.cidade.trim() || !form.logradouro.trim()) {
        setErro("Para colocar o cliente no mapa da rota, informe pelo menos cidade e logradouro.");
        return;
      }
    }

    const clienteParaSalvar: ClienteDetalhado = {
      id: editandoId ?? `cliente-${crypto.randomUUID()}`,
      nome: form.nome.trim(),
      cidade: form.cidade.trim(),
      bairro: form.bairro.trim(),
      logradouro: form.logradouro.trim(),
      numero: form.numero.trim(),
      complemento: form.complemento.trim(),
      cep: form.cep.trim(),
      representada: representadasSelecionadas.map((item) => item.nome).join(" • "),
      representadas: representadasSelecionadas,
      telefone: form.telefone.trim(),
      status: form.status,
      frequenciaVisita: form.frequenciaVisita,
      frequenciaDataBase: clienteExistente?.frequenciaDataBase ?? null,
      rotaId: form.rotaId || null,
      rotaOrdem: clienteExistente?.rotaOrdem ?? null,
      latitude: clienteExistente?.latitude ?? null,
      longitude: clienteExistente?.longitude ?? null,
      responsavelUserId: clienteExistente?.responsavelUserId,
      responsavelNome: clienteExistente?.responsavelNome,
      responsavelTipo: clienteExistente?.responsavelTipo,
      ultimaVisita: clienteExistente?.ultimaVisita ?? null,
      proximaVisitaPrevista: clienteExistente?.proximaVisitaPrevista ?? null,
    };

    setSalvando(true);
    setErro("");

    try {
      const clienteSalvo = editandoId
        ? await atualizarClienteDetalhado(clienteParaSalvar)
        : await criarClienteDetalhado(clienteParaSalvar);

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
          <p>Cadastre clientes, defina a frequência de visita e organize a cobertura comercial da carteira.</p>
          <span className="tag">Banco online</span>
        </div>
        {podeCadastrar && (
          <button
            className="primary"
            onClick={() => {
              if (mostrarForm) fecharFormulario();
              else {
                setRotasFormulario(rotas);
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

      {erro && <div className="loginAlert error settingsAlert">{erro}</div>}

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
            <label className="field span2">
              Logradouro
              <input value={form.logradouro} onChange={(event) => setForm({ ...form, logradouro: event.target.value })} placeholder="Ex.: Rua Doutor Siqueira" />
            </label>
            <label className="field">
              Número
              <input value={form.numero} onChange={(event) => setForm({ ...form, numero: event.target.value })} placeholder="Ex.: 125" />
            </label>
            <label className="field">
              Complemento
              <input value={form.complemento} onChange={(event) => setForm({ ...form, complemento: event.target.value })} placeholder="Loja, sala, referência..." />
            </label>
            <label className="field">
              Bairro
              <input value={form.bairro} onChange={(event) => setForm({ ...form, bairro: event.target.value })} placeholder="Ex.: Centro" />
            </label>
            <label className="field">
              Cidade
              <input value={form.cidade} onChange={(event) => setForm({ ...form, cidade: event.target.value })} placeholder="Ex.: Magé" />
            </label>
            <label className="field">
              CEP
              <input value={form.cep} onChange={(event) => setForm({ ...form, cep: event.target.value })} placeholder="25900-000" />
            </label>
            <label className="field">
              Telefone / WhatsApp
              <input value={form.telefone} onChange={(event) => setForm({ ...form, telefone: event.target.value })} placeholder="(21) 99999-9999" />
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

          <div className="permissionsBlock">
            <div className="settingsSectionTitle">
              <MapPinned size={18} />
              <div>
                <strong>Rota padrão do cliente</strong>
                <span>O vínculo é usado no mapa da rota e na organização da Agenda.</span>
              </div>
            </div>

            <label className="field">
              Dia / rota semanal
              <select
                value={form.rotaId}
                disabled={carregandoRotasFormulario}
                onChange={(event) => setForm({ ...form, rotaId: event.target.value })}
              >
                <option value="">{carregandoRotasFormulario ? "Carregando rotas..." : "Sem rota definida"}</option>
                {form.rotaId && !rotasFormularioPorId.has(form.rotaId) && (
                  <option value={form.rotaId}>Rota anterior (histórico preservado)</option>
                )}
                {rotasFormulario.map((rota) => (
                  <option key={rota.id} value={rota.id}>
                    {nomeRota(rota)} — {rota.representadas.map((item) => item.nome).join(" / ")}
                  </option>
                ))}
              </select>
              {!carregandoRotasFormulario && rotasFormulario.length === 0 && (
                <small>
                  {editandoId
                    ? "Este responsável ainda não possui uma rota semanal cadastrada. Cadastre a rota no painel dele antes de vincular este cliente."
                    : "Cadastre primeiro as rotas semanais para vincular clientes."}
                </small>
              )}
            </label>
          </div>

          <div className="permissionsBlock">
            <div className="settingsSectionTitle">
              <CalendarClock size={18} />
              <div>
                <strong>Frequência de visita do cliente</strong>
                <span>Ao definir uma frequência, o sistema programa os próximos 6 meses na Agenda sem deslocar o calendário por visitas extraordinárias.</span>
              </div>
            </div>

            <label className="field">
              Frequência
              <select value={form.frequenciaVisita} onChange={(event) => setForm({ ...form, frequenciaVisita: event.target.value })}>
                <option value="">Sem frequência definida</option>
                <option value="Semanal">Semanal (1 semana)</option>
                <option value="Quinzenal">Quinzenal (2 semanas)</option>
                <option value="A cada 3 semanas">A cada 3 semanas</option>
                <option value="A cada 4 semanas">A cada 4 semanas</option>
                <option value="Mensal">Mensal</option>
                <option value="Bimestral">Bimestral</option>
                <option value="Semestral">Semestral</option>
              </select>
              <small>A frequência é fixa. Retornos e visitas extras criados em Visitas ficam separados e não alteram esta programação.</small>
            </label>
          </div>

          <div className="formGrid">
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
            <button className="primary" type="submit" disabled={salvando || representadas.length === 0 || carregandoRotasFormulario}>
              {salvando ? "Salvando..." : editandoId ? "Salvar alterações" : "Salvar cliente"}
            </button>
          </div>
        </form>
      )}

      <div className="search">
        <Search size={19} />
        <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar por cliente, endereço, frequência, rota, telefone, representada ou responsável..." />
      </div>

      <section className="panel">
        <div className="panelTitle">
          <div>
            <p className="eyebrow">CARTEIRA</p>
            <h2>{carregando ? "Carregando clientes..." : `${clientesFiltrados.length} clientes encontrados`}</h2>
          </div>
        </div>

        <div className="clientList">
          {!carregando && paginacao.itens.map((cliente, indice) => {
            const rota = cliente.rotaId ? rotasPorId.get(cliente.rotaId) : null;
            return (
              <div className="client clientDetailed" key={cliente.id}>
                <div className="avatar">{cliente.nome.slice(0, 1).toUpperCase()}</div>
                <div className="clientInfo">
                  <strong>{cliente.nome}</strong>
                  <span>{enderecoResumido(cliente)}</span>
                  {cliente.cep && <span>CEP: {cliente.cep}</span>}
                  {cliente.telefone && <span>{cliente.telefone}</span>}
                  <div className="representadasTags">
                    {cliente.representadas.map((representada) => (
                      <span className="tag" key={representada.id}>{representada.nome}</span>
                    ))}
                    {rota && <span className="tag routeTag"><MapPinned size={11} /> {nomesDias[rota.diaSemana]}</span>}
                    {cliente.frequenciaVisita && <span className="tag"><CalendarClock size={11} /> {cliente.frequenciaVisita}</span>}
                  </div>
                  {cliente.frequenciaVisita && (
                    <span>
                      Última visita: {cliente.ultimaVisita ? cliente.ultimaVisita.split("-").reverse().join("/") : "Ainda não registrada"}
                      {" • "}
                      Próxima periódica: {cliente.proximaVisitaPrevista ? cliente.proximaVisitaPrevista.split("-").reverse().join("/") : "Sem evento futuro ativo"}
                    </span>
                  )}
                </div>
                <span className={cliente.responsavelTipo === "preposto" ? "adminBadge" : "tag"}>
                  {cliente.responsavelTipo === "preposto"
                    ? `Preposto: ${cliente.responsavelNome ?? "Não identificado"}`
                    : "Titular"}
                </span>
                <span className={paginacao.inicio + indice === 0 && cliente.status === "Visitar hoje" ? "status attention" : "status"}>{cliente.status}</span>
                {podeEditar && (
                  <button className="iconBtn editDataButton" type="button" onClick={() => void editar(cliente)} title="Editar cliente">
                    <Pencil size={15} />
                  </button>
                )}
              </div>
            );
          })}

          {!carregando && clientesFiltrados.length === 0 && <div className="emptyState">Nenhum cliente cadastrado ainda.</div>}
        </div>
        {!carregando && <Paginacao {...paginacao} nome="clientes" />}
      </section>
    </AppShell>
  );
}
