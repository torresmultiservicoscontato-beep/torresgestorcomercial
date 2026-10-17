"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, MapPin, Navigation, X } from "lucide-react";
import type { ClienteMapaRota, RotaSemanal } from "../lib/rotas";

declare global {
  interface Window {
    L?: any;
  }
}

type Props = {
  rota: RotaSemanal;
  clientes: ClienteMapaRota[];
  onClose: () => void;
  onCoordenadas: (clienteId: string, latitude: number, longitude: number) => Promise<void>;
};

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

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
    {
      attribution: "Tiles &copy; Esri",
      maxZoom: 19,
    },
  );

  const satelite = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Imagery &copy; Esri",
      maxZoom: 19,
    },
  );

  ruas.addTo(mapa);
  L.control.layers(
    {
      "Mapa de ruas": ruas,
      "Satélite": satelite,
    },
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

export default function RouteMap({ rota, clientes, onClose, onCoordenadas }: Props) {
  const mapaElementoRef = useRef<HTMLDivElement | null>(null);
  const mapaInstanciaRef = useRef<any>(null);
  const [clientesLocais, setClientesLocais] = useState(clientes);
  const [representadaId, setRepresentadaId] = useState("");
  const [localizando, setLocalizando] = useState(false);
  const [mensagemMapa, setMensagemMapa] = useState("");

  useEffect(() => {
    setClientesLocais(clientes);
  }, [clientes]);

  const clientesFiltrados = useMemo(() => {
    const filtrados = representadaId
      ? clientesLocais.filter((cliente) => cliente.representadas.some((item) => item.id === representadaId))
      : clientesLocais;

    return [...filtrados].sort((a, b) => {
      const ordemA = a.ordem ?? Number.MAX_SAFE_INTEGER;
      const ordemB = b.ordem ?? Number.MAX_SAFE_INTEGER;
      return ordemA - ordemB || a.nome.localeCompare(b.nome, "pt-BR");
    });
  }, [clientesLocais, representadaId]);

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
    // A geocodificação deve iniciar apenas quando a lista carregada muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes]);

  useEffect(() => {
    let cancelado = false;

    async function desenharMapa() {
      if (!mapaElementoRef.current) return;

      const comCoordenadas = clientesFiltrados.filter(
        (cliente) => cliente.latitude !== null && cliente.longitude !== null,
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
        const primeiro = comCoordenadas[0];
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

        const pontos = comCoordenadas.map((cliente, indice) => {
          const latitude = cliente.latitude as number;
          const longitude = cliente.longitude as number;
          const icone = L.divIcon({
            className: "routeMapMarkerShell",
            html: `<span class="routeMapMarker">${indice + 1}</span>`,
            iconSize: [30, 30],
            iconAnchor: [15, 30],
          });

          L.marker([latitude, longitude], { icon: icone })
            .addTo(mapa)
            .bindPopup(`<strong>${cliente.nome}</strong><br>${enderecoExibicao(cliente)}`);

          return [latitude, longitude] as [number, number];
        });

        if (pontos.length > 1) {
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
                  style: { color: "#1e63d6", weight: 4, opacity: 0.8, dashArray: "9 8" },
                }).addTo(mapa);
                desenhouRuas = true;
              }
            }
          } catch {
            desenhouRuas = false;
          }

          if (!desenhouRuas) {
            L.polyline(pontos, { color: "#1e63d6", weight: 4, opacity: 0.8, dashArray: "9 8" }).addTo(mapa);
          }
        }

        const limites = L.latLngBounds(pontos);
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
            {clientesFiltrados.map((cliente, indice) => (
              <article className="routeStop" key={cliente.id}>
                <span className="routeStopNumber">{indice + 1}</span>
                <div>
                  <strong>{cliente.nome}</strong>
                  <span>{enderecoExibicao(cliente)}</span>
                  <small>{cliente.representadas.map((item) => item.nome).join(" • ") || "Sem representada"}</small>
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

        <div className="routeMapFooter">
          <small>O mapa usa os endereços cadastrados dos clientes. A linha segue o trajeto viário quando o serviço de roteamento está disponível e usa ligação tracejada entre os pontos como alternativa.</small>
        </div>
      </div>
    </div>
  );
}
