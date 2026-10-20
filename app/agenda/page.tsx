"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  ListFilter,
  Pencil,
  Plus,
  RotateCcw,
  X,
  XCircle,
} from "lucide-react";
import AppShell from "../components/AppShell";
import {
  atualizarStatusAgenda,
  carregarAgenda,
  salvarEventoAgenda,
  type ClienteAgenda,
  type ContextoAgenda,
  type EventoAgenda,
  type PrioridadeAgenda,
  type RepresentadaAgenda,
  type ResponsavelAgenda,
  type StatusAgenda,
  type TipoAgenda,
} from "../lib/agenda";
import styles from "./agenda.module.css";

type VisaoAgenda = "hoje" | "semana" | "mes" | "lista";

const tipos: TipoAgenda[] = ["Retorno", "Visita", "Ligação", "WhatsApp", "Reunião", "Cobrança", "Outro"];
const prioridades: PrioridadeAgenda[] = ["Baixa", "Normal", "Alta"];
const statusOpcoes: StatusAgenda[] = ["Pendente", "Concluído", "Cancelado"];
const diasSemana = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function hojeLocal() {
  const agora = new Date();
  return dataIso(agora);
}

function dataIso(data: Date) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function parseData(valor: string) {
  const [ano, mes, dia] = valor.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

function somarDias(valor: string, dias: number) {
  const data = parseData(valor);
  data.setDate(data.getDate() + dias);
  return dataIso(data);
}

function inicioSemana(valor: string) {
  const data = parseData(valor);
  const dia = data.getDay();
  const deslocamento = dia === 0 ? -6 : 1 - dia;
  data.setDate(data.getDate() + deslocamento);
  return dataIso(data);
}

function fimSemana(valor: string) {
  return somarDias(inicioSemana(valor), 6);
}

function inicioMes(valor: string) {
  const data = parseData(valor);
  return dataIso(new Date(data.getFullYear(), data.getMonth(), 1));
}

function fimMes(valor: string) {
  const data = parseData(valor);
  return dataIso(new Date(data.getFullYear(), data.getMonth() + 1, 0));
}

function moverMes(valor: string, deslocamento: number) {
  const data = parseData(valor);
  const dia = data.getDate();
  const destino = new Date(data.getFullYear(), data.getMonth() + deslocamento, 1);
  const ultimo = new Date(destino.getFullYear(), destino.getMonth() + 1, 0).getDate();
  destino.setDate(Math.min(dia, ultimo));
  return dataIso(destino);
}

function dataBr(valor: string) {
  return valor ? valor.split("-").reverse().join("/") : "—";
}

function dataLonga(valor: string) {
  return parseData(valor).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formVazio(responsavelUserId = "") {
  return {
    id: "",
    responsavelUserId,
    clienteId: "",
    representadaId: "",
    tipo: "Retorno" as TipoAgenda,
    titulo: "",
    data: hojeLocal(),
    hora: "",
    prioridade: "Normal" as PrioridadeAgenda,
    observacao: "",
  };
}

export default function AgendaPage() {
  const [contexto, setContexto] = useState<ContextoAgenda | null>(null);
  const [eventos, setEventos] = useState<EventoAgenda[]>([]);
  const [responsaveis, setResponsaveis] = useState<ResponsavelAgenda[]>([]);
  const [clientes, setClientes] = useState<ClienteAgenda[]>([]);
  const [representadas, setRepresentadas] = useState<RepresentadaAgenda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  const [visao, setVisao] = useState<VisaoAgenda>("mes");
  const [dataReferencia, setDataReferencia] = useState(hojeLocal());
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(formVazio());

  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroRepresentada, setFiltroRepresentada] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroResponsavel, setFiltroResponsavel] = useState("");
  const [filtroInicio, setFiltroInicio] = useState("");
  const [filtroFim, setFiltroFim] = useState("");

  async function recarregar() {
    const dados = await carregarAgenda();
    setContexto(dados.contexto);
    setEventos(dados.eventos);
    setResponsaveis(dados.responsaveis);
    setClientes(dados.clientes);
    setRepresentadas(dados.representadas);

    if (dados.contexto.responsavelForcadoId) {
      setFiltroResponsavel(dados.contexto.responsavelForcadoId ?? "");
    } else if (dados.contexto.modo === "preposto") {
      setFiltroResponsavel(dados.responsaveis[0]?.userId ?? "");
    }
  }

  useEffect(() => {
    let ativo = true;

    void carregarAgenda()
      .then((agenda) => {
        if (!ativo) return;

        setContexto(agenda.contexto);
        setEventos(agenda.eventos);
        setResponsaveis(agenda.responsaveis);
        setClientes(agenda.clientes);
        setRepresentadas(agenda.representadas);

        const responsavelInicial =
          agenda.contexto.responsavelForcadoId
          || (agenda.contexto.modo === "preposto" ? agenda.responsaveis[0]?.userId : "")
          || "";

        setFiltroResponsavel(agenda.contexto.responsavelForcadoId ?? "");
        setForm(formVazio(responsavelInicial));
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

  const intervaloVisao = useMemo(() => {
    if (visao === "hoje") return { inicio: dataReferencia, fim: dataReferencia };
    if (visao === "semana") return { inicio: inicioSemana(dataReferencia), fim: fimSemana(dataReferencia) };
    if (visao === "mes") return { inicio: inicioMes(dataReferencia), fim: fimMes(dataReferencia) };
    return { inicio: "", fim: "" };
  }, [visao, dataReferencia]);

  const filtrados = useMemo(() => {
    return eventos.filter((evento) => {
      const bateTipo = !filtroTipo || evento.tipo === filtroTipo;
      const bateRepresentada = !filtroRepresentada || evento.representadaIds.includes(filtroRepresentada);
      const bateCliente = !filtroCliente || evento.clienteId === filtroCliente;
      const bateStatus = !filtroStatus || evento.status === filtroStatus;
      const bateResponsavel = !filtroResponsavel || evento.responsavelUserId === filtroResponsavel;
      const bateInicio = !filtroInicio || evento.data >= filtroInicio;
      const bateFim = !filtroFim || evento.data <= filtroFim;
      const bateVisaoInicio = !intervaloVisao.inicio || evento.data >= intervaloVisao.inicio;
      const bateVisaoFim = !intervaloVisao.fim || evento.data <= intervaloVisao.fim;

      return bateTipo
        && bateRepresentada
        && bateCliente
        && bateStatus
        && bateResponsavel
        && bateInicio
        && bateFim
        && bateVisaoInicio
        && bateVisaoFim;
    });
  }, [
    eventos,
    filtroTipo,
    filtroRepresentada,
    filtroCliente,
    filtroStatus,
    filtroResponsavel,
    filtroInicio,
    filtroFim,
    intervaloVisao,
  ]);

  const resumo = useMemo(() => {
    const hoje = hojeLocal();
    return {
      pendentes: filtrados.filter((evento) => evento.status === "Pendente").length,
      hoje: filtrados.filter((evento) => evento.status === "Pendente" && evento.data === hoje).length,
      atrasados: filtrados.filter((evento) => evento.status === "Pendente" && evento.data < hoje).length,
      concluidos: filtrados.filter((evento) => evento.status === "Concluído").length,
    };
  }, [filtrados]);

  const eventosOrdenados = useMemo(
    () => [...filtrados].sort((a, b) =>
      a.data.localeCompare(b.data)
      || (a.hora || "99:99").localeCompare(b.hora || "99:99")
      || a.titulo.localeCompare(b.titulo, "pt-BR")
    ),
    [filtrados],
  );

  const diasMes = useMemo(() => {
    const inicio = parseData(inicioMes(dataReferencia));
    const fim = parseData(fimMes(dataReferencia));
    const primeiroDia = inicio.getDay();
    const antes = primeiroDia === 0 ? 6 : primeiroDia - 1;
    const inicioGrade = new Date(inicio);
    inicioGrade.setDate(inicio.getDate() - antes);

    const ultimoDia = fim.getDay();
    const depois = ultimoDia === 0 ? 0 : 7 - ultimoDia;
    const fimGrade = new Date(fim);
    fimGrade.setDate(fim.getDate() + depois);

    const resultado: string[] = [];
    const cursor = new Date(inicioGrade);

    while (cursor <= fimGrade) {
      resultado.push(dataIso(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    return resultado;
  }, [dataReferencia]);

  const diasSemanaAtual = useMemo(() => {
    const inicio = inicioSemana(dataReferencia);
    return Array.from({ length: 7 }, (_, indice) => somarDias(inicio, indice));
  }, [dataReferencia]);

  function eventosDoDia(data: string) {
    return eventosOrdenados.filter((evento) => evento.data === data);
  }

  function limparFiltros() {
    setFiltroTipo("");
    setFiltroRepresentada("");
    setFiltroCliente("");
    setFiltroStatus("");
    setFiltroInicio("");
    setFiltroFim("");
    if (!contexto?.responsavelForcadoId && contexto?.modo !== "preposto") setFiltroResponsavel("");
  }

  function navegar(direcao: -1 | 1) {
    if (visao === "hoje") setDataReferencia(somarDias(dataReferencia, direcao));
    if (visao === "semana") setDataReferencia(somarDias(dataReferencia, direcao * 7));
    if (visao === "mes") setDataReferencia(moverMes(dataReferencia, direcao));
  }

  function tituloPeriodo() {
    if (visao === "hoje") return dataLonga(dataReferencia);
    if (visao === "semana") return `${dataBr(inicioSemana(dataReferencia))} a ${dataBr(fimSemana(dataReferencia))}`;
    if (visao === "mes") {
      return parseData(dataReferencia).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    }
    return "Todas as atividades";
  }

  function novoEvento() {
    const responsavel =
      contexto?.responsavelForcadoId
      || (contexto?.modo === "preposto" ? responsaveis[0]?.userId : contexto?.titularUserId)
      || "";

    setForm(formVazio(responsavel));
    setMostrarForm(true);
    setErro("");
    setMensagem("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editarEvento(evento: EventoAgenda) {
    if (evento.origem !== "manual") return;

    setForm({
      id: evento.id,
      responsavelUserId: evento.responsavelUserId,
      clienteId: evento.clienteId ?? "",
      representadaId: evento.representadaIds[0] ?? "",
      tipo: evento.tipo,
      titulo: evento.titulo,
      data: evento.data,
      hora: evento.hora,
      prioridade: evento.prioridade,
      observacao: evento.observacao,
    });
    setMostrarForm(true);
    setErro("");
    setMensagem("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function fecharForm() {
    setMostrarForm(false);
    setForm(formVazio(
      contexto?.responsavelForcadoId
      || (contexto?.modo === "preposto" ? responsaveis[0]?.userId : contexto?.titularUserId)
      || "",
    ));
  }

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (salvando) return;

    setSalvando(true);
    setErro("");
    setMensagem("");

    try {
      await salvarEventoAgenda({
        id: form.id || null,
        responsavelUserId: form.responsavelUserId || null,
        clienteId: form.clienteId || null,
        representadaId: form.representadaId || null,
        tipo: form.tipo,
        titulo: form.titulo,
        data: form.data,
        hora: form.hora || null,
        prioridade: form.prioridade,
        observacao: form.observacao,
      });

      await recarregar();
      setMensagem(form.id ? "Atividade atualizada." : "Atividade adicionada à Agenda.");
      fecharForm();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível salvar a atividade.");
    } finally {
      setSalvando(false);
    }
  }

  async function alterarStatus(evento: EventoAgenda, status: StatusAgenda) {
    setErro("");
    setMensagem("");

    try {
      await atualizarStatusAgenda(evento.id, status);
      await recarregar();
      setMensagem(
        status === "Concluído"
          ? "Atividade concluída."
          : status === "Cancelado"
            ? "Atividade cancelada."
            : "Atividade reaberta.",
      );
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível atualizar a atividade.");
    }
  }

  function renderEvento(evento: EventoAgenda, compacto = false) {
    const atrasado = evento.status === "Pendente" && evento.data < hojeLocal();

    return (
      <article
        className={`${styles.eventCard} ${atrasado ? styles.overdue : ""} ${evento.status === "Concluído" ? styles.done : ""}`}
        key={evento.id}
      >
        <button
          className={styles.eventMain}
          type="button"
          onClick={() => {
            if (compacto) {
              setVisao("hoje");
              setDataReferencia(evento.data);
              setAbertoId(evento.id);
              return;
            }
            setAbertoId(abertoId === evento.id ? null : evento.id);
          }}
        >
          <div className={styles.eventTime}>
            <Clock3 size={14} />
            <strong>{evento.hora || "Sem horário"}</strong>
          </div>
          <div className={styles.eventInfo}>
            <div className={styles.eventTitleLine}>
              <strong>{evento.titulo}</strong>
              <span className={styles.origin}>{evento.origem === "visita" ? "Visita" : "Manual"}</span>
            </div>
            <span>
              {evento.clienteNome}
              {evento.representadaNomes.length ? ` • ${evento.representadaNomes.join(" • ")}` : ""}
              {!compacto ? ` • ${evento.responsavelNome}` : ""}
            </span>
          </div>
          <div className={styles.badges}>
            <span className={`${styles.priority} ${evento.prioridade === "Alta" ? styles.high : ""}`}>{evento.prioridade}</span>
            <span className={styles.status}>{evento.status}</span>
          </div>
        </button>

        {!compacto && abertoId === evento.id && (
          <div className={styles.eventDetails}>
            <div className={styles.detailGrid}>
              <div><span>Data</span><strong>{dataBr(evento.data)}</strong></div>
              <div><span>Tipo</span><strong>{evento.tipo}</strong></div>
              <div><span>Responsável</span><strong>{evento.responsavelNome}</strong></div>
              <div><span>Origem</span><strong>{evento.origem === "visita" ? "Próxima ação de visita" : "Cadastro manual"}</strong></div>
            </div>

            {evento.observacao && <p>{evento.observacao}</p>}

            <div className={styles.eventActions}>
              {evento.clienteId && <Link className="secondary" href="/clientes">Abrir cliente</Link>}
              {evento.visitaId && <Link className="secondary" href="/visitas">Abrir visita</Link>}

              {contexto?.podeEditar && evento.origem === "manual" && (
                <button className="secondary" type="button" onClick={() => editarEvento(evento)}>
                  <Pencil size={14} /> Editar
                </button>
              )}

              {contexto?.podeEditar && evento.status === "Pendente" && (
                <>
                  <button className="primary" type="button" onClick={() => void alterarStatus(evento, "Concluído")}>
                    <CheckCircle2 size={14} /> Concluir
                  </button>
                  <button className="secondary" type="button" onClick={() => void alterarStatus(evento, "Cancelado")}>
                    <XCircle size={14} /> Cancelar
                  </button>
                </>
              )}

              {contexto?.podeEditar && evento.status !== "Pendente" && (
                <button className="secondary" type="button" onClick={() => void alterarStatus(evento, "Pendente")}>
                  <RotateCcw size={14} /> Reabrir
                </button>
              )}
            </div>
          </div>
        )}
      </article>
    );
  }

  return (
    <AppShell>
      <header className="pageHeader">
        <div>
          <p className="eyebrow">ORGANIZAÇÃO COMERCIAL</p>
          <h1>Agenda</h1>
          <p>
            {contexto?.modo === "preposto"
              ? "Acompanhe seus retornos, visitas e atividades em um único calendário."
              : "Organize sua agenda e acompanhe também as atividades da equipe."}
          </p>
        </div>

        {contexto?.podeCadastrar && (
          <button className="primary" type="button" onClick={mostrarForm ? fecharForm : novoEvento}>
            {mostrarForm ? <X size={17} /> : <Plus size={17} />}
            {mostrarForm ? "Fechar" : "Nova atividade"}
          </button>
        )}
      </header>

      {erro && <div className="loginAlert error settingsAlert">{erro}</div>}
      {mensagem && <div className="loginAlert success settingsAlert">{mensagem}</div>}

      {mostrarForm && (
        <form className={`panel ${styles.formPanel}`} onSubmit={salvar}>
          <div className="panelTitle">
            <div>
              <p className="eyebrow">{form.id ? "EDITAR ATIVIDADE" : "NOVA ATIVIDADE"}</p>
              <h2>{form.id ? "Atualizar compromisso" : "Adicionar à Agenda"}</h2>
            </div>
          </div>

          <div className="formGrid">
            {contexto?.modo === "gestao" && (
              <label className="field">
                Responsável *
                <select
                  required
                  value={form.responsavelUserId}
                  disabled={Boolean(contexto.responsavelForcadoId)}
                  onChange={(event) => setForm({ ...form, responsavelUserId: event.target.value })}
                >
                  <option value="">Selecionar</option>
                  {responsaveis.map((item) => (
                    <option key={item.userId} value={item.userId}>
                      {item.nome} {item.tipo === "preposto" ? "— Preposto" : "— Representante"}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="field">
              Tipo *
              <select value={form.tipo} onChange={(event) => setForm({ ...form, tipo: event.target.value as TipoAgenda })}>
                {tipos.map((tipo) => <option key={tipo}>{tipo}</option>)}
              </select>
            </label>

            <label className="field span2">
              Título *
              <input required value={form.titulo} onChange={(event) => setForm({ ...form, titulo: event.target.value })} placeholder="Ex.: Retornar cotação do cliente" />
            </label>

            <label className="field">
              Cliente
              <select value={form.clienteId} onChange={(event) => setForm({ ...form, clienteId: event.target.value })}>
                <option value="">Sem cliente</option>
                {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
              </select>
            </label>

            <label className="field">
              Representada
              <select value={form.representadaId} onChange={(event) => setForm({ ...form, representadaId: event.target.value })}>
                <option value="">Sem representada</option>
                {representadas.map((representada) => <option key={representada.id} value={representada.id}>{representada.nome}</option>)}
              </select>
            </label>

            <label className="field">
              Data *
              <input required type="date" value={form.data} onChange={(event) => setForm({ ...form, data: event.target.value })} />
            </label>

            <label className="field">
              Horário
              <input type="time" value={form.hora} onChange={(event) => setForm({ ...form, hora: event.target.value })} />
            </label>

            <label className="field">
              Prioridade
              <select value={form.prioridade} onChange={(event) => setForm({ ...form, prioridade: event.target.value as PrioridadeAgenda })}>
                {prioridades.map((prioridade) => <option key={prioridade}>{prioridade}</option>)}
              </select>
            </label>

            <label className="field span2">
              Observações
              <textarea rows={3} value={form.observacao} onChange={(event) => setForm({ ...form, observacao: event.target.value })} />
            </label>
          </div>

          <div className="formActions">
            <button className="secondary" type="button" onClick={fecharForm}>Cancelar</button>
            <button className="primary" type="submit" disabled={salvando}>
              <CalendarCheck2 size={16} />
              {salvando ? "Salvando..." : form.id ? "Salvar alterações" : "Adicionar à Agenda"}
            </button>
          </div>
        </form>
      )}

      <section className={styles.viewBar}>
        <div className={styles.viewSwitch}>
          <button type="button" className={visao === "hoje" ? styles.active : ""} onClick={() => { setVisao("hoje"); setDataReferencia(hojeLocal()); }}>Hoje</button>
          <button type="button" className={visao === "semana" ? styles.active : ""} onClick={() => setVisao("semana")}>Semana</button>
          <button type="button" className={visao === "mes" ? styles.active : ""} onClick={() => setVisao("mes")}>Mês</button>
          <button type="button" className={visao === "lista" ? styles.active : ""} onClick={() => setVisao("lista")}>Lista</button>
        </div>

        <div className={styles.periodNav}>
          {visao !== "lista" && (
            <button className="iconBtn" type="button" onClick={() => navegar(-1)} title="Período anterior"><ChevronLeft size={17} /></button>
          )}
          <strong>{tituloPeriodo()}</strong>
          {visao !== "lista" && (
            <button className="iconBtn" type="button" onClick={() => navegar(1)} title="Próximo período"><ChevronRight size={17} /></button>
          )}
          {visao !== "lista" && dataReferencia !== hojeLocal() && (
            <button className="secondary" type="button" onClick={() => setDataReferencia(hojeLocal())}>Hoje</button>
          )}
        </div>
      </section>

      <section className={styles.stats}>
        <article><CalendarClock size={18} /><span>Pendentes</span><strong>{resumo.pendentes}</strong></article>
        <article><CalendarCheck2 size={18} /><span>Hoje</span><strong>{resumo.hoje}</strong></article>
        <article className={resumo.atrasados ? styles.alertStat : ""}><CircleAlert size={18} /><span>Atrasados</span><strong>{resumo.atrasados}</strong></article>
        <article><CheckCircle2 size={18} /><span>Concluídos</span><strong>{resumo.concluidos}</strong></article>
      </section>

      <section className={styles.filters}>
        <label className="field">
          Tipo
          <select value={filtroTipo} onChange={(event) => setFiltroTipo(event.target.value)}>
            <option value="">Todos</option>
            {tipos.map((tipo) => <option key={tipo}>{tipo}</option>)}
          </select>
        </label>

        <label className="field">
          Representada
          <select value={filtroRepresentada} onChange={(event) => setFiltroRepresentada(event.target.value)}>
            <option value="">Todas</option>
            {representadas.map((representada) => <option key={representada.id} value={representada.id}>{representada.nome}</option>)}
          </select>
        </label>

        <label className="field">
          Cliente
          <select value={filtroCliente} onChange={(event) => setFiltroCliente(event.target.value)}>
            <option value="">Todos</option>
            {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
          </select>
        </label>

        <label className="field">
          Status
          <select value={filtroStatus} onChange={(event) => setFiltroStatus(event.target.value)}>
            <option value="">Todos</option>
            {statusOpcoes.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>

        {contexto?.modo === "gestao" && (
          <label className="field">
            Responsável
            <select
              value={filtroResponsavel}
              disabled={Boolean(contexto.responsavelForcadoId)}
              onChange={(event) => setFiltroResponsavel(event.target.value)}
            >
              <option value="">Toda a equipe</option>
              {responsaveis.map((item) => <option key={item.userId} value={item.userId}>{item.nome}</option>)}
            </select>
          </label>
        )}

        <label className="field">
          De
          <input type="date" value={filtroInicio} onChange={(event) => setFiltroInicio(event.target.value)} />
        </label>

        <label className="field">
          Até
          <input type="date" value={filtroFim} onChange={(event) => setFiltroFim(event.target.value)} />
        </label>

        <button className="secondary" type="button" onClick={limparFiltros}>
          <ListFilter size={15} /> Limpar filtros
        </button>
      </section>

      {carregando ? (
        <section className="panel">Carregando Agenda...</section>
      ) : visao === "mes" ? (
        <section className={`panel ${styles.calendarPanel}`}>
          <div className={styles.weekHeader}>
            {diasSemana.map((dia) => <strong key={dia}>{dia}</strong>)}
          </div>

          <div className={styles.monthGrid}>
            {diasMes.map((data) => {
              const eventosDia = eventosDoDia(data);
              const foraDoMes = data.slice(0, 7) !== dataReferencia.slice(0, 7);
              const ehHoje = data === hojeLocal();

              return (
                <div className={`${styles.dayCell} ${foraDoMes ? styles.outside : ""} ${ehHoje ? styles.today : ""}`} key={data}>
                  <div className={styles.dayNumber}>
                    <strong>{parseData(data).getDate()}</strong>
                    {eventosDia.length > 0 && <span>{eventosDia.length}</span>}
                  </div>

                  <div className={styles.dayEvents}>
                    {eventosDia.slice(0, 3).map((evento) => (
                      <button
                        key={evento.id}
                        type="button"
                        className={`${styles.miniEvent} ${evento.status === "Concluído" ? styles.doneMini : ""}`}
                        onClick={() => {
                          setVisao("hoje");
                          setDataReferencia(data);
                          setAbertoId(evento.id);
                        }}
                      >
                        <span>{evento.hora || "•"}</span>
                        <strong>{evento.titulo}</strong>
                      </button>
                    ))}
                    {eventosDia.length > 3 && (
                      <button className={styles.moreEvents} type="button" onClick={() => { setVisao("hoje"); setDataReferencia(data); }}>
                        +{eventosDia.length - 3} atividades
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : visao === "semana" ? (
        <section className={styles.weekGrid}>
          {diasSemanaAtual.map((data, indice) => {
            const lista = eventosDoDia(data);
            return (
              <article className={`panel ${styles.weekDay}`} key={data}>
                <div className={styles.weekDayHeader}>
                  <span>{diasSemana[indice]}</span>
                  <strong>{parseData(data).getDate()}</strong>
                </div>

                <div className={styles.weekEvents}>
                  {lista.map((evento) => renderEvento(evento, true))}
                  {lista.length === 0 && <small>Sem atividades</small>}
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className={styles.list}>
          {visao === "hoje" && (
            <div className={styles.listTitle}>
              <CalendarClock size={18} />
              <strong>{dataLonga(dataReferencia)}</strong>
            </div>
          )}

          {eventosOrdenados.map((evento) => renderEvento(evento))}

          {eventosOrdenados.length === 0 && (
            <div className="panel emptyState">Nenhuma atividade encontrada para os filtros e período selecionados.</div>
          )}
        </section>
      )}
    </AppShell>
  );
}
