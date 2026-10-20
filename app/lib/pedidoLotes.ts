import type { ItemVendaInput } from "./vendas";

export type ItemPedidoFormulario = ItemVendaInput & {
  quantidadeLotes?: string;
  tamanhoLote?: number;
};

// Soma em centavos; null indica item incompleto, nunca um total parcial.
export function totalProdutosPedido(itens: ItemVendaInput[]): number | null {
  let centavos = 0;
  for (const item of itens) {
    const texto = item.valorTotal?.trim();
    let total: number;
    if (texto) total = Number(texto.replace(",", "."));
    else {
      if (!item.quantidade?.trim() || !item.valorUnitario?.trim()) return null;
      const quantidade = Number(item.quantidade.replace(",", "."));
      const preco = Number(item.valorUnitario.replace(",", "."));
      if (!Number.isFinite(quantidade) || quantidade <= 0 || !Number.isFinite(preco) || preco < 0) return null;
      total = quantidade * preco;
    }
    if (!Number.isFinite(total) || total < 0) return null;
    centavos += Math.round((total + Number.EPSILON) * 100);
    if (!Number.isSafeInteger(centavos)) return null;
  }
  return centavos / 100;
}

export function atualizarItemPedido(item: ItemPedidoFormulario, campo: keyof ItemPedidoFormulario, valor: string): ItemPedidoFormulario {
  const atualizado = { ...item, [campo]: valor };
  if (item.tamanhoLote === undefined) {
    if (campo === "quantidade" || campo === "valorUnitario") {
      const quantidade = Number(atualizado.quantidade?.replace(",", "."));
      const preco = Number(atualizado.valorUnitario?.replace(",", "."));
      atualizado.valorTotal = atualizado.quantidade?.trim() && atualizado.valorUnitario?.trim()
        && Number.isFinite(quantidade) && quantidade > 0 && Number.isFinite(preco) && preco >= 0
        ? (quantidade * preco).toFixed(2) : "";
    }
    return atualizado;
  }
  if (campo === "quantidadeLotes" || campo === "valorUnitario") {
    const lotes = Number(atualizado.quantidadeLotes?.replace(",", "."));
    const quantidade = lotes * item.tamanhoLote;
    atualizado.quantidade = Number.isSafeInteger(lotes) && lotes > 0 && Number.isFinite(quantidade)
      ? String(Math.round(quantidade * 1000) / 1000) : "";
    const preco = Number(atualizado.valorUnitario?.replace(",", "."));
    atualizado.valorTotal = atualizado.quantidade && atualizado.valorUnitario?.trim() && Number.isFinite(preco) && preco >= 0
      ? (Number(atualizado.quantidade) * preco).toFixed(2) : "";
  }
  return atualizado;
}

export function itemPedidoParaSalvar(item: ItemPedidoFormulario): ItemVendaInput {
  const { quantidadeLotes, tamanhoLote, ...salvo } = item;
  if (tamanhoLote !== undefined) {
    const calculado = atualizarItemPedido(item, "quantidadeLotes", quantidadeLotes ?? "");
    if (!calculado.quantidade) throw new Error(`Informe uma quantidade inteira de lotes maior que zero para ${item.produto}.`);
    salvo.quantidade = calculado.quantidade;
    salvo.valorTotal = calculado.valorTotal;
  }
  return salvo;
}
