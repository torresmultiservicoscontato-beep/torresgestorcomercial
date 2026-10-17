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

const CHAVE_PROPRIA = "__propria__";

const dias = [
  { id: 1, nome: "Segunda-feira" },
  { id: 2, nome: "Terça-feira" },
  { id: 3, nome: "Quarta-feira" },
  { id: 4, nome: "Quinta-feira" },
  { id: 5, nome: "Sexta-feira" },
  { id: 6, nome: "Sábado" },
  { id: 7, nome: "Domingo" },
];

type RotaComResponsavel = {
  rota: RotaSemanal;
  chave: string;
  nomeResponsavel: string;
  propria: boolean;
};

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
  const [rotasPorResponsavel, setRotasPorResponsavel] = useState<Record<string, RotaSemanal[]>>({});
  const [representadas, setRepresentadas] = useState<RepresentadaRota[]>([]);
  const [prepostos, setPrepostos] = useState<Preposto[]>([]);
  const [responsaveisSelecionados, setResponsaveisSelecionados] = useState<string[]>([CHAVE_PROPRIA]);
  const [nomeProprio, setNomeProprio] = useState("Titular");
  const [usuarioEhPreposto, setUsuarioEhPreposto] = useState(false);
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
        setRotasPorResponsavel({ [CHAVE_PROPRIA]: listaRotas });
        setRepresentadas(listaRepresentadas);
        setPodeCadastrar(pode(acesso, "rotas", "cadastrar"));
        setPodeEditar(pode(acesso, "rotas", "editar"));
        setUsuarioEhPreposto(acesso?.papel === "preposto");
        setNomeProprio(acesso?.papel === "preposto" ? acesso.nome : "Titular");

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

  const responsaveisEquipe = useMemo(
    () => [
      { chave: CHAVE_PROPRIA, nome: usuarioEhPreposto ? nomeProprio : "Titular / minhas rotas", userId: "" },
      ...prepostos.map((preposto) => ({
        chave: preposto.userId as string,
        nome: preposto.nome,
        userId: preposto.userId as string,
      })),
    ],
    [nomeProprio, prepostos, usuarioEhPreposto],
  );

  const todosSelecionados = responsaveisEquipe.length > 0
    && responsaveisEquipe.every((responsavel) => responsaveisSelecionados.includes(responsavel.chave));

  function nomeResponsavel(chave: string) {
    if (chave === CHAVE_PROPRIA) return nomeProprio;
    return prepostos.find((preposto) => preposto.userId === chave)?.nome ?? "Preposto";
  }

  async function garantirRotasResponsavel(chave: string) {
    if (rotasPorResponsavel[chave]) return rotasPorResponsavel[chave];

    const userId = chave === CHAVE_PROPRIA ? undefined : chave;
    const rotas = await listarRotasSemanais(userId);
    setRotasPorResponsavel((atual) => ({ ...atual, [chave]: rotas }));
    return rotas;
  }

  async function alternarResponsavel(chave: string, marcada: boolean) {
    setErro("");
    setMensagem("");
    setMapaRota(null);
    setClientesMapa([]);
    setEditandoDia(null);

    if (!marcada) {
      setResponsaveisSelecionados((atual) => atual.filter((item) => item !== chave));
      return;
    }

    setResponsaveisSelecionados((atual) => Array.from(new Set([...atual, chave])));
    if (rotasPorResponsavel[chave]) return;

    setCarregandoResponsavel(true);
    try {
      await garantirRotasResponsavel(chave);
    } catch (falha) {
      setResponsaveisSelecionados((atual) => atual.filter((item) => item !== chave));
      setErro(falha instanceof Error ? falha.message : "Não foi possível carregar as rotas deste responsável.");
    } finally {
      setCarregandoResponsavel(false);
    }
  }

  async function alternarTodos(marcada: boolean) {
    setErro("");
    setMensagem("");
    setMapaRota(null);
    setClientesMapa([]);
    setEditandoDia(null);

    if (!marcada) {
      setResponsaveisSelecionados([]);
      return;
    }

    const chaves = responsaveisEquipe.map((responsavel) => responsavel.chave);
    setResponsaveisSelecionados(chaves);
    setCarregandoResponsavel(true);

    try {
      await Promise.all(chaves.map((chave) => garantirRotasResponsavel(chave)));
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível carregar todas as rotas da equipe.");
    } finally {
      setCarregandoResponsavel(false);
    }
  }

  function rotasDoDia(diaSemana: number): RotaComResponsavel[] {
    return responsaveisSelecionados.flatMap((chave) => {
      const rota = (rotasPorResponsavel[chave] ?? []).find((item) => item.diaSemana === diaSemana);
      if (!rota) return [];
      return [{
        rota,
        chave,
        nomeResponsavel: nomeResponsavel(chave),
        propria: chave === CHAVE_PROPRIA,
      }];
    });
  }

  function abrirCadastro(diaSemana: number) {
    if (!responsaveisSelecionados.includes(CHAVE_PROPRIA)) return;

    const rota = (rotasPorResponsavel[CHAVE_PROPRIA] ?? []).find((item) => item.diaSemana === diaSemana);
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

  async function abrirMapaDia(diaSemana: number, rotasSelecionadas: RotaComResponsavel[]) {
    if (rotasSelecionadas.length === 0) return;

    setClientesMapa([]);
    setCarregandoMapa(true);
    setErro("");

    try {
      const resultados = await Promise.all(
        rotasSelecionadas.map(async (item) => {
          const clientes = await listarClientesMapaRota(item.rota.id);
          return clientes.map((cliente) => ({
            ...cliente,
            responsavelNome: item.nomeResponsavel,
            grupoRotaId: item.rota.id,
          }));
        }),
      );

      const representadasUnicas = new Map<string, RepresentadaRota>();
      const bairros = new Set<string>();
      const municipios = new Set<string>();

      rotasSelecionadas.forEach((item) => {
        if (item.rota.municipio) municipios.add(item.rota.municipio);
        item.rota.bairros.forEach((bairro) => bairros.add(bairro));
        item.rota.representadas.forEach((representada) => representadasUnicas.set(representada.id, representada));
      });

      const nomeDia = dias.find((dia) => dia.id === diaSemana)?.nome ?? "Rota";
      const rotaMapa: RotaSemanal = {
        id: `consolidada-${diaSemana}`,
        diaSemana,
        municipio: rotasSelecionadas.length > 1
          ? `Rota consolidada — ${nomeDia}`
          : rotasSelecionadas[0].rota.municipio,
        bairros: Array.from(bairros),
        observacao: "",
        representadas: Array.from(representadasUnicas.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
        atualizadoEm: "",
      };

      setMapaRota(rotaMapa);
      setClientesMapa(resultados.flat());
      setMapaResponsavelNome(
        rotasSelecionadas.length > 1
          ? `${rotasSelecionadas.length} responsáveis selecionados`
          : `Responsável: ${rotasSelecionadas[0].nomeResponsavel}`,
      );
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
    if (salvando || editandoDia === null) return;

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

    const rotaPropria = (rotasPorResponsavel[CHAVE_PROPRIA] ?? []).find((rota) => rota.diaSemana === editandoDia);

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
        editando: Boolean(rotaPropria),
      });
      setRotasPorResponsavel((atual) => ({ ...atual, [CHAVE_PROPRIA]: atualizadas }));
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
          <p>Cadastre a rota padrão e combine no mapa os clientes do titular e dos prepostos selecionados.</p>
        </div>
      </header>

      {podeVerEquipe && prepostos.length > 0 && (
        <section className="panel routeTeamViewer routeTeamViewerChecks">
          <div className="routeTeamViewerTitle">
            <UsersRound size={19} />
            <div>
              <strong>Visualização da equipe</strong>
              <span>Marque quem você quer visualizar. É possível combinar titular e vários prepostos no mesmo mapa.</span>
            </div>
          </div>

          <div className="routeTeamChecks">
            <label className="routeTeamCheck routeTeamCheckAll">
              <input
                type="checkbox"
                checked={todosSelecionados}
                disabled={carregandoResponsavel}
                onChange={(event) => void alternarTodos(event.target.checked)}
              />
              <span><strong>Todos</strong><small>Mapa consolidado da equipe</small></span>
            </label>

            {responsaveisEquipe.map((responsavel) => (
              <label className="routeTeamCheck" key={responsavel.chave}>
                <input
                  type="checkbox"
                  checked={responsaveisSelecionados.includes(responsavel.chave)}
                  disabled={carregandoResponsavel}
                  onChange={(event) => void alternarResponsavel(responsavel.chave, event.target.checked)}
                />
                <span>
                  <strong>{responsavel.nome}</strong>
                  <small>{responsavel.chave === CHAVE_PROPRIA ? "Rota própria" : "Preposto"}</small>
                </span>
              </label>
            ))}
          </div>

          <span className="tag routeViewingBadge">
            {carregandoResponsavel
              ? "Carregando..."
              : `${responsaveisSelecionados.length} de ${responsaveisEquipe.length} selecionados`}
          </span>
        </section>
      )}

      {podeVerEquipe && responsaveisSelecionados.length > 1 && (
        <div className="loginAlert success settingsAlert">
          Visão consolidada ativa: o mapa de cada dia reunirá os clientes dos responsáveis marcados, mantendo o percurso de cada rota separado.
        </div>
      )}

      {erro && <div className="loginAlert error settingsAlert">{erro}</div>}
      {mensagem && <div className="loginAlert success settingsAlert">{mensagem}</div>}

      <section className="routesGrid">
        {dias.map((dia) => {
          const rotasSelecionadas = rotasDoDia(dia.id);
          const rotaPropria = (rotasPorResponsavel[CHAVE_PROPRIA] ?? []).find((rota) => rota.diaSemana === dia.id);
          const estaEditando = editandoDia === dia.id;
          const propriaSelecionada = responsaveisSelecionados.includes(CHAVE_PROPRIA);
          const podeAbrirCadastro = propriaSelecionada && (rotaPropria ? podeEditar : podeCadastrar);

          return (
            <article className="panel routeCard" key={dia.id}>
              <div className="panelTitle routeCardHeader">
                <div>
                  <p className="eyebrow">
                    {responsaveisSelecionados.length > 1 ? "ROTA CONSOLIDADA" : "ROTA PADRÃO"}
                  </p>
                  <h2>{dia.nome}</h2>
                </div>
                <div className="routeCardActions">
                  {rotasSelecionadas.length > 0 && !estaEditando && (
                    <button
                      className="iconBtn routeMapButton"
                      type="button"
                      onClick={() => void abrirMapaDia(dia.id, rotasSelecionadas)}
                      title="Abrir mapa da rota"
                    >
                      <MapIcon size={16} />
                    </button>
                  )}
                  {podeAbrirCadastro && !estaEditando && (
                    <button
                      className="iconBtn"
                      type="button"
                      onClick={() => abrirCadastro(dia.id)}
                      title={rotaPropria ? "Editar minha rota" : "Cadastrar minha rota"}
                    >
                      {rotaPropria ? <Pencil size={15} /> : <MapPinned size={16} />}
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
              ) : rotasSelecionadas.length > 0 ? (
                <div className="routeSummary routeCombinedSummary">
                  <div className="routePeopleList">
                    {rotasSelecionadas.map((item) => (
                      <div className="routePersonRoute" key={`${item.chave}-${item.rota.id}`}>
                        <div className="routePersonRouteHeader">
                          <strong>{item.nomeResponsavel}</strong>
                          <span className={item.propria ? "tag" : "adminBadge"}>{item.propria ? "Própria" : "Preposto"}</span>
                        </div>
                        <div className="routeLocation">
                          <MapPinned size={18} />
                          <div>
                            <strong>{item.rota.municipio || "Município não informado"}</strong>
                            <span>{item.rota.bairros.length > 0 ? item.rota.bairros.join(" • ") : "Sem bairros definidos"}</span>
                          </div>
                        </div>
                        <div className="representadasTags">
                          {item.rota.representadas.map((representada) => (
                            <span className="tag" key={representada.id}>{representada.nome}</span>
                          ))}
                        </div>
                        {item.rota.observacao && <p>{item.rota.observacao}</p>}
                      </div>
                    ))}
                  </div>

                  <button className="secondary wide routeOpenMap" type="button" onClick={() => void abrirMapaDia(dia.id, rotasSelecionadas)}>
                    <MapIcon size={16} /> {rotasSelecionadas.length > 1 ? "Ver mapa consolidado" : "Ver mapa da rota"}
                  </button>

                  {propriaSelecionada && !rotaPropria && podeCadastrar && (
                    <button className="secondary wide" type="button" onClick={() => abrirCadastro(dia.id)}>
                      Cadastrar minha rota de {dia.nome}
                    </button>
                  )}
                </div>
              ) : (
                <div className="routeEmpty">
                  <MapPinned size={24} />
                  <strong>Nenhuma rota cadastrada</strong>
                  <span>
                    {responsaveisSelecionados.length === 0
                      ? "Marque pelo menos um responsável na visualização da equipe."
                      : "Os responsáveis selecionados não possuem rota cadastrada para este dia."}
                  </span>
                  {propriaSelecionada && podeCadastrar && (
                    <button className="secondary" type="button" onClick={() => abrirCadastro(dia.id)}>
                      Cadastrar minha rota
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
