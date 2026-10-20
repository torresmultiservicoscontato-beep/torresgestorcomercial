import type { ItemVendaInput } from "./vendas";

export type ItemPedidoFormulario = ItemVendaInput & {
  quantidadeLotes?: string;
  tamanhoLote?: number;
};

export function atualizarItemPedido(item: ItemPedidoFormulario, campo: keyof ItemPedidoFormulario, valor: string): ItemPedidoFormulario {
  const atualizado = { ...item, [campo]: valor };
  if (item.tamanhoLote === undefined) return atualizado;
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
