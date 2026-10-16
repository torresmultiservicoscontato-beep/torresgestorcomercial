"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Pencil, X } from "lucide-react";
import AppShell from "../components/AppShell";
import { Cliente, Visita, atualizarVisita, carregarClientes, carregarVisitas, criarVisita } from "../lib/data";

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
    data: hojeLocal(),
    resultado: "Sem venda",
    odometro: "",
    observacao: "",
  };
}

export default function VisitasPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState(formInicial());

  useEffect(() => {
    let ativo = true;

    void Promise.all([carregarClientes(), carregarVisitas()])
      .then(([listaClientes, listaVisitas]) => {
        if (!ativo) return;
        setClientes(listaClientes);
        setVisitas(listaVisitas);
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

  const visitasOrdenadas = useMemo(
    () => [...visitas].sort((a, b) => b.data.localeCompare(a.data)),
    [visitas],
  );

  function cancelarEdicao() {
    setEditandoId(null);
    setForm(formInicial());
  }

  function editar(visita: Visita) {
    setEditandoId(visita.id);
    setForm({
      clienteId: visita.clienteId,
      data: visita.data,
      resultado: visita.resultado,
      odometro: visita.odometro,
      observacao: visita.observacao,
    });
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

    const visitaParaSalvar: Visita = {
      id: editandoId ?? `visita-${crypto.randomUUID()}`,
      clienteId: cliente.id,
      clienteNome: cliente.nome,
      data: form.data,
      resultado: form.resultado,
      odometro: form.odometro.trim(),
      observacao: form.observacao.trim(),
    };

    setSalvando(true);
    setErro("");

    try {
      const visitaSalva = editandoId
        ? await atualizarVisita(visitaParaSalvar)
        : await criarVisita(visitaParaSalvar);

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

  return (
    <AppShell>
      <header className="pageHeader">
        <div>
          <p className="eyebrow">ROTINA DE CAMPO</p>
          <h1>Visitas</h1>
          <p>Registre e altere os atendimentos do usuário operacional selecionado.</p>
          <span className="tag">Banco online</span>
        </div>
      </header>

      {erro && <div className="emptyState">{erro}</div>}

      <div className="grid visitsGrid">
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

          <label className="field">
            Cliente
            <select
              required
              value={form.clienteId}
              disabled={carregando || clientes.length === 0}
              onChange={(event) => setForm({ ...form, clienteId: event.target.value })}
            >
              <option value="" disabled>
                {carregando
                  ? "Carregando clientes..."
                  : clientes.length === 0
                    ? "Cadastre um cliente primeiro"
                    : "Selecionar cliente"}
              </option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>
              ))}
            </select>
          </label>

          <div className="two">
            <label className="field">
              Data
              <input
                type="date"
                value={form.data}
                onChange={(event) => setForm({ ...form, data: event.target.value })}
              />
            </label>
            <label className="field">
              Odômetro
              <input
                value={form.odometro}
                onChange={(event) => setForm({ ...form, odometro: event.target.value })}
                placeholder="Ex.: 42.180 km"
              />
            </label>
          </div>

          <label className="field">
            Resultado
            <select
              value={form.resultado}
              onChange={(event) => setForm({ ...form, resultado: event.target.value })}
            >
              <option>Sem venda</option>
              <option>Pedido realizado</option>
              <option>Retorno agendado</option>
              <option>Cliente ausente</option>
              <option>Prospecção</option>
            </select>
          </label>

          <label className="field">
            Observação
            <textarea
              value={form.observacao}
              onChange={(event) => setForm({ ...form, observacao: event.target.value })}
              placeholder="Anote pedido, necessidade, retorno ou qualquer detalhe importante..."
              rows={4}
            />
          </label>

          <button className="primary wide" type="submit" disabled={salvando || carregando || clientes.length === 0}>
            <ClipboardCheck size={18} /> {salvando ? "Salvando..." : editandoId ? "Salvar alterações" : "Registrar visita"}
          </button>
        </form>

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
                  <span>{visita.data.split("-").reverse().join("/")}</span>
                </div>
                <div className="visitItemActions">
                  <span className="tag">{visita.resultado}</span>
                  <button className="iconBtn editDataButton" type="button" onClick={() => editar(visita)} title="Editar visita">
                    <Pencil size={14} />
                  </button>
                </div>
                {visita.odometro && <small>Odômetro: {visita.odometro}</small>}
                {visita.observacao && <p>{visita.observacao}</p>}
              </article>
            ))}

            {!carregando && visitasOrdenadas.length === 0 && (
              <div className="emptyState">Ainda não há visitas registradas.</div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
