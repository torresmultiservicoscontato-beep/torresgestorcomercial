"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Building2, CalendarClock, Car, ClipboardCheck, DollarSign, MapPin, Paperclip, Pencil, PhoneCall, Plus, X } from "lucide-react";
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
import { carregarProdutosModulo, salvarProduto, type ProdutoModulo } from "../lib/produtos";
import { anexarDocumentoVendaPorVisita, type ItemVendaInput } from "../lib/vendas";

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
    formasPagamento: [] as string[],
    condicoesPrazo: [] as string[],
    situacaoVenda: "Pedido lançado",
    itensVenda: [] as ItemVendaInput[],
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
  const limpo = valor.trim().replace(",", ".");
  if (!limpo) return null;
  const convertido = Number(limpo);
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
  const [arquivosVenda, setArquivosVenda] = useState<File[]>([]);
  const [produtosCatalogo, setProdutosCatalogo] = useState<ProdutoModulo[]>([]);
  const [buscaProduto, setBuscaProduto] = useState("");
  const [podeCadastrarProduto, setPodeCadastrarProduto] = useState(false);
  const [mostrarCadastroProduto, setMostrarCadastroProduto] = useState(false);
  const [salvandoProdutoRapido, setSalvandoProdutoRapido] = useState(false);
  const [novoProdutoRapido, setNovoProdutoRapido] = useState({
    representadaId: "",
    codigo: "",
    nome: "",
    unidade: "",
    comissaoPercentual: "",
  });

  useEffect(() => {
    let ativo = true;

    void Promise.all([
      carregarClientes(),
      carregarVisitasDetalhadas(),
      carregarRepresentadasOperacionais(),
      carregarAcessoAtual(),
      carregarProdutosModulo(),
    ])
      .then(([listaClientes, listaVisitas, listaRepresentadas, acesso, listaProdutos]) => {
        if (!ativo) return;
        setClientes(listaClientes);
        setVisitas(listaVisitas);
        setRepresentadasOperacionais(listaRepresentadas);
        setProdutosCatalogo(listaProdutos.filter((produto) => produto.ativo));
        setPodeCadastrar(pode(acesso, "visitas", "cadastrar"));
        setPodeEditar(pode(acesso, "visitas", "editar"));
        setPodeCadastrarProduto(Boolean(acesso && acesso.papel !== "preposto"));
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

  const catalogoProdutos = useMemo(() => {
    const termo = buscaProduto.trim().toLocaleLowerCase("pt-BR");

    return produtosCatalogo
      .filter((produto) =>
        produto.ativo
        && form.representadaIds.includes(produto.representadaId)
        && (
          !termo
          || produto.nome.toLocaleLowerCase("pt-BR").includes(termo)
          || produto.codigo.toLocaleLowerCase("pt-BR").includes(termo)
          || produto.representadaNome.toLocaleLowerCase("pt-BR").includes(termo)
        )
      )
      .sort((a, b) =>
        a.representadaNome.localeCompare(b.representadaNome, "pt-BR")
        || a.nome.localeCompare(b.nome, "pt-BR")
      );
  }, [produtosCatalogo, form.representadaIds, buscaProduto]);

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
    setArquivosVenda([]);
    setBuscaProduto("");
    setMostrarCadastroProduto(false);
    setErro("");
  }

  function alterarRepresentada(id: string, marcada: boolean) {
    setForm((atual) => ({
      ...atual,
      representadaIds: marcada
        ? Array.from(new Set([...atual.representadaIds, id]))
        : atual.representadaIds.filter((item) => item !== id),
      itensVenda: marcada
        ? atual.itensVenda
        : atual.itensVenda.filter((item) => item.representadaId !== id),
    }));

    if (!marcada && novoProdutoRapido.representadaId === id) {
      setNovoProdutoRapido((atual) => ({ ...atual, representadaId: "" }));
    }
  }

  function selecionarCliente(clienteId: string) {
    const cliente = clientes.find((item) => item.id === clienteId);
    const anterior = encontrarVisitaAnterior(form.data, form.horaEntrada);
    const novasRepresentadas = cliente?.representadas.map((item) => item.id) ?? [];

    setForm((atual) => ({
      ...atual,
      clienteId,
      representadaIds: novasRepresentadas,
      itensVenda: atual.itensVenda.filter((item) => item.representadaId && novasRepresentadas.includes(item.representadaId)),
      origemClienteId: anterior?.destinoClienteId || anterior?.clienteId || "",
      destinoClienteId: clienteId,
      statusCliente: cliente?.status || "Ativo",
    }));

    setNovoProdutoRapido((atual) => ({
      ...atual,
      representadaId: novasRepresentadas.length === 1 ? novasRepresentadas[0] : "",
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

  function alternarOpcaoVenda(campo: "formasPagamento" | "condicoesPrazo", valor: string, marcada: boolean) {
    setForm((atual) => ({
      ...atual,
      [campo]: marcada
        ? Array.from(new Set([...atual[campo], valor]))
        : atual[campo].filter((item) => item !== valor),
    }));
  }

  function itemCorrespondeProduto(item: ItemVendaInput, produto: ProdutoModulo) {
    if (item.produtoId) return item.produtoId === produto.id;
    if (item.representadaId !== produto.representadaId) return false;

    const mesmoCodigo = Boolean(
      produto.codigo
      && item.codigo
      && produto.codigo.trim().toLocaleLowerCase("pt-BR") === item.codigo.trim().toLocaleLowerCase("pt-BR"),
    );

    return mesmoCodigo
      || item.produto.trim().toLocaleLowerCase("pt-BR") === produto.nome.trim().toLocaleLowerCase("pt-BR");
  }

  function chaveItemVenda(item: ItemVendaInput) {
    return item.produtoId || `${item.representadaId || "sem-rep"}:${item.codigo || "sem-codigo"}:${item.produto}`;
  }

  function alternarProdutoVenda(produto: ProdutoModulo, marcado: boolean) {
    setForm((atual) => ({
      ...atual,
      itensVenda: marcado
        ? atual.itensVenda.some((item) => itemCorrespondeProduto(item, produto))
          ? atual.itensVenda
          : [
              ...atual.itensVenda,
              {
                produtoId: produto.id,
                produto: produto.nome,
                quantidade: "",
                unidade: produto.unidade,
                valorUnitario: "",
                valorTotal: "",
                codigo: produto.codigo,
                representadaId: produto.representadaId,
              },
            ]
        : atual.itensVenda.filter((item) => !itemCorrespondeProduto(item, produto)),
    }));
  }

  function atualizarProdutoVenda(chave: string, campo: keyof ItemVendaInput, valor: string) {
    setForm((atual) => ({
      ...atual,
      itensVenda: atual.itensVenda.map((item) =>
        chaveItemVenda(item) === chave ? { ...item, [campo]: valor } : item,
      ),
    }));
  }

  function abrirCadastroProdutoRapido() {
    setNovoProdutoRapido({
      representadaId: form.representadaIds.length === 1 ? form.representadaIds[0] : "",
      codigo: "",
      nome: "",
      unidade: "",
      comissaoPercentual: "",
    });
    setMostrarCadastroProduto(true);
    setErro("");
  }

  async function cadastrarProdutoRapido() {
    if (salvandoProdutoRapido) return;

    if (!novoProdutoRapido.representadaId) {
      setErro("Selecione a representada do novo produto.");
      return;
    }

    if (!novoProdutoRapido.nome.trim()) {
      setErro("Informe o nome do novo produto.");
      return;
    }

    setSalvandoProdutoRapido(true);
    setErro("");

    try {
      const produtoId = await salvarProduto({
        representadaId: novoProdutoRapido.representadaId,
        codigo: novoProdutoRapido.codigo,
        nome: novoProdutoRapido.nome,
        unidade: novoProdutoRapido.unidade,
        ativo: true,
        comissaoPercentual: novoProdutoRapido.comissaoPercentual === ""
          ? null
          : Number(novoProdutoRapido.comissaoPercentual.replace(",", ".")),
      });

      const listaAtualizada = (await carregarProdutosModulo()).filter((produto) => produto.ativo);
      setProdutosCatalogo(listaAtualizada);

      const produtoCriado = listaAtualizada.find((produto) => produto.id === produtoId);
      if (produtoCriado) alternarProdutoVenda(produtoCriado, true);

      setMostrarCadastroProduto(false);
      setNovoProdutoRapido({
        representadaId: "",
        codigo: "",
        nome: "",
        unidade: "",
        comissaoPercentual: "",
      });
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível cadastrar o produto.");
    } finally {
      setSalvandoProdutoRapido(false);
    }
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
      formasPagamento: visita.formasPagamento,
      condicoesPrazo: visita.condicoesPrazo,
      situacaoVenda: visita.situacaoVenda,
      itensVenda: visita.itensVenda,
      resultado: visita.resultado,
      proximaAcao: visita.proximaAcao,
      proximaData: visita.proximaData,
      frequencia: visita.frequencia,
      statusCliente: visita.statusCliente || "Ativo",
      observacao: visita.observacao,
    });
    setArquivosVenda([]);
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

    if (form.houveVenda && form.representadaIds.length > 1 && form.itensVenda.some((item) => !item.representadaId)) {
      setErro("Quando a venda envolve mais de uma representada, informe a representada de cada produto.");
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
      formasPagamento: form.houveVenda ? form.formasPagamento : [],
      condicoesPrazo: form.houveVenda ? form.condicoesPrazo : [],
      situacaoVenda: form.houveVenda ? form.situacaoVenda : "Pedido lançado",
      itensVenda: form.houveVenda ? form.itensVenda : [],
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

      if (visitaSalva.houveVenda && arquivosVenda.length > 0) {
        for (const arquivo of arquivosVenda) {
          await anexarDocumentoVendaPorVisita(visitaSalva.id, arquivo);
        }
      }

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

              {form.houveVenda && (
                <>
                  <div className="permissionsBlock">
                    <div className="settingsSectionTitle">
                      <DollarSign size={17} />
                      <div>
                        <strong>Forma de pagamento</strong>
                        <span>Marque uma ou mais formas usadas no pedido.</span>
                      </div>
                    </div>
                    <div className="representadasChecklist">
                      {["Boleto", "Pix", "Cartão de crédito", "Dinheiro", "Transferência"].map((forma) => {
                        const marcada = form.formasPagamento.includes(forma);
                        return (
                          <label className="representadaOption" key={forma} style={marcada ? { borderColor: "var(--blue)", background: "#edf4ff" } : undefined}>
                            <input type="checkbox" checked={marcada} onChange={(event) => alternarOpcaoVenda("formasPagamento", forma, event.target.checked)} />
                            <span><strong>{forma}</strong></span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="permissionsBlock">
                    <div className="settingsSectionTitle">
                      <CalendarClock size={17} />
                      <div>
                        <strong>Condição e prazo</strong>
                        <span>Esses dados ficarão disponíveis para o futuro controle de liquidação e comissão.</span>
                      </div>
                    </div>
                    <div className="representadasChecklist">
                      {["À vista", "7 dias", "14 dias", "21 dias", "28 dias", "30 dias", "30/60", "30/60/90"].map((prazo) => {
                        const marcada = form.condicoesPrazo.includes(prazo);
                        return (
                          <label className="representadaOption" key={prazo} style={marcada ? { borderColor: "var(--blue)", background: "#edf4ff" } : undefined}>
                            <input type="checkbox" checked={marcada} onChange={(event) => alternarOpcaoVenda("condicoesPrazo", prazo, event.target.checked)} />
                            <span><strong>{prazo}</strong></span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="permissionsBlock">
                    <div className="settingsSectionTitle">
                      <ClipboardCheck size={17} />
                      <div>
                        <strong>Situação do pedido</strong>
                        <span>O pedido nasce como Pedido lançado. Faturamento, liquidação e comissão passam a ser controlados no módulo Comissões.</span>
                      </div>
                    </div>
                    <div className="representadasChecklist">
                      <div className="representadaOption" style={{ borderColor: "var(--blue)", background: "#edf4ff" }}>
                        <span>
                          <strong>Pedido lançado</strong>
                          <small>Após salvar a visita, o representante acompanha o fluxo financeiro em Comissões.</small>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="permissionsBlock">
                    <div className="settingsSectionTitle">
                      <Paperclip size={17} />
                      <div>
                        <strong>Documento do pedido</strong>
                        <span>Anexe PDF, Excel, CSV, foto ou print. O arquivo ficará vinculado à venda automaticamente.</span>
                      </div>
                    </div>
                    <label className="field">
                      Anexo(s)
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.xls,.xlsx,.csv,image/jpeg,image/png,image/webp"
                        onChange={(event) => setArquivosVenda(Array.from(event.target.files ?? []))}
                      />
                      <small>
                        {arquivosVenda.length > 0
                          ? `${arquivosVenda.length} arquivo(s) selecionado(s)`
                          : "Nenhum arquivo selecionado."}
                      </small>
                    </label>
                  </div>

                  <div className="permissionsBlock">
                    <div className="settingsSectionTitle">
                      <Building2 size={17} />
                      <div>
                        <strong>Produtos e mercadorias</strong>
                        <span>Selecione produtos ativos do catálogo oficial. Assim venda, faturamento e comissão usam o mesmo cadastro.</span>
                      </div>
                    </div>

                    <div className="two">
                      <label className="field">
                        Buscar produto
                        <input
                          value={buscaProduto}
                          onChange={(event) => setBuscaProduto(event.target.value)}
                          placeholder="Nome, código ou representada"
                        />
                      </label>

                      {podeCadastrarProduto && (
                        <button
                          className="secondary"
                          type="button"
                          style={{ alignSelf: "end", marginBottom: 0 }}
                          onClick={mostrarCadastroProduto ? () => setMostrarCadastroProduto(false) : abrirCadastroProdutoRapido}
                        >
                          {mostrarCadastroProduto ? <X size={15} /> : <Plus size={15} />}
                          {mostrarCadastroProduto ? "Fechar cadastro" : "Cadastrar novo produto"}
                        </button>
                      )}
                    </div>

                    {podeCadastrarProduto && mostrarCadastroProduto && (
                      <div style={{ marginTop: 12, padding: 12, border: "1px solid var(--line)", borderRadius: 10, background: "#fbfcfe" }}>
                        <div className="settingsSectionTitle">
                          <Plus size={16} />
                          <div>
                            <strong>Cadastro rápido de produto</strong>
                            <span>O produto será salvo no mesmo catálogo do menu Produtos e já ficará selecionado nesta venda.</span>
                          </div>
                        </div>

                        <div className="formGrid">
                          <label className="field span2">
                            Representada *
                            <select
                              required
                              value={novoProdutoRapido.representadaId}
                              onChange={(event) => setNovoProdutoRapido({ ...novoProdutoRapido, representadaId: event.target.value })}
                            >
                              <option value="">Selecionar representada</option>
                              {representadasOperacionais
                                .filter((representada) => form.representadaIds.includes(representada.id))
                                .map((representada) => (
                                  <option key={representada.id} value={representada.id}>{representada.nome}</option>
                                ))}
                            </select>
                          </label>

                          <label className="field">
                            Código / SKU
                            <input
                              value={novoProdutoRapido.codigo}
                              onChange={(event) => setNovoProdutoRapido({ ...novoProdutoRapido, codigo: event.target.value })}
                            />
                          </label>

                          <label className="field span2">
                            Produto *
                            <input
                              value={novoProdutoRapido.nome}
                              onChange={(event) => setNovoProdutoRapido({ ...novoProdutoRapido, nome: event.target.value })}
                              placeholder="Ex.: Argamassa ACIII 20 kg"
                            />
                          </label>

                          <label className="field">
                            Unidade
                            <input
                              value={novoProdutoRapido.unidade}
                              onChange={(event) => setNovoProdutoRapido({ ...novoProdutoRapido, unidade: event.target.value })}
                              placeholder="UN, CX, KG..."
                            />
                          </label>

                          <label className="field">
                            Comissão específica do representante (%)
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={novoProdutoRapido.comissaoPercentual}
                              onChange={(event) => setNovoProdutoRapido({ ...novoProdutoRapido, comissaoPercentual: event.target.value })}
                              placeholder="Vazio = padrão da representada"
                            />
                          </label>
                        </div>

                        <button className="primary" type="button" disabled={salvandoProdutoRapido} onClick={() => void cadastrarProdutoRapido()}>
                          <Plus size={15} />
                          {salvandoProdutoRapido ? "Cadastrando..." : "Cadastrar e selecionar"}
                        </button>
                      </div>
                    )}

                    {form.representadaIds.length === 0 ? (
                      <div className="emptyState" style={{ marginTop: 12 }}>
                        Selecione uma representada na visita para carregar os produtos disponíveis.
                      </div>
                    ) : catalogoProdutos.length > 0 ? (
                      <div className="representadasChecklist" style={{ marginTop: 12 }}>
                        {catalogoProdutos.map((produto) => {
                          const item = form.itensVenda.find((atual) => itemCorrespondeProduto(atual, produto));
                          const marcada = Boolean(item);

                          return (
                            <label
                              className="representadaOption"
                              key={produto.id}
                              style={marcada ? { borderColor: "var(--blue)", background: "#edf4ff" } : undefined}
                            >
                              <input
                                type="checkbox"
                                checked={marcada}
                                onChange={(event) => alternarProdutoVenda(produto, event.target.checked)}
                              />
                              <span>
                                <strong>{produto.nome}</strong>
                                <small>
                                  {produto.representadaNome}
                                  {produto.codigo ? ` • Cód. ${produto.codigo}` : ""}
                                  {produto.unidade ? ` • ${produto.unidade}` : ""}
                                </small>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="emptyState" style={{ marginTop: 12 }}>
                        Nenhum produto ativo encontrado para as representadas selecionadas.
                        {podeCadastrarProduto ? " Você pode cadastrar um produto novo acima." : " Solicite o cadastro ao representante."}
                      </div>
                    )}

                    {form.itensVenda.map((item) => {
                      const chave = chaveItemVenda(item);
                      const representadaItem = representadasOperacionais.find((representada) => representada.id === item.representadaId);

                      return (
                        <div
                          className="formGrid"
                          key={chave}
                          style={{ marginTop: 10, padding: 10, border: "1px solid var(--line)", borderRadius: 10, background: "#fff" }}
                        >
                          <label className="field span2">
                            Produto
                            <input readOnly value={item.produto} />
                            <small>
                              {representadaItem?.nome || "Representada não identificada"}
                              {item.codigo ? ` • Cód. ${item.codigo}` : ""}
                            </small>
                          </label>

                          {form.representadaIds.length > 1 && !item.produtoId && (
                            <label className="field span2">
                              Representada deste produto *
                              <select
                                required
                                value={item.representadaId ?? ""}
                                onChange={(event) => atualizarProdutoVenda(chave, "representadaId", event.target.value)}
                              >
                                <option value="">Selecionar representada</option>
                                {representadasOperacionais
                                  .filter((representada) => form.representadaIds.includes(representada.id))
                                  .map((representada) => (
                                    <option key={representada.id} value={representada.id}>{representada.nome}</option>
                                  ))}
                              </select>
                              <small>Produto antigo sem vínculo de catálogo. Selecione a representada para manter o pedido consistente.</small>
                            </label>
                          )}

                          <label className="field">
                            Quantidade
                            <input
                              value={item.quantidade ?? ""}
                              onChange={(event) => atualizarProdutoVenda(chave, "quantidade", event.target.value)}
                              inputMode="decimal"
                            />
                          </label>

                          <label className="field">
                            Unidade
                            <input
                              readOnly={Boolean(item.produtoId)}
                              value={item.unidade ?? ""}
                              onChange={(event) => atualizarProdutoVenda(chave, "unidade", event.target.value)}
                              placeholder="UN, CX, KG..."
                            />
                          </label>

                          <label className="field">
                            Valor unitário
                            <input
                              value={item.valorUnitario ?? ""}
                              onChange={(event) => atualizarProdutoVenda(chave, "valorUnitario", event.target.value)}
                              inputMode="decimal"
                            />
                          </label>

                          <label className="field">
                            Valor total
                            <input
                              value={item.valorTotal ?? ""}
                              onChange={(event) => atualizarProdutoVenda(chave, "valorTotal", event.target.value)}
                              inputMode="decimal"
                            />
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="permissionsBlock">
              <div className="settingsSectionTitle">
                <CalendarClock size={18} />
                <div>
                  <strong>5. Próximas ações</strong>
                  <span>Ao definir uma próxima ação e data, o compromisso entra automaticamente na Agenda. Para Retorno com frequência, a data é calculada a partir da visita.</span>
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
