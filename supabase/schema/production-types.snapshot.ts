// Snapshot de metadados da estrutura de produção (sem linhas de dados).
// Não substitui o dump SQL: não restaura triggers, RLS, grants, policies ou Storage.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      agenda_eventos: {
        Row: {
          cliente_id: string | null
          concluido_em: string | null
          created_at: string
          criado_por_user_id: string | null
          data: string
          frequencia_cliente: string | null
          hora: string | null
          id: string
          observacao: string
          origem: string
          prioridade: string
          representada_id: string | null
          responsavel_user_id: string
          serie_id: string | null
          status: string
          tipo: string
          titular_user_id: string
          titulo: string
          updated_at: string
          visita_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          concluido_em?: string | null
          created_at?: string
          criado_por_user_id?: string | null
          data: string
          frequencia_cliente?: string | null
          hora?: string | null
          id?: string
          observacao?: string
          origem?: string
          prioridade?: string
          representada_id?: string | null
          responsavel_user_id: string
          serie_id?: string | null
          status?: string
          tipo?: string
          titular_user_id: string
          titulo: string
          updated_at?: string
          visita_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          concluido_em?: string | null
          created_at?: string
          criado_por_user_id?: string | null
          data?: string
          frequencia_cliente?: string | null
          hora?: string | null
          id?: string
          observacao?: string
          origem?: string
          prioridade?: string
          representada_id?: string | null
          responsavel_user_id?: string
          serie_id?: string | null
          status?: string
          tipo?: string
          titular_user_id?: string
          titulo?: string
          updated_at?: string
          visita_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agenda_eventos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_eventos_representada_id_fkey"
            columns: ["representada_id"]
            isOneToOne: false
            referencedRelation: "representadas_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_eventos_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visitas"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria: {
        Row: {
          acao: string
          ator_nome: string
          ator_user_id: string | null
          dados_antes: Json | null
          dados_depois: Json | null
          id: number
          ocorrido_em: string
          origem: string
          registro_id: string
          tabela: string
          titular_user_id: string | null
          transacao: number
        }
        Insert: {
          acao: string
          ator_nome: string
          ator_user_id?: string | null
          dados_antes?: Json | null
          dados_depois?: Json | null
          id?: never
          ocorrido_em?: string
          origem: string
          registro_id: string
          tabela: string
          titular_user_id?: string | null
          transacao?: number
        }
        Update: {
          acao?: string
          ator_nome?: string
          ator_user_id?: string | null
          dados_antes?: Json | null
          dados_depois?: Json | null
          id?: never
          ocorrido_em?: string
          origem?: string
          registro_id?: string
          tabela?: string
          titular_user_id?: string | null
          transacao?: number
        }
        Relationships: []
      }
      cliente_representadas: {
        Row: {
          cliente_id: string
          created_at: string
          representada_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          representada_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          representada_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_representadas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_representadas_representada_id_fkey"
            columns: ["representada_id"]
            isOneToOne: false
            referencedRelation: "representadas_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          bairro: string
          cep: string
          cidade: string
          complemento: string
          created_at: string
          criado_por_user_id: string | null
          frequencia_data_base: string | null
          frequencia_visita: string
          geocodificado_em: string | null
          id: string
          latitude: number | null
          logradouro: string
          longitude: number | null
          nome: string
          numero: string
          representada: string
          representada_id: string | null
          responsavel_user_id: string | null
          rota_id: string | null
          rota_ordem: number | null
          status: string
          telefone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bairro?: string
          cep?: string
          cidade?: string
          complemento?: string
          created_at?: string
          criado_por_user_id?: string | null
          frequencia_data_base?: string | null
          frequencia_visita?: string
          geocodificado_em?: string | null
          id: string
          latitude?: number | null
          logradouro?: string
          longitude?: number | null
          nome: string
          numero?: string
          representada?: string
          representada_id?: string | null
          responsavel_user_id?: string | null
          rota_id?: string | null
          rota_ordem?: number | null
          status?: string
          telefone?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          bairro?: string
          cep?: string
          cidade?: string
          complemento?: string
          created_at?: string
          criado_por_user_id?: string | null
          frequencia_data_base?: string | null
          frequencia_visita?: string
          geocodificado_em?: string | null
          id?: string
          latitude?: number | null
          logradouro?: string
          longitude?: number | null
          nome?: string
          numero?: string
          representada?: string
          representada_id?: string | null
          responsavel_user_id?: string | null
          rota_id?: string | null
          rota_ordem?: number | null
          status?: string
          telefone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_representada_id_fkey"
            columns: ["representada_id"]
            isOneToOne: false
            referencedRelation: "representadas_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "rotas_semanais"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas: {
        Row: {
          categoria: string
          cliente_id: string | null
          cliente_nome: string
          created_at: string
          criado_por_user_id: string
          data: string
          descricao: string
          documento: string
          forma_pagamento: string | null
          fornecedor: string
          grupo: string
          id: string
          observacao: string
          pago_em: string | null
          responsavel_nome: string
          responsavel_user_id: string
          rota_id: string | null
          rota_nome: string
          status: string
          titular_user_id: string
          updated_at: string
          valor_centavos: number
          vencimento: string | null
        }
        Insert: {
          categoria: string
          cliente_id?: string | null
          cliente_nome?: string
          created_at?: string
          criado_por_user_id?: string
          data: string
          descricao: string
          documento?: string
          forma_pagamento?: string | null
          fornecedor?: string
          grupo: string
          id?: string
          observacao?: string
          pago_em?: string | null
          responsavel_nome?: string
          responsavel_user_id: string
          rota_id?: string | null
          rota_nome?: string
          status?: string
          titular_user_id: string
          updated_at?: string
          valor_centavos: number
          vencimento?: string | null
        }
        Update: {
          categoria?: string
          cliente_id?: string | null
          cliente_nome?: string
          created_at?: string
          criado_por_user_id?: string
          data?: string
          descricao?: string
          documento?: string
          forma_pagamento?: string | null
          fornecedor?: string
          grupo?: string
          id?: string
          observacao?: string
          pago_em?: string | null
          responsavel_nome?: string
          responsavel_user_id?: string
          rota_id?: string | null
          rota_nome?: string
          status?: string
          titular_user_id?: string
          updated_at?: string
          valor_centavos?: number
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "despesas_cliente_titular_fk"
            columns: ["cliente_id", "titular_user_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "despesas_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "rotas_semanais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_titular_user_id_fkey"
            columns: ["titular_user_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["user_id"]
          },
        ]
      }
      perfil_representadas: {
        Row: {
          created_at: string
          nome: string
          representada_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          nome: string
          representada_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          nome?: string
          representada_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfil_representadas_representada_id_fkey"
            columns: ["representada_id"]
            isOneToOne: false
            referencedRelation: "representadas_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis: {
        Row: {
          bairro: string
          cep: string
          cidade: string
          complemento: string
          created_at: string
          documento: string
          documento_tipo: string
          logradouro: string
          nome: string
          nome_representacao: string
          numero: string
          papel: string
          uf: string
          updated_at: string
          user_id: string
          whatsapp: string
        }
        Insert: {
          bairro: string
          cep: string
          cidade: string
          complemento?: string
          created_at?: string
          documento: string
          documento_tipo: string
          logradouro: string
          nome: string
          nome_representacao: string
          numero: string
          papel?: string
          uf: string
          updated_at?: string
          user_id: string
          whatsapp: string
        }
        Update: {
          bairro?: string
          cep?: string
          cidade?: string
          complemento?: string
          created_at?: string
          documento?: string
          documento_tipo?: string
          logradouro?: string
          nome?: string
          nome_representacao?: string
          numero?: string
          papel?: string
          uf?: string
          updated_at?: string
          user_id?: string
          whatsapp?: string
        }
        Relationships: []
      }
      preposto_perfis: {
        Row: {
          bairro: string
          cep: string
          cidade: string
          complemento: string
          created_at: string
          documento: string
          documento_tipo: string
          email: string
          logradouro: string
          nome: string
          numero: string
          uf: string
          updated_at: string
          user_id: string
          whatsapp: string
        }
        Insert: {
          bairro?: string
          cep?: string
          cidade?: string
          complemento?: string
          created_at?: string
          documento?: string
          documento_tipo?: string
          email: string
          logradouro?: string
          nome: string
          numero?: string
          uf?: string
          updated_at?: string
          user_id: string
          whatsapp?: string
        }
        Update: {
          bairro?: string
          cep?: string
          cidade?: string
          complemento?: string
          created_at?: string
          documento?: string
          documento_tipo?: string
          email?: string
          logradouro?: string
          nome?: string
          numero?: string
          uf?: string
          updated_at?: string
          user_id?: string
          whatsapp?: string
        }
        Relationships: []
      }
      preposto_produto_comissoes: {
        Row: {
          comissao_preposto_percentual: number
          created_at: string
          produto_id: string
          updated_at: string
          vinculo_id: string
        }
        Insert: {
          comissao_preposto_percentual: number
          created_at?: string
          produto_id: string
          updated_at?: string
          vinculo_id: string
        }
        Update: {
          comissao_preposto_percentual?: number
          created_at?: string
          produto_id?: string
          updated_at?: string
          vinculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preposto_produto_comissoes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "representada_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preposto_produto_comissoes_vinculo_id_fkey"
            columns: ["vinculo_id"]
            isOneToOne: false
            referencedRelation: "prepostos"
            referencedColumns: ["id"]
          },
        ]
      }
      preposto_representadas: {
        Row: {
          comissao_preposto_percentual: number
          created_at: string
          dia_pagamento_comissao: number | null
          id: string
          preposto_user_id: string
          representada_id: string
          status: string
          updated_at: string
          vinculo_id: string
        }
        Insert: {
          comissao_preposto_percentual?: number
          created_at?: string
          dia_pagamento_comissao?: number | null
          id?: string
          preposto_user_id: string
          representada_id: string
          status?: string
          updated_at?: string
          vinculo_id: string
        }
        Update: {
          comissao_preposto_percentual?: number
          created_at?: string
          dia_pagamento_comissao?: number | null
          id?: string
          preposto_user_id?: string
          representada_id?: string
          status?: string
          updated_at?: string
          vinculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preposto_representadas_representada_id_fkey"
            columns: ["representada_id"]
            isOneToOne: false
            referencedRelation: "representadas_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preposto_representadas_vinculo_id_fkey"
            columns: ["vinculo_id"]
            isOneToOne: false
            referencedRelation: "prepostos"
            referencedColumns: ["id"]
          },
        ]
      }
      prepostos: {
        Row: {
          created_at: string
          email: string
          id: string
          nome: string
          permissoes: Json
          status: string
          titular_user_id: string
          updated_at: string
          user_id: string | null
          whatsapp: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          nome: string
          permissoes?: Json
          status?: string
          titular_user_id: string
          updated_at?: string
          user_id?: string | null
          whatsapp?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nome?: string
          permissoes?: Json
          status?: string
          titular_user_id?: string
          updated_at?: string
          user_id?: string | null
          whatsapp?: string
        }
        Relationships: []
      }
      relatorios_favoritos: {
        Row: {
          configuracao: Json
          contexto_responsavel: string
          created_at: string
          id: string
          nome: string
          titular_user_id: string
          updated_at: string
          usuario_id: string
        }
        Insert: {
          configuracao: Json
          contexto_responsavel?: string
          created_at?: string
          id?: string
          nome: string
          titular_user_id: string
          updated_at?: string
          usuario_id: string
        }
        Update: {
          configuracao?: Json
          contexto_responsavel?: string
          created_at?: string
          id?: string
          nome?: string
          titular_user_id?: string
          updated_at?: string
          usuario_id?: string
        }
        Relationships: []
      }
      representada_operacoes: {
        Row: {
          base_comissao: string
          cnpj: string
          comissao_percentual: number
          created_at: string
          dia_recebimento_comissao: number | null
          email: string
          endereco: string
          observacao_comissao: string
          representada_id: string
          telefone: string
          titular_user_id: string
          updated_at: string
        }
        Insert: {
          base_comissao?: string
          cnpj?: string
          comissao_percentual?: number
          created_at?: string
          dia_recebimento_comissao?: number | null
          email?: string
          endereco?: string
          observacao_comissao?: string
          representada_id: string
          telefone?: string
          titular_user_id: string
          updated_at?: string
        }
        Update: {
          base_comissao?: string
          cnpj?: string
          comissao_percentual?: number
          created_at?: string
          dia_recebimento_comissao?: number | null
          email?: string
          endereco?: string
          observacao_comissao?: string
          representada_id?: string
          telefone?: string
          titular_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "representada_operacoes_representada_id_fkey"
            columns: ["representada_id"]
            isOneToOne: false
            referencedRelation: "representadas_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      representada_produtos: {
        Row: {
          ativo: boolean
          codigo: string
          comissao_percentual: number | null
          created_at: string
          id: string
          nome: string
          preco_venda: number | null
          quantidade_minima: number
          representada_id: string
          titular_user_id: string
          unidade: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo?: string
          comissao_percentual?: number | null
          created_at?: string
          id?: string
          nome: string
          preco_venda?: number | null
          quantidade_minima?: number
          representada_id: string
          titular_user_id: string
          unidade?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          comissao_percentual?: number | null
          created_at?: string
          id?: string
          nome?: string
          preco_venda?: number | null
          quantidade_minima?: number
          representada_id?: string
          titular_user_id?: string
          unidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "representada_produtos_representada_id_fkey"
            columns: ["representada_id"]
            isOneToOne: false
            referencedRelation: "representadas_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      representadas_catalogo: {
        Row: {
          cnpj: string | null
          cnpj_normalizado: string | null
          created_at: string
          id: string
          nome: string
          nome_normalizado: string
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          cnpj_normalizado?: string | null
          created_at?: string
          id?: string
          nome: string
          nome_normalizado: string
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          cnpj_normalizado?: string | null
          created_at?: string
          id?: string
          nome?: string
          nome_normalizado?: string
          updated_at?: string
        }
        Relationships: []
      }
      rota_representadas: {
        Row: {
          created_at: string
          representada_id: string
          rota_id: string
        }
        Insert: {
          created_at?: string
          representada_id: string
          rota_id: string
        }
        Update: {
          created_at?: string
          representada_id?: string
          rota_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rota_representadas_representada_id_fkey"
            columns: ["representada_id"]
            isOneToOne: false
            referencedRelation: "representadas_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_representadas_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "rotas_semanais"
            referencedColumns: ["id"]
          },
        ]
      }
      rotas_semanais: {
        Row: {
          bairros: string[]
          created_at: string
          dia_semana: number
          excluida_em: string | null
          excluida_por: string | null
          id: string
          municipio: string
          observacao: string
          responsavel_user_id: string
          titular_user_id: string
          updated_at: string
        }
        Insert: {
          bairros?: string[]
          created_at?: string
          dia_semana: number
          excluida_em?: string | null
          excluida_por?: string | null
          id?: string
          municipio?: string
          observacao?: string
          responsavel_user_id: string
          titular_user_id: string
          updated_at?: string
        }
        Update: {
          bairros?: string[]
          created_at?: string
          dia_semana?: number
          excluida_em?: string | null
          excluida_por?: string | null
          id?: string
          municipio?: string
          observacao?: string
          responsavel_user_id?: string
          titular_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      venda_anexos: {
        Row: {
          caminho_storage: string
          created_at: string
          erro_extracao: string
          extraido_em: string | null
          id: string
          nome_arquivo: string
          quantidade_itens_extraidos: number
          status_extracao: string
          tamanho_bytes: number | null
          tipo_mime: string
          venda_id: string
        }
        Insert: {
          caminho_storage: string
          created_at?: string
          erro_extracao?: string
          extraido_em?: string | null
          id?: string
          nome_arquivo: string
          quantidade_itens_extraidos?: number
          status_extracao?: string
          tamanho_bytes?: number | null
          tipo_mime?: string
          venda_id: string
        }
        Update: {
          caminho_storage?: string
          created_at?: string
          erro_extracao?: string
          extraido_em?: string | null
          id?: string
          nome_arquivo?: string
          quantidade_itens_extraidos?: number
          status_extracao?: string
          tamanho_bytes?: number | null
          tipo_mime?: string
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_anexos_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      venda_comissao_itens: {
        Row: {
          comissao_preposto_percentual: number
          comissao_representante_percentual: number
          created_at: string
          descricao: string
          id: string
          ordem_id: string
          produto_id: string | null
          valor_base: number
          valor_comissao_preposto: number
          valor_comissao_representante: number
          venda_item_id: string | null
        }
        Insert: {
          comissao_preposto_percentual?: number
          comissao_representante_percentual?: number
          created_at?: string
          descricao?: string
          id?: string
          ordem_id: string
          produto_id?: string | null
          valor_base?: number
          valor_comissao_preposto?: number
          valor_comissao_representante?: number
          venda_item_id?: string | null
        }
        Update: {
          comissao_preposto_percentual?: number
          comissao_representante_percentual?: number
          created_at?: string
          descricao?: string
          id?: string
          ordem_id?: string
          produto_id?: string | null
          valor_base?: number
          valor_comissao_preposto?: number
          valor_comissao_representante?: number
          venda_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venda_comissao_itens_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "venda_ordens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_comissao_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "representada_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_comissao_itens_venda_item_id_fkey"
            columns: ["venda_item_id"]
            isOneToOne: false
            referencedRelation: "venda_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      venda_comissao_pagamentos: {
        Row: {
          created_at: string
          data_pagamento: string
          id: string
          observacao: string
          ordem_id: string
          tipo: string
          valor: number
        }
        Insert: {
          created_at?: string
          data_pagamento: string
          id?: string
          observacao?: string
          ordem_id: string
          tipo: string
          valor: number
        }
        Update: {
          created_at?: string
          data_pagamento?: string
          id?: string
          observacao?: string
          ordem_id?: string
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "venda_comissao_pagamentos_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "venda_ordens"
            referencedColumns: ["id"]
          },
        ]
      }
      venda_itens: {
        Row: {
          anexo_id: string | null
          codigo: string
          confianca: number | null
          confirmado: boolean
          created_at: string
          id: string
          observacao_extracao: string
          origem: string
          produto: string
          produto_id: string | null
          quantidade: number | null
          quantidade_lotes: number | null
          representada_id: string | null
          tamanho_lote: number | null
          unidade: string
          updated_at: string
          valor_total: number | null
          valor_unitario: number | null
          venda_id: string
        }
        Insert: {
          anexo_id?: string | null
          codigo?: string
          confianca?: number | null
          confirmado?: boolean
          created_at?: string
          id?: string
          observacao_extracao?: string
          origem?: string
          produto: string
          produto_id?: string | null
          quantidade?: number | null
          quantidade_lotes?: number | null
          representada_id?: string | null
          tamanho_lote?: number | null
          unidade?: string
          updated_at?: string
          valor_total?: number | null
          valor_unitario?: number | null
          venda_id: string
        }
        Update: {
          anexo_id?: string | null
          codigo?: string
          confianca?: number | null
          confirmado?: boolean
          created_at?: string
          id?: string
          observacao_extracao?: string
          origem?: string
          produto?: string
          produto_id?: string | null
          quantidade?: number | null
          quantidade_lotes?: number | null
          representada_id?: string | null
          tamanho_lote?: number | null
          unidade?: string
          updated_at?: string
          valor_total?: number | null
          valor_unitario?: number | null
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_itens_anexo_id_fkey"
            columns: ["anexo_id"]
            isOneToOne: false
            referencedRelation: "venda_anexos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "representada_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_itens_representada_id_fkey"
            columns: ["representada_id"]
            isOneToOne: false
            referencedRelation: "representadas_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_itens_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      venda_ordens: {
        Row: {
          ativa: boolean
          created_at: string
          faturado_em: string | null
          id: string
          numero_documento: string
          numero_pedido: string
          previsao_comissao_preposto: string | null
          previsao_comissao_representante: string | null
          representada_id: string
          status: string
          updated_at: string
          valor_faturado: number
          venda_id: string
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          faturado_em?: string | null
          id?: string
          numero_documento?: string
          numero_pedido?: string
          previsao_comissao_preposto?: string | null
          previsao_comissao_representante?: string | null
          representada_id: string
          status?: string
          updated_at?: string
          valor_faturado?: number
          venda_id: string
        }
        Update: {
          ativa?: boolean
          created_at?: string
          faturado_em?: string | null
          id?: string
          numero_documento?: string
          numero_pedido?: string
          previsao_comissao_preposto?: string | null
          previsao_comissao_representante?: string | null
          representada_id?: string
          status?: string
          updated_at?: string
          valor_faturado?: number
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_ordens_representada_id_fkey"
            columns: ["representada_id"]
            isOneToOne: false
            referencedRelation: "representadas_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_ordens_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      venda_recebimentos: {
        Row: {
          created_at: string
          id: string
          numero_parcela: number
          ordem_id: string
          recebido_em: string | null
          status: string
          updated_at: string
          valor_previsto: number
          valor_recebido: number
          vencimento: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          numero_parcela?: number
          ordem_id: string
          recebido_em?: string | null
          status?: string
          updated_at?: string
          valor_previsto?: number
          valor_recebido?: number
          vencimento?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          numero_parcela?: number
          ordem_id?: string
          recebido_em?: string | null
          status?: string
          updated_at?: string
          valor_previsto?: number
          valor_recebido?: number
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venda_recebimentos_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "venda_ordens"
            referencedColumns: ["id"]
          },
        ]
      }
      venda_representadas: {
        Row: {
          created_at: string
          representada_id: string
          venda_id: string
        }
        Insert: {
          created_at?: string
          representada_id: string
          venda_id: string
        }
        Update: {
          created_at?: string
          representada_id?: string
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_representadas_representada_id_fkey"
            columns: ["representada_id"]
            isOneToOne: false
            referencedRelation: "representadas_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_representadas_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas: {
        Row: {
          ativa: boolean
          cliente_id: string
          cliente_nome: string
          condicoes_prazo: string[]
          created_at: string
          data: string
          formas_pagamento: string[]
          id: string
          origem: string
          responsavel_user_id: string
          situacao: string
          titular_user_id: string
          updated_at: string
          valor: number
          visita_id: string
        }
        Insert: {
          ativa?: boolean
          cliente_id: string
          cliente_nome: string
          condicoes_prazo?: string[]
          created_at?: string
          data: string
          formas_pagamento?: string[]
          id?: string
          origem?: string
          responsavel_user_id: string
          situacao?: string
          titular_user_id: string
          updated_at?: string
          valor?: number
          visita_id: string
        }
        Update: {
          ativa?: boolean
          cliente_id?: string
          cliente_nome?: string
          condicoes_prazo?: string[]
          created_at?: string
          data?: string
          formas_pagamento?: string[]
          id?: string
          origem?: string
          responsavel_user_id?: string
          situacao?: string
          titular_user_id?: string
          updated_at?: string
          valor?: number
          visita_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: true
            referencedRelation: "visitas"
            referencedColumns: ["id"]
          },
        ]
      }
      visita_representadas: {
        Row: {
          created_at: string
          representada_id: string
          visita_id: string
        }
        Insert: {
          created_at?: string
          representada_id: string
          visita_id: string
        }
        Update: {
          created_at?: string
          representada_id?: string
          visita_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visita_representadas_representada_id_fkey"
            columns: ["representada_id"]
            isOneToOne: false
            referencedRelation: "representadas_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visita_representadas_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visitas"
            referencedColumns: ["id"]
          },
        ]
      }
      visitas: {
        Row: {
          cliente_id: string
          cliente_nome: string
          created_at: string
          criado_por_user_id: string | null
          data: string
          destino: string
          destino_cliente_id: string | null
          duracao_minutos: number | null
          frequencia: string
          hora_entrada: string | null
          hora_saida: string | null
          houve_venda: boolean
          id: string
          km_trecho: number | null
          observacao: string
          odometro: string
          odometro_chegada: number | null
          odometro_final: number | null
          odometro_inicial: number | null
          origem: string
          origem_cliente_id: string | null
          origem_venda: string
          proxima_acao: string
          proxima_data: string | null
          representada_id: string | null
          responsavel_user_id: string | null
          resultado: string
          status_cliente: string
          tipo_contato: string
          updated_at: string
          user_id: string
          valor_venda: number
        }
        Insert: {
          cliente_id: string
          cliente_nome: string
          created_at?: string
          criado_por_user_id?: string | null
          data: string
          destino?: string
          destino_cliente_id?: string | null
          duracao_minutos?: number | null
          frequencia?: string
          hora_entrada?: string | null
          hora_saida?: string | null
          houve_venda?: boolean
          id: string
          km_trecho?: number | null
          observacao?: string
          odometro?: string
          odometro_chegada?: number | null
          odometro_final?: number | null
          odometro_inicial?: number | null
          origem?: string
          origem_cliente_id?: string | null
          origem_venda?: string
          proxima_acao?: string
          proxima_data?: string | null
          representada_id?: string | null
          responsavel_user_id?: string | null
          resultado?: string
          status_cliente?: string
          tipo_contato?: string
          updated_at?: string
          user_id?: string
          valor_venda?: number
        }
        Update: {
          cliente_id?: string
          cliente_nome?: string
          created_at?: string
          criado_por_user_id?: string | null
          data?: string
          destino?: string
          destino_cliente_id?: string | null
          duracao_minutos?: number | null
          frequencia?: string
          hora_entrada?: string | null
          hora_saida?: string | null
          houve_venda?: boolean
          id?: string
          km_trecho?: number | null
          observacao?: string
          odometro?: string
          odometro_chegada?: number | null
          odometro_final?: number | null
          odometro_inicial?: number | null
          origem?: string
          origem_cliente_id?: string | null
          origem_venda?: string
          proxima_acao?: string
          proxima_data?: string | null
          representada_id?: string | null
          responsavel_user_id?: string | null
          resultado?: string
          status_cliente?: string
          tipo_contato?: string
          updated_at?: string
          user_id?: string
          valor_venda?: number
        }
        Relationships: [
          {
            foreignKeyName: "visitas_cliente_usuario_fk"
            columns: ["cliente_id", "user_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "visitas_destino_cliente_id_fkey"
            columns: ["destino_cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_origem_cliente_id_fkey"
            columns: ["origem_cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_representada_id_fkey"
            columns: ["representada_id"]
            isOneToOne: false
            referencedRelation: "representadas_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_listar_usuarios: {
        Args: never
        Returns: {
          clientes: number
          criado_em: string
          email: string
          nome: string
          nome_representacao: string
          papel: string
          prepostos: number
          representadas: number
          user_id: string
          visitas: number
        }[]
      }
      admin_resumo: {
        Args: never
        Returns: {
          clientes: number
          prepostos: number
          representadas: number
          usuarios: number
          visitas: number
        }[]
      }
      atualizar_coordenadas_cliente_rota: {
        Args: { p_cliente_id: string; p_latitude: number; p_longitude: number }
        Returns: undefined
      }
      atualizar_status_agenda: {
        Args: {
          p_evento_id: string
          p_status: string
          p_titular_user_id: string
        }
        Returns: undefined
      }
      atualizar_venda_com_itens: {
        Args: {
          p_condicoes_prazo: string[]
          p_formas_pagamento: string[]
          p_itens: Json
          p_situacao: string
          p_venda_id: string
        }
        Returns: undefined
      }
      atualizar_vinculo_preposto: {
        Args: {
          p_permissoes: Json
          p_representadas: string[]
          p_status: string
          p_vinculo_id: string
        }
        Returns: {
          created_at: string
          email: string
          id: string
          nome: string
          permissoes: Json
          status: string
          titular_user_id: string
          updated_at: string
          user_id: string
          whatsapp: string
        }[]
      }
      cancelar_futuros_frequencia_agenda: {
        Args: { p_evento_id: string; p_titular_user_id: string }
        Returns: number
      }
      carregar_resumo_clientes: {
        Args: { p_hoje: string; p_ids: string[] }
        Returns: {
          cep: string
          complemento: string
          id: string
          latitude: number
          logradouro: string
          longitude: number
          numero: string
          proxima_visita_prevista: string
          rota_id: string
          rota_ordem: number
          ultima_visita: string
        }[]
      }
      confirmar_itens_venda_visita: {
        Args: { p_itens?: Json; p_visita_id: string }
        Returns: number
      }
      data_frequencia_cliente: {
        Args: { p_base: string; p_frequencia: string; p_ordem: number }
        Returns: string
      }
      data_prevista_por_dia: {
        Args: { p_base: string; p_dia: number }
        Returns: string
      }
      excluir_produto: {
        Args: { p_produto_id: string; p_titular_user_id: string }
        Returns: undefined
      }
      excluir_rota_semanal: { Args: { p_rota_id: string }; Returns: undefined }
      excluir_visita: {
        Args: {
          p_responsavel_user_id?: string
          p_titular_user_id: string
          p_visita_id: string
        }
        Returns: undefined
      }
      faturar_ordem_venda: {
        Args: {
          p_data_faturamento: string
          p_numero_documento: string
          p_numero_pedido: string
          p_ordem_id: string
          p_parcelas?: Json
          p_valor_faturado: number
        }
        Returns: undefined
      }
      finalizar_limpeza_anexo_venda: {
        Args: { p_id: string; p_lease: string; p_sucesso: boolean }
        Returns: undefined
      }
      gerar_agenda_frequencia_cliente: {
        Args: { p_cancelar_existentes?: boolean; p_cliente_id: string }
        Returns: number
      }
      listar_agenda_eventos: {
        Args: { p_titular_user_id: string }
        Returns: {
          cliente_id: string
          cliente_nome: string
          concluido_em: string
          created_at: string
          data: string
          evento_id: string
          frequencia_cliente: string
          hora: string
          observacao: string
          origem: string
          prioridade: string
          proxima_visita_prevista: string
          representada_ids: string[]
          representada_nomes: string[]
          responsavel_nome: string
          responsavel_tipo: string
          responsavel_user_id: string
          serie_id: string
          status: string
          tipo: string
          titulo: string
          ultima_visita: string
          visita_id: string
        }[]
      }
      listar_clientes_agenda: {
        Args: { p_titular_user_id: string }
        Returns: {
          cliente_id: string
          nome: string
        }[]
      }
      listar_clientes_mapa_rota: {
        Args: { p_rota_id: string }
        Returns: {
          bairro: string
          cep: string
          cidade: string
          complemento: string
          id: string
          latitude: number
          logradouro: string
          longitude: number
          nome: string
          numero: string
          representada_ids: string[]
          representada_nomes: string[]
          rota_ordem: number
        }[]
      }
      listar_comissoes_modulo: {
        Args: { p_titular_user_id: string }
        Returns: {
          base_comissao: string
          cliente_nome: string
          comissao_preposto_liberada: number
          comissao_preposto_paga: number
          comissao_preposto_total: number
          comissao_representante_liberada: number
          comissao_representante_recebida: number
          comissao_representante_total: number
          data_venda: string
          faturado_em: string
          modo: string
          numero_documento: string
          numero_pedido: string
          ordem_id: string
          previsao_preposto: string
          previsao_representante: string
          representada_id: string
          representada_nome: string
          responsavel_nome: string
          responsavel_user_id: string
          status_pedido: string
          valor_faturado: number
          valor_liquidado: number
          venda_id: string
        }[]
      }
      listar_comissoes_produto_preposto: {
        Args: {
          p_representada_id: string
          p_titular_user_id: string
          p_vinculo_id: string
        }
        Returns: {
          codigo: string
          comissao_preposto_percentual: number
          comissao_representante_percentual: number
          especifica: boolean
          produto_id: string
          produto_nome: string
        }[]
      }
      listar_prepostos_representada: {
        Args: { p_representada_id: string; p_titular_user_id: string }
        Returns: {
          comissao_preposto_percentual: number
          dia_pagamento_comissao: number
          nome: string
          preposto_user_id: string
          vinculo_id: string
        }[]
      }
      listar_produtos_modulo: {
        Args: { p_representada_id?: string; p_titular_user_id: string }
        Returns: {
          ativo: boolean
          codigo: string
          comissao_preposto_especifica: boolean
          comissao_preposto_percentual: number
          comissao_representante_percentual: number
          nome: string
          produto_id: string
          representada_id: string
          representada_nome: string
          unidade: string
        }[]
      }
      listar_produtos_modulo_v2: {
        Args: { p_representada_id?: string; p_titular_user_id: string }
        Returns: {
          ativo: boolean
          codigo: string
          comissao_preposto_especifica: boolean
          comissao_preposto_percentual: number
          comissao_representante_percentual: number
          nome: string
          produto_id: string
          quantidade_minima: number
          representada_id: string
          representada_nome: string
          unidade: string
        }[]
      }
      listar_produtos_modulo_v3: {
        Args: { p_representada_id?: string; p_titular_user_id: string }
        Returns: {
          ativo: boolean
          codigo: string
          comissao_preposto_especifica: boolean
          comissao_preposto_percentual: number
          comissao_representante_percentual: number
          nome: string
          preco_venda: number
          produto_id: string
          quantidade_minima: number
          representada_id: string
          representada_nome: string
          unidade: string
        }[]
      }
      listar_produtos_representada_modulo: {
        Args: { p_representada_id: string; p_titular_user_id: string }
        Returns: {
          ativo: boolean
          codigo: string
          comissao_preposto_especifica: boolean
          comissao_preposto_percentual: number
          comissao_representante_percentual: number
          nome: string
          produto_id: string
          unidade: string
        }[]
      }
      listar_recebimentos_ordem: {
        Args: { p_ordem_id: string }
        Returns: {
          id: string
          numero_parcela: number
          recebido_em: string
          status: string
          valor_previsto: number
          valor_recebido: number
          vencimento: string
        }[]
      }
      listar_representadas_agenda: {
        Args: { p_titular_user_id: string }
        Returns: {
          nome: string
          representada_id: string
        }[]
      }
      listar_representadas_do_vinculo: {
        Args: { p_vinculo_id: string }
        Returns: {
          nome: string
        }[]
      }
      listar_representadas_modulo: {
        Args: { p_titular_user_id: string }
        Returns: {
          base_comissao: string
          cnpj: string
          comissao_percentual: number
          comissao_preposto_percentual: number
          dia_pagamento_preposto: number
          dia_recebimento_comissao: number
          email: string
          endereco: string
          modo: string
          nome: string
          observacao_comissao: string
          representada_id: string
          telefone: string
        }[]
      }
      listar_representadas_operacionais: {
        Args: { p_responsavel_user_id: string; p_titular_user_id: string }
        Returns: {
          nome: string
          representada_id: string
        }[]
      }
      listar_representadas_para_preposto: {
        Args: {
          p_email: string
          p_titular_user_id: string
          p_vinculo_id?: string
        }
        Returns: {
          cnpj: string
          disponivel: boolean
          nome: string
          representada_id: string
        }[]
      }
      listar_responsaveis_agenda: {
        Args: { p_titular_user_id: string }
        Returns: {
          nome: string
          tipo: string
          user_id: string
        }[]
      }
      listar_rotas_semanais: {
        Args: { p_responsavel_user_id: string; p_titular_user_id: string }
        Returns: {
          bairros: string[]
          dia_semana: number
          id: string
          municipio: string
          observacao: string
          representada_ids: string[]
          representada_nomes: string[]
          updated_at: string
        }[]
      }
      listar_vinculos_preposto_atual: {
        Args: never
        Returns: {
          created_at: string
          id: string
          nome_representacao: string
          nome_representante: string
          permissoes: Json
          representadas: string[]
          status: string
          titular_user_id: string
        }[]
      }
      normalizar_representada: { Args: { p_valor: string }; Returns: string }
      pode_acessar_rota_operacional: {
        Args: {
          p_acao: string
          p_responsavel_user_id: string
          p_titular_user_id: string
        }
        Returns: boolean
      }
      preposto_tem_permissao: {
        Args: { p_acao: string; p_modulo: string; p_titular_user_id: string }
        Returns: boolean
      }
      preposto_tem_representada: {
        Args: { p_representada_id: string; p_titular_user_id: string }
        Returns: boolean
      }
      registrar_baixa_recebimento: {
        Args: {
          p_data_recebimento: string
          p_recebimento_id: string
          p_valor_recebido: number
        }
        Returns: undefined
      }
      registrar_itens_extraidos_documento: {
        Args: { p_anexo_id: string; p_itens: Json }
        Returns: number
      }
      registrar_pagamento_comissao: {
        Args: {
          p_data: string
          p_observacao?: string
          p_ordem_id: string
          p_tipo: string
          p_valor: number
        }
        Returns: string
      }
      representadas_validas_para_responsavel: {
        Args: {
          p_representadas: string[]
          p_responsavel_user_id: string
          p_titular_user_id: string
        }
        Returns: boolean
      }
      reservar_limpeza_anexos_vendas: {
        Args: { p_token: string }
        Returns: {
          caminho: string
          id: string
          lease: string
        }[]
      }
      responder_vinculo_preposto: {
        Args: { p_aceitar: boolean; p_vinculo_id: string }
        Returns: undefined
      }
      salvar_cliente_completo:
        | {
            Args: {
              p_bairro: string
              p_cep: string
              p_cidade: string
              p_complemento: string
              p_id: string
              p_logradouro: string
              p_nome: string
              p_numero: string
              p_representadas: string[]
              p_responsavel_user_id: string
              p_rota_id: string
              p_status: string
              p_telefone: string
              p_titular_user_id: string
            }
            Returns: {
              bairro: string
              cep: string
              cidade: string
              complemento: string
              id: string
              latitude: number
              logradouro: string
              longitude: number
              nome: string
              numero: string
              representada: string
              representada_id: string
              responsavel_user_id: string
              rota_id: string
              rota_ordem: number
              status: string
              telefone: string
            }[]
          }
        | {
            Args: {
              p_bairro: string
              p_cep: string
              p_cidade: string
              p_complemento: string
              p_frequencia_visita: string
              p_id: string
              p_logradouro: string
              p_nome: string
              p_numero: string
              p_representadas: string[]
              p_responsavel_user_id: string
              p_rota_id: string
              p_status: string
              p_telefone: string
              p_titular_user_id: string
            }
            Returns: {
              bairro: string
              cep: string
              cidade: string
              complemento: string
              frequencia_data_base: string
              frequencia_visita: string
              id: string
              latitude: number
              logradouro: string
              longitude: number
              nome: string
              numero: string
              representada: string
              representada_id: string
              responsavel_user_id: string
              rota_id: string
              rota_ordem: number
              status: string
              telefone: string
            }[]
          }
      salvar_cliente_multirepresentada: {
        Args: {
          p_bairro: string
          p_cidade: string
          p_id: string
          p_nome: string
          p_representadas: string[]
          p_responsavel_user_id: string
          p_status: string
          p_telefone: string
          p_titular_user_id: string
        }
        Returns: {
          bairro: string
          cidade: string
          id: string
          nome: string
          representada: string
          representada_id: string
          responsavel_user_id: string
          status: string
          telefone: string
        }[]
      }
      salvar_comissao_produto_preposto: {
        Args: {
          p_comissao_percentual: number
          p_produto_id: string
          p_titular_user_id: string
          p_vinculo_id: string
        }
        Returns: undefined
      }
      salvar_detalhes_venda_visita: {
        Args: {
          p_condicoes_prazo?: string[]
          p_formas_pagamento?: string[]
          p_itens?: Json
          p_situacao?: string
          p_visita_id: string
        }
        Returns: string
      }
      salvar_evento_agenda: {
        Args: {
          p_cliente_id?: string
          p_data?: string
          p_evento_id?: string
          p_hora?: string
          p_observacao?: string
          p_prioridade?: string
          p_representada_id?: string
          p_responsavel_user_id?: string
          p_tipo?: string
          p_titular_user_id: string
          p_titulo?: string
        }
        Returns: string
      }
      salvar_produto_representada: {
        Args: {
          p_ativo: boolean
          p_codigo: string
          p_id: string
          p_nome: string
          p_representada_id: string
          p_titular_user_id: string
          p_unidade: string
        }
        Returns: string
      }
      salvar_produto_representada_v2: {
        Args: {
          p_ativo: boolean
          p_codigo: string
          p_comissao_percentual: number
          p_id: string
          p_nome: string
          p_representada_id: string
          p_titular_user_id: string
          p_unidade: string
        }
        Returns: string
      }
      salvar_produto_representada_v3: {
        Args: {
          p_ativo: boolean
          p_codigo: string
          p_comissao_percentual: number
          p_id: string
          p_nome: string
          p_quantidade_minima: number
          p_representada_id: string
          p_titular_user_id: string
          p_unidade: string
        }
        Returns: string
      }
      salvar_produto_representada_v4: {
        Args: {
          p_ativo: boolean
          p_codigo: string
          p_comissao_percentual: number
          p_id: string
          p_nome: string
          p_preco_venda: number
          p_quantidade_minima: number
          p_representada_id: string
          p_titular_user_id: string
          p_unidade: string
        }
        Returns: string
      }
      salvar_repasse_preposto_representada: {
        Args: {
          p_comissao_percentual: number
          p_dia_pagamento: number
          p_representada_id: string
          p_titular_user_id: string
          p_vinculo_id: string
        }
        Returns: undefined
      }
      salvar_representada_operacao: {
        Args: {
          p_base_comissao: string
          p_cnpj: string
          p_comissao_percentual: number
          p_dia_recebimento_comissao: number
          p_email: string
          p_endereco: string
          p_nome: string
          p_observacao_comissao: string
          p_representada_id: string
          p_telefone: string
          p_titular_user_id: string
        }
        Returns: string
      }
      salvar_rota_semanal: {
        Args: {
          p_bairros: string[]
          p_dia_semana: number
          p_municipio: string
          p_observacao: string
          p_representadas: string[]
          p_responsavel_user_id: string
          p_titular_user_id: string
        }
        Returns: string
      }
      salvar_visita_completa: {
        Args: {
          p_cliente_id: string
          p_data: string
          p_destino: string
          p_frequencia: string
          p_hora_entrada: string
          p_hora_saida: string
          p_houve_venda: boolean
          p_id: string
          p_observacao: string
          p_odometro_final: number
          p_odometro_inicial: number
          p_origem: string
          p_origem_venda: string
          p_proxima_acao: string
          p_proxima_data: string
          p_representadas: string[]
          p_responsavel_user_id: string
          p_resultado: string
          p_status_cliente: string
          p_tipo_contato: string
          p_titular_user_id: string
          p_valor_venda: number
        }
        Returns: {
          cliente_id: string
          cliente_nome: string
          data: string
          destino: string
          duracao_minutos: number
          frequencia: string
          hora_entrada: string
          hora_saida: string
          houve_venda: boolean
          id: string
          km_trecho: number
          observacao: string
          odometro: string
          odometro_final: number
          odometro_inicial: number
          origem: string
          origem_venda: string
          proxima_acao: string
          proxima_data: string
          representada_id: string
          responsavel_user_id: string
          resultado: string
          status_cliente: string
          tipo_contato: string
          valor_venda: number
        }[]
      }
      salvar_visita_completa_v2: {
        Args: {
          p_cliente_id: string
          p_data: string
          p_destino_cliente_id: string
          p_frequencia: string
          p_hora_entrada: string
          p_hora_saida: string
          p_houve_venda: boolean
          p_id: string
          p_observacao: string
          p_odometro_chegada: number
          p_origem_cliente_id: string
          p_origem_venda: string
          p_proxima_acao: string
          p_proxima_data: string
          p_representadas: string[]
          p_responsavel_user_id: string
          p_resultado: string
          p_status_cliente: string
          p_tipo_contato: string
          p_titular_user_id: string
          p_valor_venda: number
        }
        Returns: {
          cliente_id: string
          cliente_nome: string
          data: string
          destino: string
          destino_cliente_id: string
          duracao_minutos: number
          frequencia: string
          hora_entrada: string
          hora_saida: string
          houve_venda: boolean
          id: string
          km_trecho: number
          observacao: string
          odometro_chegada: number
          origem: string
          origem_cliente_id: string
          origem_venda: string
          proxima_acao: string
          proxima_data: string
          representada_id: string
          responsavel_user_id: string
          resultado: string
          status_cliente: string
          tipo_contato: string
          valor_venda: number
        }[]
      }
      salvar_visita_multirepresentada: {
        Args: {
          p_cliente_id: string
          p_data: string
          p_id: string
          p_observacao: string
          p_odometro: string
          p_representadas: string[]
          p_responsavel_user_id: string
          p_resultado: string
          p_titular_user_id: string
        }
        Returns: {
          cliente_id: string
          cliente_nome: string
          data: string
          id: string
          observacao: string
          odometro: string
          representada_id: string
          responsavel_user_id: string
          resultado: string
        }[]
      }
      salvar_visita_venda_atomica: {
        Args: {
          p_cliente_id: string
          p_condicoes_prazo: string[]
          p_data: string
          p_destino_cliente_id: string
          p_formas_pagamento: string[]
          p_frequencia: string
          p_hora_entrada: string
          p_hora_saida: string
          p_houve_venda: boolean
          p_id: string
          p_itens: Json
          p_observacao: string
          p_odometro_chegada: number
          p_origem_cliente_id: string
          p_origem_venda: string
          p_proxima_acao: string
          p_proxima_data: string
          p_representadas: string[]
          p_responsavel_user_id: string
          p_resultado: string
          p_situacao: string
          p_status_cliente: string
          p_tipo_contato: string
          p_titular_user_id: string
          p_valor_venda: number
        }
        Returns: Json
      }
      sincronizar_agenda_visita: {
        Args: { p_visita_id: string }
        Returns: undefined
      }
      solicitar_vinculo_preposto: {
        Args: {
          p_email: string
          p_permissoes: Json
          p_representadas: string[]
          p_titular_user_id: string
        }
        Returns: {
          created_at: string
          email: string
          id: string
          nome: string
          permissoes: Json
          status: string
          titular_user_id: string
          updated_at: string
          user_id: string
          whatsapp: string
        }[]
      }
      tipo_agenda_por_proxima_acao: {
        Args: { p_acao: string }
        Returns: string
      }
      usuario_e_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
