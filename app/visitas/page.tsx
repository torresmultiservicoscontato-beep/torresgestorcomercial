"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import AppShell from "../components/AppShell";
import {
  Cliente,
  Visita,
  carregarClientes,
  carregarVisitas,
  clientesIniciais,
  salvarVisitas,
} from "../lib/data";

function hojeLocal() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export default function VisitasPage() {
  const [clientes, setClientes] = useState<Cliente[]>(clientesIniciais);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [form, setForm] = useState({
    clienteId: "",
    data: hojeLocal(),
    resultado: "Sem venda",
    odometro: "",
    observacao: "",
  });

  useEffect(() => {
    setClientes(carregarClientes());
    setVisitas(carregarVisitas());
  }, []);

  const visitasOrdenadas = useMemo(
    () => [...visitas].sort((a, b) => b.data.localeCompare(a.data)),
    [visitas],
  );

  function registrarVisita(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cliente = clientes.find((item) => item.id === form.clienteId);
    if (!cliente) return;

    const novaVisita: Visita = {
      id: `visita-${Date.now()}`,
      clienteId: cliente.id,
      clienteNome: cliente.nome,
      data: form.data,
      resultado: form.resultado,
      odometro: form.odometro.trim(),
      observacao: form.observacao.trim(),
    };

    const novaLista = [novaVisita, ...visitas];
    setVisitas(novaLista);
    salvarVisitas(novaLista);
    setForm({
      clienteId: "",
      data: hojeLocal(),
      resultado: "Sem venda",
      odometro: "",
      observacao: "",
    });
  }

  return (
    <AppShell>
      <header className="pageHeader">
        <div>
          <p className="eyebrow">ROTINA DE CAMPO</p>
          <h1>Visitas</h1>
          <p>Registre cada atendimento e mantenha o histórico comercial organizado.</p>
        </div>
      </header>

      <div className="grid visitsGrid">
        <form className="panel visit" onSubmit={registrarVisita}>
          <p className="eyebrow">NOVO REGISTRO</p>
          <h2>Registrar visita</h2>

          <label className="field">
            Cliente
            <select
              required
              value={form.clienteId}
              onChange={(event) => setForm({ ...form, clienteId: event.target.value })}
            >
              <option value="" disabled>Selecionar cliente</option>
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

          <button className="primary wide" type="submit">
            <ClipboardCheck size={18} /> Registrar visita
          </button>
        </form>

        <section className="panel">
          <div className="panelTitle">
            <div>
              <p className="eyebrow">HISTÓRICO</p>
              <h2>{visitasOrdenadas.length} visitas registradas</h2>
            </div>
          </div>

          <div className="visitHistory">
            {visitasOrdenadas.map((visita) => (
              <article className="visitItem" key={visita.id}>
                <div>
                  <strong>{visita.clienteNome}</strong>
                  <span>{visita.data.split("-").reverse().join("/")}</span>
                </div>
                <span className="tag">{visita.resultado}</span>
                {visita.odometro && <small>Odômetro: {visita.odometro}</small>}
                {visita.observacao && <p>{visita.observacao}</p>}
              </article>
            ))}

            {visitasOrdenadas.length === 0 && (
              <div className="emptyState">Ainda não há visitas registradas.</div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
