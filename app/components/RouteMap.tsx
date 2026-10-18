"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, MapPin, Navigation, UserRound, X } from "lucide-react";
import type { ClienteMapaRota, RotaSemanal } from "../lib/rotas";

declare global {
  interface Window {
    L?: any;
  }
}

type Props = {
  rota: RotaSemanal;
  clientes: ClienteMapaRota[];
  responsavelNome?: string;
  onClose: () => void;
  onCoordenadas: (clienteId: string, latitude: number, longitude: number) => Promise<void>;
};

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

const CORES_RESPONSAVEIS = [
  "#1e63d6", "#16805d", "#d97706", "#7c3aed", "#c2415d", "#0f766e", "#9333ea", "#b45309",
];

const CORES_REPRESENTADAS = [
  "#dc2626", "#eab308", "#7c3aed", "#111827", "#0891b2", "#ea580c", "#16a34a", "#be185d",
];

function indiceEstavel(valor: string, tamanho: number) {
  let hash = 0;
  for (let i = 0; i < valor.length; i += 1) hash = ((hash << 5) - hash + valor.charCodeAt(i)) | 0;
  return Math.abs(hash) % tamanho;
}

function corResponsavel(chave: string) {
  return CORES_RESPONSAVEIS[indiceEstavel(chave || "titular", CORES_RESPONSAVEIS.length)];
}

function corRepresentada(id: string) {
  return CORES_REPRESENTADAS[indiceEstavel(id || "sem-representada", CORES_REPRESENTADAS.length)];
}

function gradienteRepresentadas(ids: string[]) {
  const unicos = Array.from(new Set(ids.filter(Boolean)));
  if (unicos.length === 0) return "#cbd5e1";
  if (unicos.length === 1) return corRepresentada(unicos[0]);
  const passo = 100 / unicos.length;
  return `conic-gradient(${unicos.map((id, indice) => {
    const inicio = (indice * passo).toFixed(2);
    const fim = ((indice + 1) * passo).toFixed(2);
    return `${corRepresentada(id)} ${inicio}% ${fim}%`;
  }).join(", ")})`;
}

function escaparHtml(valor: string) {
  return valor.replace(/[&<>"']/g, (caractere) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[caractere] ?? caractere));
}

function esperar(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function carregarLeaflet() {
  if (window.L) return window.L;

  if (!document.getElementById("torres-leaflet-css")) {
    const link = document.createElement("link");
    link.id = "torres-leaflet-css";
    link.rel = "stylesheet";
    link.href = LEAFLET_CSS;
    document.head.appendChild(link);
  }

  const existente = document.getElementById("torres-leaflet-js") as HTMLScriptElement | null;
  if (existente) {
    await new Promise<void>((resolve, reject) => {
      if (window.L) resolve();
      else {
        existente.addEventListener("load", () => resolve(), { once: true });
        existente.addEventListener("error", () => reject(new Error("Falha ao carregar o mapa.")), { once: true });
      }
    });
    return window.L;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = "torres-leaflet-js";
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar o mapa."));
    document.body.appendChild(script);
  });

  return window.L;
}

function adicionarCamadasBase(L: any, mapa: any) {
  const ruas = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    { attribution: "Tiles &copy; Esri", maxZoom: 19 },
  );

  const satelite = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { attribution: "Imagery &copy; Esri", maxZoom: 19 },
  );

  ruas.addTo(mapa);
  L.control.layers(
    { "Mapa de ruas": ruas, "Satélite": satelite },
    undefined,
    { position: "topright", collapsed: true },
  ).addTo(mapa);

  return ruas;
}

function enderecoBusca(cliente: ClienteMapaRota) {
  return [
    [cliente.logradouro, cliente.numero].filter(Boolean).join(", "),
    cliente.bairro,
    cliente.cidade,
    cliente.cep,
    "Brasil",
  ].filter(Boolean).join(", ");
}

function enderecoExibicao(cliente: ClienteMapaRota) {
  const linha1 = [cliente.logradouro, cliente.numero].filter(Boolean).join(", ");
  const linha2 = [cliente.bairro, cliente.cidade].filter(Boolean).join(" • ");
  return [linha1, linha2].filter(Boolean).join(" — ") || "Endereço incompleto";
}

async function geocodificar(cliente: ClienteMapaRota) {
  const consulta = enderecoBusca(cliente);
  if (!cliente.logradouro || !cliente.cidade || !consulta) return null;

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&accept-language=pt-BR&q=${encodeURIComponent(consulta)}`;
  const resposta = await fetch(url, { headers: { Accept: "application/json" } });
  if (!resposta.ok) return null;

  const resultados = await resposta.json() as Array<{ lat: string; lon: string }>;
  const primeiro = resultados[0];
  if (!primeiro) return null;

  const latitude = Number(primeiro.lat);
  const longitude = Number(primeiro.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

export default function RouteMap({ rota, clientes, responsavelNome = "Titular", onClose, onCoordenadas }: Props) {
  const mapaElementoRef = useRef<HTMLDivElement | null>(null);
  const mapaInstanciaRef = useRef<any>(null);
  const [clientesLocais, setClientesLocais] = useState(clientes);
  const [representadaId, setRepresentadaId] = useState("");
  const [localizando, setLocalizando] = useState(false);
  const [mensagemMapa, setMensagemMapa] = useState("");

  useEffect(() => {
    setClientesLocais(clientes);
  }, [clientes]);

  const clientesFiltrados = useMemo(
    () => representadaId
      ? clientesLocais.filter((cliente) => cliente.representadas.some((item) => item.id === representadaId))
      : clientesLocais,
    [clientesLocais, representadaId],
  );

  const clientesNumerados = useMemo(() => {
    const contadores = new Map<string, number>();
    return clientesFiltrados.map((cliente) => {
      const grupo = cliente.grupoRotaId || cliente.responsavelNome || "titular";
      const proximo = (contadores.get(grupo) ?? 0) + 1;
      contadores.set(grupo, proximo);
      return { cliente, numeroRota: proximo, grupo };
    });
  }, [clientesNumerados, clientesFiltrados.length, responsavelNome]);

  const legendaResponsaveis = useMemo(() => {
    const mapa = new Map<string, string>();
    clientesLocais.forEach((cliente) => {
      const chave = cliente.grupoRotaId || cliente.responsavelNome || "titular";
      mapa.set(chave, cliente.responsavelNome || responsavelNome || "Titular");
    });
    return Array.from(mapa.entries()).map(([chave, nome]) => ({ chave, nome, cor: corResponsavel(chave) }));
  }, [clientesLocais, responsavelNome]);

  const legendaRepresentadas = useMemo(() => {
    const mapa = new Map<string, string>();
    clientesLocais.forEach((cliente) => cliente.representadas.forEach((item) => mapa.set(item.id, item.nome)));
    return Array.from(mapa.entries())
      .map(([id, nome]) => ({ id, nome, cor: corRepresentada(id) }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [clientesLocais]);

  useEffect(() => {
    let cancelado = false;

    async function localizarPendentes() {
      const pendentes = clientesLocais.filter(
        (cliente) => cliente.latitude === null && cliente.longitude === null && cliente.logradouro && cliente.cidade,
      );
      if (pendentes.length === 0) return;

      setLocalizando(true);
      for (let indice = 0; indice < pendentes.length; indice += 1) {
        if (cancelado) return;
        const cliente = pendentes[indice];
        try {
          const coordenadas = await geocodificar(cliente);
          if (cancelado) return;
          if (coordenadas) {
            setClientesLocais((lista) => lista.map((item) =>
              item.id === cliente.id
                ? { ...item, latitude: coordenadas.latitude, longitude: coordenadas.longitude }
                : item,
            ));
            await onCoordenadas(cliente.id, coordenadas.latitude, coordenadas.longitude);
          }
        } catch {
          // Mantém o cliente listado para permitir correção cadastral do endereço.
        }
        if (indice < pendentes.length - 1) await esperar(1100);
      }
      if (!cancelado) setLocalizando(false);
    }

    void localizarPendentes();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes]);

  useEffect(() => {
    let cancelado = false;

    async function desenharMapa() {
      if (!mapaElementoRef.current) return;

      const comCoordenadas = clientesNumerados.filter(
        ({ cliente }) => cliente.latitude !== null && cliente.longitude !== null,
      );

      if (mapaInstanciaRef.current) {
        mapaInstanciaRef.current.remove();
        mapaInstanciaRef.current = null;
      }

      if (comCoordenadas.length === 0) {
        setMensagemMapa(clientesFiltrados.length === 0
          ? "Nenhum cliente está vinculado a esta rota ainda."
          : "Os clientes desta rota ainda não possuem endereço suficiente para aparecer no mapa.");
        return;
      }

      try {
        const L = await carregarLeaflet();
        if (cancelado || !L || !mapaElementoRef.current) return;

        setMensagemMapa("");
        const primeiro = comCoordenadas[0].cliente;
        const mapa = L.map(mapaElementoRef.current, { zoomControl: true }).setView(
          [primeiro.latitude, primeiro.longitude],
          13,
        );
        mapaInstanciaRef.current = mapa;

        const camadaBase = adicionarCamadasBase(L, mapa);
        let errosTiles = 0;
        camadaBase.on("tileerror", () => {
          errosTiles += 1;
          if (errosTiles >= 4 && !cancelado) {
            setMensagemMapa("A camada do mapa não respondeu. Tente alternar para Satélite no controle do mapa.");
          }
        });

        const pontosTodos: Array<[number, number]> = [];
        const grupos = new Map<string, Array<[number, number]>>();

        comCoordenadas.forEach(({ cliente, numeroRota, grupo }) => {
          const latitude = cliente.latitude as number;
          const longitude = cliente.longitude as number;
          const preenchimento = corResponsavel(grupo);
          const contorno = gradienteRepresentadas(cliente.representadas.map((item) => item.id));
          const icone = L.divIcon({
            className: "routeMapMarkerShell",
            html: `<span class="routeMapMarkerRing" style="background:${contorno}"><span class="routeMapMarkerInner" style="background:${preenchimento}">${numeroRota}</span></span>`,
            iconSize: [34, 34],
            iconAnchor: [17, 34],
          });
          const responsavel = cliente.responsavelNome || responsavelNome || "Titular";
          const representadasPopup = cliente.representadas.map((item) => escaparHtml(item.nome)).join(" • ");

          L.marker([latitude, longitude], { icon: icone })
            .addTo(mapa)
            .bindPopup(
              `<strong>${escaparHtml(cliente.nome)}</strong><br>${escaparHtml(enderecoExibicao(cliente))}` +
              `<br><small>Responsável: ${escaparHtml(responsavel)}</small>` +
              (representadasPopup ? `<br><small>Representadas: ${representadasPopup}</small>` : "") +
              `<br><small>Parada nº ${numeroRota}</small>`,
            );

          const ponto: [number, number] = [latitude, longitude];
          pontosTodos.push(ponto);
          const pontosGrupo = grupos.get(grupo) ?? [];
          pontosGrupo.push(ponto);
          grupos.set(grupo, pontosGrupo);
        });

        for (const [grupo, pontos] of grupos.entries()) {
          if (pontos.length < 2) continue;

          let desenhouRuas = false;
          try {
            const coordenadasOsrm = pontos.map(([lat, lng]) => `${lng},${lat}`).join(";");
            const resposta = await fetch(
              `https://router.project-osrm.org/route/v1/driving/${coordenadasOsrm}?overview=full&geometries=geojson`,
            );
            if (resposta.ok) {
              const dados = await resposta.json() as { routes?: Array<{ geometry?: unknown }> };
              const geometria = dados.routes?.[0]?.geometry;
              if (geometria && !cancelado) {
                L.geoJSON(geometria, {
                  style: { color: corResponsavel(grupo), weight: 4, opacity: 0.82, dashArray: "9 8" },
                }).addTo(mapa);
                desenhouRuas = true;
              }
            }
          } catch {
            desenhouRuas = false;
          }

          if (!desenhouRuas) {
            L.polyline(pontos, { color: corResponsavel(grupo), weight: 4, opacity: 0.82, dashArray: "9 8" }).addTo(mapa);
          }
        }

        const limites = L.latLngBounds(pontosTodos);
        mapa.fitBounds(limites, { padding: [35, 35], maxZoom: 15 });
        window.setTimeout(() => mapa.invalidateSize(), 100);
      } catch (falha) {
        if (!cancelado) {
          setMensagemMapa(falha instanceof Error ? falha.message : "Não foi possível abrir o mapa.");
        }
      }
    }

    void desenharMapa();

    return () => {
      cancelado = true;
      if (mapaInstanciaRef.current) {
        mapaInstanciaRef.current.remove();
        mapaInstanciaRef.current = null;
      }
    };
  }, [clientesFiltrados]);

  const localizados = clientesFiltrados.filter(
    (cliente) => cliente.latitude !== null && cliente.longitude !== null,
  ).length;

  return (
    <div className="routeMapOverlay" role="dialog" aria-modal="true" aria-label={`Mapa da rota de ${rota.municipio || "campo"}`}>
      <div className="routeMapModal">
        <div className="routeMapHeader">
          <div>
            <p className="eyebrow">MAPA DA ROTA</p>
            <h2>{rota.municipio || "Rota semanal"}</h2>
            <span>{rota.bairros.join(" • ") || "Sem bairros definidos"}</span>
            <span className="routeMapOwner"><UserRound size={12} /> {responsavelNome}</span>
          </div>
          <button className="iconBtn" type="button" onClick={onClose} title="Fechar mapa">
            <X size={18} />
          </button>
        </div>

        <div className="routeMapToolbar">
          <label className="field routeMapFilter">
            Representada
            <select value={representadaId} onChange={(event) => setRepresentadaId(event.target.value)}>
              <option value="">Todas as representadas</option>
              {rota.representadas.map((representada) => (
                <option key={representada.id} value={representada.id}>{representada.nome}</option>
              ))}
            </select>
          </label>
          <div className="routeMapStatus">
            {localizando ? <LoaderCircle className="spin" size={16} /> : <MapPin size={16} />}
            <span>{localizando ? "Localizando endereços..." : `${localizados} de ${clientesFiltrados.length} pontos no mapa`}</span>
          </div>
        </div>

        <div className="routeMapBody">
          <aside className="routeStops">
            <div className="routeStopsTitle">
              <Navigation size={17} />
              <strong>Pontos de parada</strong>
            </div>
            {clientesNumerados.map(({ cliente, numeroRota, grupo }) => (
              <article className="routeStop" key={cliente.id}>
                <span
                  className="routeStopNumber routeStopNumberColored"
                  style={{
                    background: corResponsavel(grupo),
                    border: `3px solid ${cliente.representadas[0] ? corRepresentada(cliente.representadas[0].id) : "#cbd5e1"}`,
                  }}
                >{numeroRota}</span>
                <div>
                  <strong>{cliente.nome}</strong>
                  <span>{enderecoExibicao(cliente)}</span>
                  <small>{cliente.representadas.map((item) => item.nome).join(" • ") || "Sem representada"}</small>
                  {cliente.responsavelNome && <small className="routeStopOwner">Responsável: {cliente.responsavelNome}</small>}
                  {(cliente.latitude === null || cliente.longitude === null) && (
                    <small className="routeStopWarning">Aguardando localização do endereço</small>
                  )}
                </div>
              </article>
            ))}
            {clientesFiltrados.length === 0 && <div className="emptyState">Nenhum cliente vinculado a esta rota.</div>}
          </aside>

          <div className="routeMapCanvasWrap">
            <div ref={mapaElementoRef} className="routeMapCanvas" />
            {mensagemMapa && <div className="routeMapMessage">{mensagemMapa}</div>}
          </div>
        </div>

        <div className="routeMapLegend">
          <div>
            <strong>Responsáveis — preenchimento</strong>
            <div className="routeLegendItems">
              {legendaResponsaveis.map((item) => (
                <span className="routeLegendItem" key={item.chave}>
                  <i style={{ background: item.cor }} /> {item.nome}
                </span>
              ))}
            </div>
          </div>
          <div>
            <strong>Representadas — contorno</strong>
            <div className="routeLegendItems">
              {legendaRepresentadas.map((item) => (
                <span className="routeLegendItem" key={item.id}>
                  <i className="routeLegendRing" style={{ borderColor: item.cor }} /> {item.nome}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="routeMapFooter">
          <small>O preenchimento identifica o responsável; o contorno identifica as representadas. Clientes com mais de uma representada usam o anel dividido em cores. O número é a ordem da parada dentro da rota de cada responsável.</small>
        </div>
      </div>
    </div>
  );
}
