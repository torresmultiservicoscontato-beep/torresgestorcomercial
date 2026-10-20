export type TipoRelatorio = 'visitas' | 'vendas' | 'financeiro' | 'despesas' | 'agenda';
export type ConfiguracaoRelatorio = {
  versao: 1; tipo: TipoRelatorio; colunas: string[]; indicadores: string[];
  periodo: { modo: 'fixo' | 'mes-atual' | 'ultimos-30'; inicio: string; fim: string };
  filtros: { responsavel: string; busca: string; canal: string; representada: string; rota: string; semVenda: boolean };
};
export type FavoritoRelatorio = { id: string; nome: string; configuracao: ConfiguracaoRelatorio };
export function configuracaoValida(valor: unknown): valor is ConfiguracaoRelatorio {
  if (!valor || typeof valor !== 'object') return false;
  const c = valor as ConfiguracaoRelatorio;
  const textos = (v: unknown) => Array.isArray(v) && v.length <= 30 && v.every(x => typeof x === 'string' && x.length <= 100);
  return c.versao === 1 && ['visitas','vendas','financeiro','despesas','agenda'].includes(c.tipo)
    && textos(c.colunas) && c.colunas.length > 0 && textos(c.indicadores)
    && !!c.periodo && ['fixo','mes-atual','ultimos-30'].includes(c.periodo.modo)
    && typeof c.periodo.inicio === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.periodo.inicio)
    && typeof c.periodo.fim === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.periodo.fim)
    && !!c.filtros && ['responsavel','busca','canal','representada','rota'].every(k => typeof c.filtros[k as keyof typeof c.filtros] === 'string' && String(c.filtros[k as keyof typeof c.filtros]).length <= 500)
    && typeof c.filtros.semVenda === 'boolean';
}
export function periodoFavorito(periodo: ConfiguracaoRelatorio['periodo'], hoje: string) {
  if (periodo.modo === 'fixo') return {inicio:periodo.inicio,fim:periodo.fim};
  const [ano,mes,dia] = hoje.split('-').map(Number);
  if (periodo.modo === 'mes-atual') return {inicio:`${hoje.slice(0,7)}-01`,fim:`${hoje.slice(0,7)}-${new Date(Date.UTC(ano,mes,0)).getUTCDate()}`};
  const inicio = new Date(Date.UTC(ano,mes-1,dia-29)).toISOString().slice(0,10);
  return {inicio,fim:hoje};
}
export function selecionarCampos<T extends {colunas:string[]; indicadores:[string,string][]; linhas:(string|number)[][]}>(base:T, colunas: string[] | null, indicadores: string[] | null):T {
  const indices = base.colunas.map((nome,i)=>({nome,i})).filter(c=>colunas===null||colunas.includes(c.nome));
  return {...base,colunas:indices.map(c=>c.nome),linhas:base.linhas.map(l=>indices.map(c=>l[c.i])),indicadores:base.indicadores.filter(([nome])=>indicadores===null||indicadores.includes(nome))};
}
