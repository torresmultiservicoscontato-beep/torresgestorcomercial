"use client";
import styles from "./Paginacao.module.css";

type Props = {
  pagina: number; paginas: number; porPagina: number; inicio: number; fim: number; total: number;
  mudarPagina: (pagina: number) => void; mudarTamanho: (tamanho: number) => void;
  nome: string; desabilitada?: boolean;
};
export default function Paginacao(p: Props) {
  if (p.total === 0) return null;
  return <nav className={styles.paginacao} aria-label={`Paginação de ${p.nome}`}>
    <span role="status">{p.inicio + 1}–{p.fim} de {p.total}</span>
    <label>Por página <select aria-label={`Quantidade de ${p.nome} por página`} value={p.porPagina}
      disabled={p.desabilitada} onChange={(e) => p.mudarTamanho(Number(e.target.value))}>
      {[10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
    </select></label>
    <div className={styles.botoes}>
      <button type="button" className="secondary" disabled={p.desabilitada || p.pagina <= 1} onClick={() => p.mudarPagina(p.pagina - 1)}>Anterior</button>
      <span>Página {p.pagina} de {p.paginas}</span>
      <button type="button" className="secondary" disabled={p.desabilitada || p.pagina >= p.paginas} onClick={() => p.mudarPagina(p.pagina + 1)}>Próxima</button>
    </div>
  </nav>;
}
