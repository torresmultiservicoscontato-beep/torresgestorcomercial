"use client";

import { FormEvent, useEffect, useState } from "react";
import { LockKeyhole, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type ModoAcesso = "entrar" | "cadastrar" | "recuperar";

type Cadastro = {
  nome: string;
  nomeRepresentacao: string;
  documentoTipo: "CPF" | "CNPJ";
  documento: string;
  whatsapp: string;
  representadas: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
};

const cadastroInicial: Cadastro = {
  nome: "",
  nomeRepresentacao: "",
  documentoTipo: "CNPJ",
  documento: "",
  whatsapp: "",
  representadas: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
};

function listaRepresentadas(valor: string) {
  return Array.from(
    new Set(
      valor
        .split(/[\n,;]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [modo, setModo] = useState<ModoAcesso>("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [cadastro, setCadastro] = useState<Cadastro>(cadastroInicial);
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!supabase) return;

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router]);

  function atualizarCadastro(campo: keyof Cadastro, valor: string) {
    setCadastro((atual) => ({ ...atual, [campo]: valor }));
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || carregando) return;

    setCarregando(true);
    setErro("");
    setMensagem("");

    try {
      if (modo === "recuperar") {
        const redirectTo = `${window.location.origin}/redefinir-senha`;
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo,
        });

        if (error) throw error;
        setMensagem(
          "Se esse e-mail estiver cadastrado, você receberá um link para definir uma nova senha.",
        );
        return;
      }

      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: senha,
        });

        if (error) throw error;
        router.replace("/");
        router.refresh();
        return;
      }

      const representadas = listaRepresentadas(cadastro.representadas);
      if (representadas.length === 0) {
        throw new Error("Informe pelo menos uma representada.");
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: senha,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            nome: cadastro.nome.trim(),
            nome_representacao: cadastro.nomeRepresentacao.trim(),
            documento_tipo: cadastro.documentoTipo,
            documento: cadastro.documento.trim(),
            whatsapp: cadastro.whatsapp.trim(),
            representadas,
            cep: cadastro.cep.trim(),
            logradouro: cadastro.logradouro.trim(),
            numero: cadastro.numero.trim(),
            complemento: cadastro.complemento.trim(),
            bairro: cadastro.bairro.trim(),
            cidade: cadastro.cidade.trim(),
            uf: cadastro.uf.trim().toUpperCase().slice(0, 2),
          },
        },
      });

      if (error) throw error;

      if (data.session) {
        router.replace("/");
        router.refresh();
      } else {
        setMensagem(
          "Acesso criado. Confirme o e-mail recebido e depois volte aqui para entrar.",
        );
        setModo("entrar");
      }
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível concluir o acesso.");
    } finally {
      setCarregando(false);
    }
  }

  const titulo =
    modo === "entrar"
      ? "Entrar no sistema"
      : modo === "cadastrar"
        ? "Criar meu acesso"
        : "Recuperar minha senha";

  const descricao =
    modo === "entrar"
      ? "Use seu e-mail e senha para acessar seus clientes e visitas."
      : modo === "cadastrar"
        ? "Cadastre seus dados comerciais. Eles vão personalizar o painel e poderão ser alterados depois em Configurações."
        : "Informe seu e-mail. Enviaremos um link seguro para você criar uma nova senha.";

  return (
    <main className="loginPage">
      <section className={`loginCard ${modo === "cadastrar" ? "loginCardWide" : ""}`}>
        <div className="loginBrand">
          <div className="brandMark">T</div>
          <div>
            <strong>TORRES</strong>
            <span>Gestor Comercial</span>
          </div>
        </div>

        <div className="loginIntro">
          <p className="eyebrow">ACESSO SEGURO</p>
          <h1>{titulo}</h1>
          <p>{descricao}</p>
        </div>

        {erro && <div className="loginAlert error">{erro}</div>}
        {mensagem && <div className="loginAlert success">{mensagem}</div>}

        <form onSubmit={enviar}>
          {modo === "cadastrar" && (
            <div className="signupGrid">
              <label className="field">
                Nome da pessoa
                <input
                  type="text"
                  required
                  value={cadastro.nome}
                  onChange={(event) => atualizarCadastro("nome", event.target.value)}
                  placeholder="Ex.: Bruno Torres"
                />
              </label>

              <label className="field">
                Nome da representação
                <input
                  type="text"
                  required
                  value={cadastro.nomeRepresentacao}
                  onChange={(event) => atualizarCadastro("nomeRepresentacao", event.target.value)}
                  placeholder="Ex.: Torres Multi Representações"
                />
              </label>

              <label className="field">
                Tipo de documento
                <select
                  value={cadastro.documentoTipo}
                  onChange={(event) =>
                    atualizarCadastro("documentoTipo", event.target.value as "CPF" | "CNPJ")
                  }
                >
                  <option value="CPF">CPF</option>
                  <option value="CNPJ">CNPJ</option>
                </select>
              </label>

              <label className="field">
                {cadastro.documentoTipo}
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={cadastro.documento}
                  onChange={(event) => atualizarCadastro("documento", event.target.value)}
                  placeholder={cadastro.documentoTipo === "CPF" ? "000.000.000-00" : "00.000.000/0000-00"}
                />
              </label>

              <label className="field">
                WhatsApp
                <input
                  type="tel"
                  required
                  value={cadastro.whatsapp}
                  onChange={(event) => atualizarCadastro("whatsapp", event.target.value)}
                  placeholder="(21) 99999-9999"
                />
              </label>

              <label className="field">
                CEP
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={cadastro.cep}
                  onChange={(event) => atualizarCadastro("cep", event.target.value)}
                  placeholder="00000-000"
                />
              </label>

              <label className="field signupSpan2">
                Representadas
                <textarea
                  required
                  value={cadastro.representadas}
                  onChange={(event) => atualizarCadastro("representadas", event.target.value)}
                  placeholder={"Digite uma por linha. Ex.:\nKing Ouro\nArgamil\nVedacit"}
                />
                <small>Você pode cadastrar várias. Também aceitamos separação por vírgula.</small>
              </label>

              <label className="field signupSpan2">
                Endereço
                <input
                  type="text"
                  required
                  value={cadastro.logradouro}
                  onChange={(event) => atualizarCadastro("logradouro", event.target.value)}
                  placeholder="Rua, avenida, estrada..."
                />
              </label>

              <label className="field">
                Número
                <input
                  type="text"
                  required
                  value={cadastro.numero}
                  onChange={(event) => atualizarCadastro("numero", event.target.value)}
                />
              </label>

              <label className="field">
                Complemento
                <input
                  type="text"
                  value={cadastro.complemento}
                  onChange={(event) => atualizarCadastro("complemento", event.target.value)}
                  placeholder="Opcional"
                />
              </label>

              <label className="field">
                Bairro
                <input
                  type="text"
                  required
                  value={cadastro.bairro}
                  onChange={(event) => atualizarCadastro("bairro", event.target.value)}
                />
              </label>

              <label className="field">
                Cidade
                <input
                  type="text"
                  required
                  value={cadastro.cidade}
                  onChange={(event) => atualizarCadastro("cidade", event.target.value)}
                />
              </label>

              <label className="field">
                UF
                <input
                  type="text"
                  required
                  maxLength={2}
                  value={cadastro.uf}
                  onChange={(event) => atualizarCadastro("uf", event.target.value.toUpperCase())}
                  placeholder="RJ"
                />
              </label>
            </div>
          )}

          <label className="field">
            E-mail
            <div className="loginInput">
              <Mail size={18} />
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="seuemail@exemplo.com"
              />
            </div>
          </label>

          {modo !== "recuperar" && (
            <label className="field">
              Senha
              <div className="loginInput">
                <LockKeyhole size={18} />
                <input
                  type="password"
                  autoComplete={modo === "entrar" ? "current-password" : "new-password"}
                  required
                  minLength={6}
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                />
              </div>
            </label>
          )}

          {modo === "entrar" && (
            <button
              className="forgotPassword"
              type="button"
              onClick={() => {
                setModo("recuperar");
                setErro("");
                setMensagem("");
              }}
            >
              Esqueceu a senha?
            </button>
          )}

          <button className="primary wide" type="submit" disabled={carregando}>
            {carregando
              ? "Aguarde..."
              : modo === "entrar"
                ? "Entrar"
                : modo === "cadastrar"
                  ? "Criar acesso"
                  : "Enviar link de recuperação"}
          </button>
        </form>

        {modo === "recuperar" ? (
          <button
            className="loginSwitch"
            type="button"
            onClick={() => {
              setModo("entrar");
              setErro("");
              setMensagem("");
            }}
          >
            Voltar para o login
          </button>
        ) : (
          <button
            className="loginSwitch"
            type="button"
            onClick={() => {
              setModo((atual) => (atual === "entrar" ? "cadastrar" : "entrar"));
              setErro("");
              setMensagem("");
            }}
          >
            {modo === "entrar" ? "Primeiro acesso? Criar conta" : "Já tenho acesso? Entrar"}
          </button>
        )}
      </section>
    </main>
  );
}
