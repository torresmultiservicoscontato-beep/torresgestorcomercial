export async function pingExtracao() {
  const response = await fetch("/functions/v1/extrair-itens-venda", { method: "POST" });
  return response.ok;
}
