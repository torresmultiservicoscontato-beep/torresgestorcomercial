"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Building2, CalendarClock, Car, ClipboardCheck, DollarSign, MapPin, Pencil, PhoneCall, X } from "lucide-react";
import AppShell from "../components/AppShell";
import { carregarAcessoAtual, pode } from "../lib/acesso";
import {
  Cliente,
  carregarClientes,
  carregarRepresentadasOperacionais,
  type RepresentadaOperacional,
} from "../lib/data";
import {
  atualizarVisitaDetalhada,
  carregarVisitasDetalhadas,
  criarVisitaDetalhada,
  type TipoContato,
  type VisitaDetalhada,
} from "../lib/visitasDetalhadas";

function hojeLocal() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function formInicial() {
  return {
    clienteId: "",
    representadaIds: [] as string[],
    data: hojeLocal(),
    horaEntrada: "",
    horaSaida: "",
    odometroChegada: "",
    origemClienteId: "",
    destinoClienteId: "",
    tipoContato: "Presencial" as TipoContato,
    houveVenda: false,
    valorVenda: "",
    origemVenda: "",
    resultado: "Sem venda",
    proximaAcao: "Retorno",
    proximaData: "",
    frequencia: "",
    statusCliente: "Ativo",
    observacao: "",
  };
}

function minutosEntre(inicio: string, fim: string) {
  if (!inicio || !fim) return null;
  const [hi, mi] = inicio.split(":").map(Number);
  const [hf, mf] = fim.split(":").map(Number);
  if (![hi, mi, hf, mf].every(Number.isFinite)) return null;
  const minutos = hf * 60 + mf - (hi * 60 + mi);
  return minutos >= 0 ? minutos : null;
}

function formatarDuracao(minutos: number | null) {
  if (minutos === null) return "—";
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas}h ${resto}min` : `${horas}h`;
}

function numeroCampo(valor: string) {
  const convertido = Number(valor.replace(",", "."));
  return Number.isFinite(convertido) ? convertido : null;
}

function formatarKm(valor: number | null) {
  if (valor === null) return "—";
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const diasPorFrequencia: Record<string, number> = {
  "1 semana": 7,
  "2 semanas": 14,
  "3 semanas": 21,
  "4 semanas": 28,
  "30 dias": 30,
  "60 dias": 60,
  "90 dias": 90,
};

function somarDias(data: string, dias: number) {
  if (!data) return "";
  const [ano, mes, dia] = data.split("-").map(Number);
  if (!ano || !mes || !dia) return "";
  const valor = new Date(Date.UTC(ano, mes - 1, dia));
  valor.setUTCDate(valor.getUTCDate() + dias);
  return valor.toISOString().slice(0, 10);
}

function proximaDataAutomatica(data: string, proximaAcao: string, frequencia: string) {
  if (proximaAcao !== "Retorno") return "";
  const dias = diasPorFrequencia[frequencia];
  return dias ? somarDias(data, dias) : "";
}

export default function VisitasPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [visitas, setVisitas] = useState<VisitaDetalhada[]>([]);
  const [representadasOperacionais, setRepresentadasOperacionais] = useState<RepresentadaOperacional[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState(formInicial());
  const [podeCadastrar, setPodeCadastrar] = useState(false);
  const [podeEditar, setPodeEditar] = useState(false);

  useEffect(() => {
    let ativo = true;

    void Promise.all([
      carregarClientes(),
      carregarVisitasDetalhadas(),
      carregarRepresentadasOperacionais(),
      carregarAcessoAtual(),
    ])
      .then(([listaClientes, listaVisitas, listaRepresentadas, acesso]) => {
        if (!ativo) return;
        setClientes(listaClientes);
        setVisitas(listaVisitas);
        setRepresentadasOperacionais(listaRepresentadas);
        setPodeCadastrar(pode(acesso, "visitas", "cadastrar"));
        setPodeEditar(pode(acesso, "visitas", "editar"));
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

  useEffect(() => {
    const calculada = proximaDataAutomatica(form.data, form.proximaAcao, form.frequencia);
    if (!calculada || calculada === form.proximaData) return;
    setForm((atual) => ({ ...atual, proximaData: calculada }));
  }, [form.data, form.proximaAcao, form.frequencia, form.proximaData]);

  const visitasOrdenadas = useMemo(
    () => [...visitas].sort((a, b) => `${b.data} ${b.horaEntrada}`.localeCompare(`${a.data} ${a.horaEntrada}`)),
    [visitas],
  );

  const clienteSelecionado = useMemo(
    () => clientes.find((cliente) => cliente.id === form.clienteId) ?? null,
    [clientes, form.clienteId],
  );

  const representadasDoClienteIds = useMemo(
    () => new Set(clienteSelecionado?.representadas.map((item) => item.id) ?? []),
    [clienteSelecionado],
  );

  function encontrarVisitaAnterior(data: string, horaEntrada: string) {
    return [...visitas]
      .filter((visita) => {
        if (visita.data !== data || visita.id === editandoId) return false;
        if (!horaEntrada || !visita.horaEntrada) return true;
        return visita.horaEntrada < horaEntrada;
      })
      .sort((a, b) => (b.horaEntrada || "").localeCompare(a.horaEntrada || ""))[0] ?? null;
  }

  const visitaAnterior = useMemo(
    () => encontrarVisitaAnterior(form.data, form.horaEntrada),
    [visitas, form.data, form.horaEntrada, editandoId],
  );

  const duracaoCalculada = useMemo(
    () => minutosEntre(form.horaEntrada, form.horaSaida),
    [form.horaEntrada, form.horaSaida],
  );

  const kmCalculado = useMemo(() => {
    const atual = numeroCampo(form.odometroChegada);
    const anterior = numeroCampo(visitaAnterior?.odometroChegada ?? "");
    if (atual === null || anterior === null || atual < anterior) return null;
    return Math.round((atual - anterior) * 10) / 10;
  }, [form.odometroChegada, visitaAnterior]);

  function cancelarEdicao() {
    setEditandoId(null);
    setForm(formInicial());
    setErro("");
  }

  function alterarRepresentada(id: string, marcada: boolean) {
    setForm((atual) => ({
      ...atual,
      representadaIds: marcada
        ? Array.from(new Set([...atual.representadaIds, id]))
        : atual.representadaIds.filter((item) => item !== id),
    }));
  }

  function selecionarCliente(clienteId: string) {
    const cliente = clientes.find((item) => item.id === clienteId);
    const anterior = encontrarVisitaAnterior(form.data, form.horaEntrada);
    setForm((atual) => ({
      ...atual,
      clienteId,
      representadaIds: cliente?.representadas.map((item) => item.id) ?? [],
      origemClienteId: anterior?.destinoClienteId || anterior?.clienteId || "",
      destinoClienteId: clienteId,
      statusCliente: cliente?.status || "Ativo",
    }));
  }

  function alterarData(data: string) {
    const anterior = encontrarVisitaAnterior(data, form.horaEntrada);
    setForm((atual) => ({
      ...atual,
      data,
      origemClienteId: editandoId ? atual.origemClienteId : anterior?.destinoClienteId || anterior?.clienteId || "",
    }));
  }

  function alterarHoraEntrada(horaEntrada: string) {
    const anterior = encontrarVisitaAnterior(form.data, horaEntrada);
    setForm((atual) => ({
      ...atual,
      horaEntrada,
      origemClienteId: editandoId ? atual.origemClienteId : anterior?.destinoClienteId || anterior?.clienteId || "",
    }));
  }

  function alterarHouveVenda(houveVenda: boolean) {
    setForm((atual) => ({
      ...atual,
      houveVenda,
      valorVenda: houveVenda ? atual.valorVenda : "",
      origemVenda: houveVenda ? atual.origemVenda || atual.tipoContato : "",
      resultado: houveVenda
        ? atual.resultado === "Sem venda" ? "Pedido realizado" : atual.resultado
        : atual.resultado === "Pedido realizado" ? "Sem venda" : atual.resultado,
    }));
  }

  function editar(visita: VisitaDetalhada) {
    if (!podeEditar) return;
    setEditandoId(visita.id);
    setForm({
      clienteId: visita.clienteId,
      representadaIds: visita.representadas.map((item) => item.id),
      data: visita.data,
      horaEntrada: visita.horaEntrada,
      horaSaida: visita.horaSaida,
      odometroChegada: visita.odometroChegada,
      origemClienteId: visita.origemClienteId,
      destinoClienteId: visita.destinoClienteId || visita.clienteId,
      tipoContato: visita.tipoContato,
      houveVenda: visita.houveVenda,
      valorVenda: visita.houveVenda ? String(visita.valorVenda) : "",
      origemVenda: visita.origemVenda,
      resultado: visita.resultado,
      proximaAcao: visita.proximaAcao,
      proximaData: visita.proximaData,
      frequencia: visita.frequencia,
      statusCliente: visita.statusCliente || "Ativo",
      observacao: visita.observacao,
    });
    setErro("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function registrarVisita(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (salvando) return;

    const cliente = clientes.find((item) => item.id === form.clienteId);
    if (!cliente) {
      setErro("Selecione um cliente cadastrado antes de registrar a visita.");
      return;
    }

    if (form.representadaIds.length === 0) {
      setErro("Selecione pelo menos uma representada atendida nesta visita.");
      return;
    }

    if (!form.horaEntrada || !form.horaSaida) {
      setErro("Informe os horários de entrada e saída.");
      return;
    }

    if (duracaoCalculada === null) {
      setErro("O horário de saída não pode ser anterior ao horário de entrada.");
      return;
    }

    const odometroChegada = numeroCampo(form.odometroChegada);
    if (odometroChegada === null || odometroChegada < 0) {
      setErro("Informe o odômetro na chegada.");
      return;
    }

    const odometroAnterior = numeroCampo(visitaAnterior?.odometroChegada ?? "");
    if (odometroAnterior !== null && odometroChegada < odometroAnterior) {
      setErro("O odômetro na chegada não pode ser menor que o da visita anterior.");
      return;
    }

    const representadasSelecionadas = representadasOperacionais.filter((item) =>
      form.representadaIds.includes(item.id),
    );

    if (representadasSelecionadas.length !== form.representadaIds.length) {
      setErro("Uma ou mais representadas selecionadas não estão disponíveis nesta operação.");
      return;
    }

    const origemCliente = clientes.find((item) => item.id === form.origemClienteId) ?? null;
    const destinoCliente = clientes.find((item) => item.id === form.destinoClienteId) ?? cliente;
    const valorVenda = numeroCampo(form.valorVenda) ?? 0;

    const visitaParaSalvar: VisitaDetalhada = {
      id: editandoId ?? `visita-${crypto.randomUUID()}`,
      clienteId: cliente.id,
      clienteNome: cliente.nome,
      data: form.data,
      resultado: form.resultado,
      representadas: representadasSelecionadas,
      horaEntrada: form.horaEntrada,
      horaSaida: form.horaSaida,
      duracaoMinutos: duracaoCalculada,
      odometroChegada: form.odometroChegada.trim(),
      kmTrecho: kmCalculado,
      origemClienteId: origemCliente?.id ?? "",
      destinoClienteId: destinoCliente.id,
      origem: origemCliente?.nome ?? "",
      destino: destinoCliente.nome,
      tipoContato: form.tipoContato,
      houveVenda: form.houveVenda,
      valorVenda,
      origemVenda: form.houveVenda ? form.origemVenda : "",
      proximaAcao: form.proximaAcao,
      proximaData: form.proximaData,
      frequencia: form.frequencia,
      statusCliente: form.statusCliente,
      observacao: form.observacao.trim(),
    };

    setSalvando(true);
    setErro("");

    try {
      const visitaSalva = editandoId
        ? await atualizarVisitaDetalhada(visitaParaSalvar)
        : await criarVisitaDetalhada(visitaParaSalvar);

      setVisitas((lista) =>
        editandoId
          ? lista.map((visita) => (visita.id === visitaSalva.id ? visitaSalva : visita))
          : [visitaSalva, ...lista],
      );
      cancelarEdicao();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível registrar a visita.");
    } finally {
      setSalvando(false);
    }
  }

  const proximaDataEhAutomatica = form.proximaAcao === "Retorno" && Boolean(diasPorFrequencia[form.frequencia]);

  return (
    <AppShell>
      <header className="pageHeader">
        <div>
          <p className="eyebrow">ROTINA DE CAMPO</p>
          <h1>Visitas</h1>
          <p>Registre rota, horário, atendimento, venda e próxima ação em um único histórico.</p>
          <span className="tag">Banco online</span>
        </div>
      </header>

      {erro && <div className="loginAlert error settingsAlert">{erro}</div>}

      <div className="grid visitsGrid">
        {(podeCadastrar || editandoId) && (
          <form className="panel visit" onSubmit={registrarVisita}>
            <p className="eyebrow">{editandoId ? "ALTERAÇÃO" : "NOVO REGISTRO"}</p>
            <div className="panelTitle">
              <h2>{editandoId ? "Editar visita" : "Registrar visita"}</h2>
              {editandoId && (
                <button className="iconBtn" type="button" onClick={cancelarEdicao} title="Cancelar edição">
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="permissionsBlock">
              <div className="settingsSectionTitle">
                <ClipboardCheck size={18} />
                <div>
                  <strong>1. Selecionar cliente</strong>
                  <span>Escolha o cliente atendido nesta visita.</span>
                </div>
              </div>

              <label className="field">
                Cliente *
                <select
                  required
                  value={form.clienteId}
                  disabled={carregando || clientes.length === 0}
                  onChange={(event) => selecionarCliente(event.target.value)}
                >
                  <option value="" disabled>
                    {carregando ? "Carregando clientes..." : clientes.length === 0 ? "Cadastre um cliente primeiro" : "Selecionar cliente"}
                  </option>
                  {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
                </select>
                {clienteSelecionado?.telefone && <small>Contato: {clienteSelecionado.telefone}</small>}
              </label>
            </div>

            {clienteSelecionado && (
              <div className="permissionsBlock">
                <div className="settingsSectionTitle">
                  <Building2 size={18} />
                  <div>
                    <strong>Representadas desta visita</strong>
                    <span>As já cadastradas no cliente vêm marcadas. As demais da operação ficam disponíveis para uma oportunidade pontual.</span>
                  </div>
                </div>

                <div className="representadasChecklist">
                  {representadasOperacionais.map((representada) => {
                    const selecionada = form.representadaIds.includes(representada.id);
                    const cadastradaNoCliente = representadasDoClienteIds.has(representada.id);
                    return (
                      <label
                        className="representadaOption"
                        key={representada.id}
                        style={selecionada
                          ? { borderColor: "var(--blue)", background: "#edf4ff", boxShadow: "0 0 0 1px var(--blue)" }
                          : undefined}
                      >
                        <input
                          type="checkbox"
                          checked={selecionada}
                          onChange={(event) => alterarRepresentada(representada.id, event.target.checked)}
                        />
                        <span>
                          <strong>{representada.nome}</strong>
                          <small>
                            {cadastradaNoCliente
                              ? selecionada
                                ? "Cadastrada no cliente • incluída nesta visita"
                                : "Cadastrada no cliente • desmarcada nesta visita"
                              : selecionada
                                ? "Oportunidade pontual • incluída nesta visita"
                                : "Disponível nesta operação"}
                          </small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="permissionsBlock">
              <div className="settingsSectionTitle">
                <MapPin size={18} />
                <div>
                  <strong>2. Chegada e deslocamento</strong>
                  <span>Origem e destino usam clientes da própria base. O KM é calculado comparando o odômetro desta chegada com o da visita anterior do mesmo dia.</span>
                </div>
              </div>

              <div className="two">
                <label className="field">
                  Data *
                  <input type="date" required value={form.data} onChange={(event) => alterarData(event.target.value)} />
                </label>
                <label className="field">
                  Hora de entrada *
                  <input type="time" required value={form.horaEntrada} onChange={(event) => alterarHoraEntrada(event.target.value)} />
                </label>
              </div>

              <div className="two">
                <label className="field">
                  Origem
                  <select value={form.origemClienteId} onChange={(event) => setForm({ ...form, origemClienteId: event.target.value })}>
                    <option value="">Início da rota / não informado</option>
                    {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
                  </select>
                  {visitaAnterior && <small>Sugestão automática pela visita anterior.</small>}
                </label>
                <label className="field">
                  Destino *
                  <select required value={form.destinoClienteId} onChange={(event) => setForm({ ...form, destinoClienteId: event.target.value })}>
                    <option value="" disabled>Selecionar destino</option>
                    {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
                  </select>
                  <small>O cliente da visita já fica selecionado por padrão.</small>
                </label>
              </div>

              <div className="two">
                <label className="field">
                  Odômetro na chegada (km) *
                  <input type="number" min="0" step="0.1" required value={form.odometroChegada} onChange={(event) => setForm({ ...form, odometroChegada: event.target.value })} placeholder="Ex.: 510,8" />
                </label>
                <label className="field">
                  KM desde a visita anterior
                  <input readOnly value={formatarKm(kmCalculado)} />
                  {!visitaAnterior && <small>Primeira visita do dia: não há KM anterior para comparar.</small>}
                </label>
              </div>
            </div>

            <div className="permissionsBlock">
              <div className="settingsSectionTitle">
                <Car size={18} />
                <div>
                  <strong>3. Saída</strong>
                  <span>A saída registra apenas o tempo do atendimento; o odômetro continua sendo o da chegada.</span>
                </div>
              </div>

              <div className="two">
                <label className="field">
                  Hora de saída *
                  <input type="time" required value={form.horaSaida} onChange={(event) => setForm({ ...form, horaSaida: event.target.value })} />
                </label>
                <label className="field">
                  Duração
                  <input readOnly value={formatarDuracao(duracaoCalculada)} />
                </label>
              </div>
            </div>

            <div className="permissionsBlock">
              <div className="settingsSectionTitle">
                <DollarSign size={18} />
                <div>
                  <strong>4. Atendimento e venda</strong>
                  <span>O tipo do contato e a origem da venda ficam separados: uma visita presencial pode gerar um pedido posterior por WhatsApp.</span>
                </div>
              </div>

              <div className="two">
                <label className="field">
                  Tipo de contato *
                  <select value={form.tipoContato} onChange={(event) => setForm({ ...form, tipoContato: event.target.value as TipoContato })}>
                    <option>Presencial</option>
                    <option>WhatsApp</option>
                    <option>Telefone</option>
                    <option>Outro</option>
                  </select>
                </label>
                <label className="field">
                  Resultado
                  <select value={form.resultado} onChange={(event) => setForm({ ...form, resultado: event.target.value })}>
                    <option>Sem venda</option>
                    <option>Pedido realizado</option>
                    <option>Retorno agendado</option>
                    <option>Cliente ausente</option>
                    <option>Prospecção</option>
                  </select>
                </label>
              </div>

              <div className="two">
                <label className="field">
                  Houve venda? *
                  <select value={form.houveVenda ? "Sim" : "Não"} onChange={(event) => alterarHouveVenda(event.target.value === "Sim")}>
                    <option>Não</option>
                    <option>Sim</option>
                  </select>
                </label>
                <label className="field">
                  Valor da venda (R$)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={!form.houveVenda}
                    value={form.valorVenda}
                    onChange={(event) => setForm({ ...form, valorVenda: event.target.value })}
                    placeholder="0,00"
                  />
                </label>
              </div>

              <label className="field">
                Origem da venda
                <select
                  disabled={!form.houveVenda}
                  value={form.origemVenda}
                  onChange={(event) => setForm({ ...form, origemVenda: event.target.value })}
                >
                  <option value="">Selecione</option>
                  <option>Presencial</option>
                  <option>WhatsApp</option>
                  <option>Telefone</option>
                  <option>Outro</option>
                </select>
              </label>
            </div>

            <div className="permissionsBlock">
              <div className="settingsSectionTitle">
                <CalendarClock size={18} />
                <div>
                  <strong>5. Próximas ações</strong>
                  <span>Ao escolher Retorno e uma frequência, a próxima data é calculada automaticamente a partir da data da visita.</span>
                </div>
              </div>

              <div className="two">
                <label className="field">
                  Próxima ação *
                  <select value={form.proximaAcao} onChange={(event) => setForm({ ...form, proximaAcao: event.target.value })}>
                    <option>Retorno</option>
                    <option>Nova visita</option>
                    <option>Enviar cotação</option>
                    <option>Acompanhar pedido</option>
                    <option>Sem ação</option>
                  </select>
                </label>
                <label className="field">
                  Frequência
                  <select value={form.frequencia} onChange={(event) => setForm({ ...form, frequencia: event.target.value })}>
                    <option value="">Não definida</option>
                    <option>1 semana</option>
                    <option>2 semanas</option>
                    <option>3 semanas</option>
                    <option>4 semanas</option>
                    <option>30 dias</option>
                    <option>60 dias</option>
                    <option>90 dias</option>
                  </select>
                </label>
              </div>

              <div className="two">
                <label className="field">
                  Próxima data
                  <input
                    type="date"
                    value={form.proximaData}
                    readOnly={proximaDataEhAutomatica}
                    onChange={(event) => setForm({ ...form, proximaData: event.target.value })}
                  />
                  {proximaDataEhAutomatica && <small>Calculada automaticamente pela frequência selecionada.</small>}
                </label>
                <label className="field">
                  Status do cliente *
                  <select value={form.statusCliente} onChange={(event) => setForm({ ...form, statusCliente: event.target.value })}>
                    <option>Ativo</option>
                    <option>Visitar hoje</option>
                    <option>Retorno pendente</option>
                    <option>Inativo</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="permissionsBlock">
              <div className="settingsSectionTitle">
                <PhoneCall size={18} />
                <div>
                  <strong>6. Observações</strong>
                  <span>Pedido, necessidade, retorno ou qualquer informação importante do atendimento.</span>
                </div>
              </div>

              <label className="field">
                Observações
                <textarea
                  maxLength={500}
                  value={form.observacao}
                  onChange={(event) => setForm({ ...form, observacao: event.target.value })}
                  placeholder="Digite observações sobre a visita..."
                  rows={4}
                />
                <small>{form.observacao.length}/500</small>
              </label>
            </div>

            <button className="primary wide" type="submit" disabled={salvando || carregando || clientes.length === 0}>
              <ClipboardCheck size={18} /> {salvando ? "Salvando..." : editandoId ? "Salvar alterações" : "Registrar visita"}
            </button>
          </form>
        )}

        <section className="panel">
          <div className="panelTitle">
            <div>
              <p className="eyebrow">HISTÓRICO</p>
              <h2>{carregando ? "Carregando histórico..." : `${visitasOrdenadas.length} visitas registradas`}</h2>
            </div>
          </div>

          <div className="visitHistory">
            {!carregando && visitasOrdenadas.map((visita) => (
              <article className="visitItem" key={visita.id}>
                <div>
                  <strong>{visita.clienteNome}</strong>
                  <span>
                    {visita.data.split("-").reverse().join("/")}
                    {visita.horaEntrada ? ` • ${visita.horaEntrada}${visita.horaSaida ? ` - ${visita.horaSaida}` : ""}` : ""}
                    {visita.duracaoMinutos !== null ? ` • ${formatarDuracao(visita.duracaoMinutos)}` : ""}
                  </span>
                  <div className="representadasTags">
                    {visita.representadas.map((representada) => (
                      <span className="tag" key={representada.id}>{representada.nome}</span>
                    ))}
                  </div>
                </div>
                <div className="visitItemActions">
                  <span className="tag">{visita.resultado}</span>
                  {podeEditar && (
                    <button className="iconBtn editDataButton" type="button" onClick={() => editar(visita)} title="Editar visita">
                      <Pencil size={14} />
                    </button>
                  )}
                </div>

                <small>Contato: {visita.tipoContato}</small>
                <small>Rota: {visita.origem || "Início da rota"} → {visita.destino || visita.clienteNome}</small>
                {visita.odometroChegada && <small>Odômetro na chegada: {visita.odometroChegada} km</small>}
                {visita.kmTrecho !== null && <small>Deslocamento desde a visita anterior: {formatarKm(visita.kmTrecho)}</small>}
                <small>
                  {visita.houveVenda
                    ? `Venda: ${formatarMoeda(visita.valorVenda)}${visita.origemVenda ? ` • ${visita.origemVenda}` : ""}`
                    : "Venda: não houve"}
                </small>
                {(visita.proximaAcao || visita.proximaData || visita.frequencia) && (
                  <small>
                    Próxima ação: {visita.proximaAcao || "—"}
                    {visita.proximaData ? ` • ${visita.proximaData.split("-").reverse().join("/")}` : ""}
                    {visita.frequencia ? ` • ${visita.frequencia}` : ""}
                    {visita.statusCliente ? ` • ${visita.statusCliente}` : ""}
                  </small>
                )}
                {visita.observacao && <p>{visita.observacao}</p>}
              </article>
            ))}

            {!carregando && visitasOrdenadas.length === 0 && <div className="emptyState">Ainda não há visitas registradas.</div>}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
