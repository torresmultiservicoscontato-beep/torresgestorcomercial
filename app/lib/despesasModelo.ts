export const categoriasDespesa = {
  "Dia a dia": ["Combustível", "Transporte", "Pedágio", "Estacionamento", "Almoço", "Lanche", "Hospedagem", "Manutenção do veículo", "Outras despesas de campo"],
  "Administrativa": ["Contador", "Impostos", "CORE / Conselho", "Telefone e internet", "Sistemas e assinaturas", "Aluguel", "Material de escritório", "Outras despesas administrativas"],
} as const;

export type GrupoDespesa = keyof typeof categoriasDespesa;
export type StatusDespesa = "Pendente" | "Pago" | "Cancelado";
export const formasPagamento = ["Pix", "Dinheiro", "Cartão de débito", "Cartão de crédito", "Boleto", "Transferência", "Outro"] as const;
export type FormaPagamento = typeof formasPagamento[number];

export type Despesa = {
  id: string;
  titular_user_id: string;
  responsavel_user_id: string;
  responsavel_nome: string;
  grupo: GrupoDespesa;
  categoria: string;
  descricao: string;
  valor_centavos: number;
  data: string;
  vencimento: string | null;
  status: StatusDespesa;
  pago_em: string | null;
  forma_pagamento: FormaPagamento | null;
  fornecedor: string;
  documento: string;
  observacao: string;
  rota_id: string | null;
  rota_nome: string;
  criado_por_user_id: string;
  created_at: string;
  updated_at: string;
};

export type FormDespesa = Pick<Despesa, "responsavel_user_id" | "grupo" | "categoria" | "descricao" | "data" | "status" | "fornecedor" | "documento" | "observacao"> & {
  valor: string;
  vencimento: string;
  pago_em: string;
  forma_pagamento: FormaPagamento | "";
  rota_id: string;
};

export function hojeDespesa() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
}

export function valorEmCentavos(texto: string): number {
  const limpo = texto.trim().replace(/^R\$\s*/, "");
  const formatoBr = /^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/;
  const formatoDecimal = /^\d+(?:\.\d{1,2})?$/;
  let normalizado: string;
  if (formatoBr.test(limpo)) normalizado = limpo.replace(/\./g, "").replace(",", ".");
  else if (formatoDecimal.test(limpo)) normalizado = limpo;
  else throw new Error("Informe um valor válido, como 35,90.");
  const [inteiro, decimal = ""] = normalizado.split(".");
  const centavos = Number(inteiro) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(centavos) || centavos <= 0 || centavos > 9999999999) throw new Error("O valor deve ser maior que zero e menor que R$ 100 milhões.");
  return centavos;
}

export function dataValida(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T12:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor && valor >= "1900-01-01" && valor <= "2199-12-31";
}

export function validarDespesa(form: FormDespesa, hoje = hojeDespesa()) {
  if (!form.responsavel_user_id) throw new Error("Selecione o responsável.");
  if (!categoriasDespesa[form.grupo]?.some((categoria) => categoria === form.categoria)) throw new Error("Selecione uma categoria do grupo escolhido.");
  if (!form.descricao.trim() || form.descricao.trim().length > 160) throw new Error("Informe uma descrição com até 160 caracteres.");
  if (!dataValida(form.data) || (form.vencimento && !dataValida(form.vencimento))) throw new Error("Confira a data da despesa e o vencimento.");
  if (!["Pago", "Pendente", "Cancelado"].includes(form.status)) throw new Error("Selecione a situação da despesa.");
  if (form.status === "Pago" && (!dataValida(form.pago_em) || form.pago_em > hoje)) throw new Error("Informe uma data de pagamento válida, até hoje.");
  if (form.status === "Pago" && !formasPagamento.some((forma) => forma === form.forma_pagamento)) throw new Error("Selecione a forma de pagamento.");
  if (form.fornecedor.trim().length > 160 || form.documento.trim().length > 80 || form.observacao.trim().length > 2000) throw new Error("Revise o tamanho dos campos fornecedor, documento e observações.");
  if (form.grupo === "Administrativa" && form.rota_id) throw new Error("Vincule rotas apenas às despesas do dia a dia.");
  return valorEmCentavos(form.valor);
}

export function resumirDespesas(despesas: Despesa[], hoje = hojeDespesa()) {
  return despesas.reduce((resumo, despesa) => {
    if (despesa.status === "Cancelado") return resumo;
    resumo.total += Number(despesa.valor_centavos);
    if (despesa.status === "Pago") resumo.pago += Number(despesa.valor_centavos);
    else {
      resumo.pendente += Number(despesa.valor_centavos);
      if (despesa.vencimento && despesa.vencimento < hoje) resumo.vencido += Number(despesa.valor_centavos);
    }
    return resumo;
  }, { total: 0, pago: 0, pendente: 0, vencido: 0 });
}
