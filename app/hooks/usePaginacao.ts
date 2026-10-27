"use client";
import { useState } from "react";
import { calcularPagina } from "../lib/paginacao";

export function usePaginacao<T>(itens: T[], filtro = "") {
  const [estado, setEstado] = useState({ filtro, pagina: 1, porPagina: 25 });
  if (estado.filtro !== filtro) setEstado({ ...estado, filtro, pagina: 1 });
  const info = calcularPagina(itens.length, estado.filtro === filtro ? estado.pagina : 1, estado.porPagina);
  // Keep navigation valid after deletion from the last page.
  if (estado.filtro === filtro && estado.pagina !== info.pagina) setEstado({ ...estado, pagina: info.pagina });
  return {
    ...info,
    itens: itens.slice(info.inicio, info.fim),
    mudarPagina: (pagina: number) => setEstado((atual) => ({ ...atual, filtro, pagina })),
    mudarTamanho: (porPagina: number) => setEstado({ filtro, pagina: 1, porPagina }),
  };
}
