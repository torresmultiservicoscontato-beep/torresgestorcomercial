"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Building2, Map as MapIcon, MapPinned, Pencil, Save, UsersRound, X } from "lucide-react";
import AppShell from "../components/AppShell";
import RouteMap from "../components/RouteMap";
import { carregarAcessoAtual, pode } from "../lib/acesso";
import { listarPrepostos, type Preposto } from "../lib/prepostos";
import {
  atualizarCoordenadasClienteRota,
  listarClientesMapaRota,
  listarRepresentadasParaRotas,
  listarRotasSemanais,
  salvarRotaSemanal,
  type ClienteMapaRota,
  type RepresentadaRota,
  type RotaSemanal,
} from "../lib/rotas";

const dias = [
  { id: 1, nome: "Segunda-feira" },
  { id: 2, nome: "Terça-feira" },
  { id: 3, nome: "Quarta-feira" },
  { id: 4, nome: "Quinta-feira" },
  { id: 5, nome: "Sexta-feira" },
  { id: 6, nome: "Sábado" },
  { id: 7, nome: "Domingo" },
];

function formularioVazio(diaSemana: number) {
  return {
    diaSemana,
    municipio: "",
    bairrosTexto: "",
    observacao: "",
    representadaIds: [] as string[],
  };
}

export default function RotasPage() {
  const [rotas, setRotas] = useState<RotaSemanal[]>([]);
  const [representadas, setRepresentadas] = useState<RepresentadaRota[]>([]);
  const [prepostos, setPrepostos] = useState<Preposto[]>([]);
  const [responsavelVisualizado, setResponsavelVisualizado] = useState("");
  const [nomeResponsavelVisualizado, setNomeResponsavelVisualizado] = useState("Titular");
  const [editandoDia, setEditandoDia] = useState<number | null>(null);
  const [form, setForm] = useState(formularioVazio(1));
  const [carregando, setCarregando] = useState(true);
  const [carregandoResponsavel, setCarregandoResponsavel] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [podeCadastrar, setPodeCadastrar] = useState(false);
  const [podeEditar, setPodeEditar] = useState(false);
  const [podeVerEquipe, setPodeVerEquipe] = useState(false);
  const [mapaRota, setMapaRota] = useState<RotaSemanal | null>(null);
  const [mapaResponsavelNome, setMapaResponsavelNome] = useState("Titular");
  const [clientesMapa, setClientesMapa] = useState<ClienteMapaRota[]>([]);
  const [carregandoMapa, setCarregandoMapa] = useState(false);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        const [listaRotas, listaRepresentadas, acesso] = await Promise.all([
          listarRotasSemanais(),
          listarRepresentadasParaRotas(),
          carregarAcessoAtual(),
        ]);

        if (!ativo) return;
        setRotas(listaRotas);
        setRepresentadas(listaRepresentadas);
        setPodeCadastrar(pode(acesso, "rotas", "cadastrar"));
        setPodeEditar(pode(acesso, "rotas", "editar"));

        if (acesso && acesso.papel !== "preposto") {
          try {
            const equipe = await listarPrepostos();
            if (!ativo) return;
            setPrepostos(
              equipe.filter((preposto) => preposto.status === "ativo" && Boolean(preposto.userId)),
            );
            setPodeVerEquipe(true);
          } catch {
            if (ativo) {
              setPrepostos([]);
              setPodeVerEquipe(false);
            }
          }
        }
      } catch (falha) {
        if (!ativo) return;
        setErro(falha instanceof Error ? falha.message : "Não foi possível carregar as rotas.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void carregar();

    return () => {
      ativo = false;
    };
  }, []);

  const rotasPorDia = useMemo(
    () => new Map(rotas.map((rota) => [rota.diaSemana, rota])),
    [rotas],
  );

  const visualizandoPreposto = Boolean(responsavelVisualizado);

  async function trocarResponsavel(userId: string) {
    if (carregandoResponsavel) return;

    const preposto = prepostos.find((item) => item.userId === userId);
    setResponsavelVisualizado(userId);
    setNomeResponsavelVisualizado(preposto?.nome ?? "Titular");
    setEditandoDia(null);
    setMapaRota(null);
    setClientesMapa([]);
    setErro("");
    setMensagem("");
    setCarregandoResponsavel(true);

    try {
      const novasRotas = await listarRotasSemanais(userId || undefined);
      setRotas(novasRotas);
      setNomeResponsavelVisualizado(userId ? preposto?.nome ?? "Preposto" : "Titular");
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível carregar as rotas deste responsável.");
    } finally {
      setCarregandoResponsavel(false);
    }
  }

  function abrirCadastro(diaSemana: number) {
    if (visualizandoPreposto) return;

    const rota = rotasPorDia.get(diaSemana);
    setEditandoDia(diaSemana);
    setErro("");
    setMensagem("");

    if (rota) {
      setForm({
        diaSemana,
        municipio: rota.municipio,
        bairrosTexto: rota.bairros.join(", "),
        observacao: rota.observacao,
        representadaIds: rota.representadas.map((item) => item.id),
      });
    } else {
      setForm(formularioVazio(diaSemana));
    }
  }

  function fecharCadastro() {
    setEditandoDia(null);
    setForm(formularioVazio(1));
  }

  function alternarRepresentada(id: string, marcada: boolean) {
    setForm((atual) => ({
      ...atual,
      representadaIds: marcada
        ? Array.from(new Set([...atual.representadaIds, id]))
        : atual.representadaIds.filter((item) => item !== id),
    }));
  }

  async function abrirMapa(rota: RotaSemanal) {
    setMapaRota(rota);
    setMapaResponsavelNome(nomeResponsavelVisualizado);
    setClientesMapa([]);
    setCarregandoMapa(true);
    setErro("");

    try {
      const clientes = await listarClientesMapaRota(rota.id);
      setClientesMapa(clientes);
    } catch (falha) {
      setMapaRota(null);
      setErro(falha instanceof Error ? falha.message : "Não foi possível abrir o mapa desta rota.");
    } finally {
      setCarregandoMapa(false);
    }
  }

  async function salvarCoordenadas(clienteId: string, latitude: number, longitude: number) {
    await atualizarCoordenadasClienteRota(clienteId, latitude, longitude);
    setClientesMapa((lista) => lista.map((cliente) =>
      cliente.id === clienteId ? { ...cliente, latitude, longitude } : cliente,
    ));
  }

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (salvando || editandoDia === null || visualizandoPreposto) return;

    const bairros = form.bairrosTexto
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (!form.municipio.trim() && bairros.length === 0) {
      setErro("Informe pelo menos um município ou bairro/região para esta rota.");
      return;
    }

    if (form.representadaIds.length === 0) {
      setErro("Selecione pelo menos uma representada para esta rota.");
      return;
    }

    setSalvando(true);
    setErro("");
    setMensagem("");

    try {
      const atualizadas = await salvarRotaSemanal({
        diaSemana: editandoDia,
        municipio: form.municipio,
        bairros,
        observacao: form.observacao,
        representadaIds: form.representadaIds,
        editando: Boolean(rotasPorDia.get(editandoDia)),
      });
      setRotas(atualizadas);
      const nomeDia = dias.find((dia) => dia.id === editandoDia)?.nome ?? "Dia";
      setMensagem(`Rota de ${nomeDia} salva.`);
      fecharCadastro();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível salvar a rota.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <AppShell>
      <header className="pageHeader">
        <div>
          <p className="eyebrow">PLANEJAMENTO COMERCIAL</p>
          <h1>Rotas semanais</h1>
          <p>Cadastre a rota padrão de cada dia e acompanhe também as rotas e os clientes dos seus prepostos.</p>
        </div>
      </header>

      {podeVerEquipe && prepostos.length > 0 && (
        <section className="panel routeTeamViewer">
          <div className="routeTeamViewerTitle">
            <UsersRound size={19} />
            <div>
              <strong>Visualização da equipe</strong>
              <span>O titular pode consultar as rotas e os mapas dos prepostos vinculados à sua operação.</span>
            </div>
          </div>

          <label className="field routeTeamSelect">
            Visualizar rotas de
            <select
              value={responsavelVisualizado}
              disabled={carregandoResponsavel}
              onChange={(event) => void trocarResponsavel(event.target.value)}
            >
              <option value="">Titular / minhas rotas</option>
              {prepostos.map((preposto) => (
                <option key={preposto.id} value={preposto.userId ?? ""}>{preposto.nome}</option>
              ))}
            </select>
          </label>

          <span className={visualizandoPreposto ? "adminBadge routeViewingBadge" : "tag routeViewingBadge"}>
            {carregandoResponsavel ? "Carregando..." : visualizandoPreposto ? `Preposto: ${nomeResponsavelVisualizado}` : "Titular"}
          </span>
        </section>
      )}

      {visualizandoPreposto && (
        <div className="loginAlert success settingsAlert">
          Visualização de supervisão: você está vendo as rotas e os clientes de {nomeResponsavelVisualizado}. As rotas do preposto ficam somente para consulta neste painel.
        </div>
      )}

      {erro && <div className="loginAlert error settingsAlert">{erro}</div>}
      {mensagem && <div className="loginAlert success settingsAlert">{mensagem}</div>}

      <section className="routesGrid">
        {dias.map((dia) => {
          const rota = rotasPorDia.get(dia.id);
          const estaEditando = editandoDia === dia.id;
          const podeAbrir = !visualizandoPreposto && (rota ? podeEditar : podeCadastrar);

          return (
            <article className="panel routeCard" key={dia.id}>
              <div className="panelTitle routeCardHeader">
                <div>
                  <p className="eyebrow">{visualizandoPreposto ? `ROTA DE ${nomeResponsavelVisualizado.toUpperCase()}` : "ROTA PADRÃO"}</p>
                  <h2>{dia.nome}</h2>
                </div>
                <div className="routeCardActions">
                  {rota && !estaEditando && (
                    <button className="iconBtn routeMapButton" type="button" onClick={() => void abrirMapa(rota)} title="Abrir mapa da rota">
                      <MapIcon size={16} />
                    </button>
                  )}
                  {podeAbrir && !estaEditando && (
                    <button className="iconBtn" type="button" onClick={() => abrirCadastro(dia.id)} title={rota ? "Editar rota" : "Cadastrar rota"}>
                      {rota ? <Pencil size={15} /> : <MapPinned size={16} />}
                    </button>
                  )}
                </div>
              </div>

              {estaEditando ? (
                <form onSubmit={salvar}>
                  <label className="field">
                    Município
                    <input
                      value={form.municipio}
                      onChange={(event) => setForm({ ...form, municipio: event.target.value })}
                      placeholder="Ex.: Magé"
                    />
                  </label>

                  <label className="field">
                    Bairros / regiões
                    <input
                      value={form.bairrosTexto}
                      onChange={(event) => setForm({ ...form, bairrosTexto: event.target.value })}
                      placeholder="Ex.: Centro, Piabetá, Fragoso"
                    />
                    <small>Separe mais de um bairro por vírgula.</small>
                  </label>

                  <div className="permissionsBlock routeRepresentadasBlock">
                    <div className="settingsSectionTitle">
                      <Building2 size={17} />
                      <div>
                        <strong>Representadas desta rota</strong>
                        <span>Marque uma ou mais representadas para este dia.</span>
                      </div>
                    </div>

                    <div className="representadasChecklist">
                      {representadas.map((representada) => {
                        const marcada = form.representadaIds.includes(representada.id);
                        return (
                          <label
                            className="representadaOption"
                            key={representada.id}
                            style={marcada ? { borderColor: "var(--blue)", background: "#edf4ff", boxShadow: "0 0 0 1px var(--blue)" } : undefined}
                          >
                            <input
                              type="checkbox"
                              checked={marcada}
                              onChange={(event) => alternarRepresentada(representada.id, event.target.checked)}
                            />
                            <span><strong>{representada.nome}</strong></span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <label className="field">
                    Observação
                    <textarea
                      value={form.observacao}
                      onChange={(event) => setForm({ ...form, observacao: event.target.value })}
                      placeholder="Ex.: Priorizar materiais de construção na parte da manhã."
                      rows={3}
                    />
                  </label>

                  <div className="formActions">
                    <button className="secondary" type="button" onClick={fecharCadastro} disabled={salvando}>
                      <X size={15} /> Cancelar
                    </button>
                    <button className="primary" type="submit" disabled={salvando || representadas.length === 0}>
                      <Save size={15} /> {salvando ? "Salvando..." : "Salvar rota"}
                    </button>
                  </div>
                </form>
              ) : rota ? (
                <div className="routeSummary">
                  <div className="routeLocation">
                    <MapPinned size={18} />
                    <div>
                      <strong>{rota.municipio || "Município não informado"}</strong>
                      <span>{rota.bairros.length > 0 ? rota.bairros.join(" • ") : "Sem bairros definidos"}</span>
                    </div>
                  </div>

                  <div className="representadasTags">
                    {rota.representadas.map((representada) => (
                      <span className="tag" key={representada.id}>{representada.nome}</span>
                    ))}
                  </div>

                  <button className="secondary wide routeOpenMap" type="button" onClick={() => void abrirMapa(rota)}>
                    <MapIcon size={16} /> {visualizandoPreposto ? `Ver clientes de ${nomeResponsavelVisualizado} no mapa` : "Ver mapa da rota"}
                  </button>

                  {rota.observacao && <p>{rota.observacao}</p>}
                </div>
              ) : (
                <div className="routeEmpty">
                  <MapPinned size={24} />
                  <strong>{visualizandoPreposto ? "Rota não cadastrada pelo preposto" : "Rota não cadastrada"}</strong>
                  <span>
                    {visualizandoPreposto
                      ? `${nomeResponsavelVisualizado} não possui rota cadastrada para este dia.`
                      : "Defina município ou bairros e as representadas deste dia."}
                  </span>
                  {podeCadastrar && !visualizandoPreposto && (
                    <button className="secondary" type="button" onClick={() => abrirCadastro(dia.id)}>
                      Cadastrar rota
                    </button>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </section>

      {(carregando || carregandoResponsavel) && <section className="panel settingsPanel">Carregando rotas...</section>}
      {carregandoMapa && <div className="routeMapLoading">Carregando clientes do mapa...</div>}

      {mapaRota && !carregandoMapa && (
        <RouteMap
          rota={mapaRota}
          clientes={clientesMapa}
          responsavelNome={mapaResponsavelNome}
          onClose={() => setMapaRota(null)}
          onCoordenadas={salvarCoordenadas}
        />
      )}
    </AppShell>
  );
}
