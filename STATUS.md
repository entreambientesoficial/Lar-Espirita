# STATUS do Projeto - Portal do Voluntário (Casa Espírita)

> **Importante para agentes futuros:** Este documento é a Fonte da Verdade do projeto. Leia-o antes de tentar analisar a estrutura do aplicativo para entender as limitações do BD e da arquitetura atual.

## 1. Visão Geral
*   **Nome do Projeto:** APP-CENTROESPIRITA (Portal do Voluntário)
*   **Casa:** Apometria Elos de Amor e Paz
*   **Tech Stack:** React 18 (Vite), Tailwind CSS v4, Supabase (Autenticação + Banco de Dados), React Router DOM v7, qrcode.react.
*   **Propósito:** Sistema web (PWA instalável) para controle de escala, presença, formação e comunicação de voluntários da casa.
*   **Deploy:** Cloudflare Pages — URL: `https://larbeneficienteeuripedesbarsanulfo.pages.dev`
*   **Ambiente local:** `npm run dev` na porta 5173 / 5175. Node.js >= 20 obrigatório.
*   **Build:** `npm run build` → pasta `dist/`. Code splitting: vendor-react, vendor-supabase, vendor-qrcode (html5-qrcode + qrcode.react).

## 2. Banco de Dados (Supabase)

O banco utiliza autenticação padrão do Supabase com trigger automática `handle_new_user()` que replica dados de `pre_cadastros` ao fazer OAuth com Google. Não é possível criar perfis com INSERT direto sem passar por essa trigger.

**RLS (Row Level Security) está ATIVO** em todas as tabelas.

### Função auxiliar de RLS (OBRIGATÓRIA):
```sql
-- Evita recursão infinita nas políticas que verificam role de admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$;
```
> Esta função **deve existir** no banco. Sem ela, as políticas de admin entram em recursão infinita e ninguém consegue carregar o próprio perfil.

### Trigger de novo usuário (OBRIGATÓRIA):
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, phone)
  SELECT
    new.id,
    COALESCE(pc.name, split_part(new.email, '@', 1)),
    new.email,
    COALESCE(pc.role, 'volunteer'),
    pc.phone
  FROM public.pre_cadastros pc
  WHERE lower(pc.email) = lower(new.email)
  LIMIT 1;
  RETURN new;
END;
$$;
```
> Usa `INSERT...SELECT` com `lower()` — se o e-mail não estiver em `pre_cadastros`, não insere nada (sem exceção). A política de INSERT em `profiles` deve ser `WITH CHECK (true)` para não bloquear esta trigger SECURITY DEFINER.

### Tabelas Atuais:

*   `profiles`: Perfis de usuários. Colunas: `id` (uuid), `name`, `email`, `role` (`admin` | `volunteer`), `phone`, `cursos`, `active` (BOOLEAN DEFAULT true).
*   `pre_cadastros`: E-mails pré-aprovados pela diretoria. Sem estar aqui, nenhum e-mail externo consegue fazer login.
*   `atividades`: Agenda da casa. Colunas: `id`, `name`, `time_range`, `start_time`, `end_time`, `description`, `day_of_week` (0=Dom, 1=Seg…6=Sáb), `event_date` (DATE NULL para extras), `active` (BOOLEAN), `icon`, `created_at`.
*   `presencas`: Confirmações e presenças dos voluntários. Colunas: `id`, `user_id` (FK→profiles), `atividade_id` (FK→atividades), `checkin_time` (default `now()`), `qr_checkin` (boolean, default `false`).
*   `atendimento_pessoas`: Pessoas da Fila de Atendimento Público. Colunas: `id`, `nome`, `telefone`, `tipo_atendimento`, `prioridade` (`Normal` | `Urgente`), `motivo_urgencia`, `observacoes`, `data_entrada`, `dias_disponiveis` (JSONB), `periodos_disponiveis` (JSONB), `datas_indisponiveis` (JSONB), `observacoes_disponibilidade` (TEXT), `status` (`aguardando`, `programado`, `compareceu`, `atendido`, `nao_compareceu`, `cancelado`), `posicao_fila`, `created_at`, `updated_at`.
*   `atendimento_programacoes`: Agendamento de pessoas em sessões específicas. Colunas: `id`, `pessoa_id`, `atividade_id`, `event_date`, `start_time`, `end_time`, `ordem_sessao`, `prioridade`, `status`, `observacoes`, `created_at`, `updated_at`.
*   `atendimento_capacidades`: Vagas máximas configuradas por sessão/atividade. Colunas: `id`, `atividade_id`, `quantidade_salas`, `atendimentos_por_sala`, `capacidade`, `active`, `created_at`, `updated_at`.
*   `atendimento_historico`: Log imutável de auditoria. Colunas: `id`, `pessoa_id`, `programacao_id`, `admin_id`, `action`, `dados_anteriores`, `dados_novos`, `observacao`, `created_at`.

> **Nota:** A tabela `escalas` foi planejada mas **nunca foi criada**. Não referenciar essa tabela em código ou RLS.

### Políticas RLS aplicadas (estado atual):

**profiles:**
- SELECT: `auth.uid() = id OR is_admin()`
- UPDATE: `auth.uid() = id OR is_admin()`
- INSERT: `WITH CHECK (true)` — necessário para a trigger SECURITY DEFINER funcionar

**presencas:**
- SELECT: `user_id = auth.uid() OR is_admin()`
- INSERT: `user_id = auth.uid()`
- UPDATE: `user_id = auth.uid()`
- DELETE: `user_id = auth.uid() AND qr_checkin = false`

**atendimento_* (todas as 4 tabelas):**
- SELECT, INSERT, UPDATE, DELETE: `is_admin()` (restrito 100% a administradores; voluntários não têm acesso)

### Scripts de dados:
*   `migration_agenda.sql` — adiciona colunas `active`, `event_date`, `start_time`, `end_time`, índices, constraints e popula a nova grade regular de Apometria (Ter/Qua/Qui).
*   `migration_fila_atendimento.sql` — cria as tabelas `atendimento_pessoas`, `atendimento_programacoes`, `atendimento_capacidades` e `atendimento_historico` com RLS restrito a `is_admin()`.
*   `migration_disponibilidade_reagendamento.sql` — adiciona colunas JSONB de disponibilidade do atendido e cria as RPCs `atendimento_reagendar()` e `atendimento_cadastrar_e_programar_urgente()` com recarga de cache PostgREST.
*   `migration_profiles_active.sql` — adiciona a coluna `active` em `public.profiles` para controle de status operacional do médium.

---
*Status atualizado por: Inteligência Artificial (Antigravity).*
*Fase atual: **V 1.9 — Módulo Fila de Atendimento refinado com agrupamento por Data e Sala (1, 2 e 3), dashboard de indicadores rápidos, menus dropdown de ações, modais transacionais de reagendamento/exclusão e gestão de Médiuns e Gestores com status Ativo/Inativo**.*

## 3. Fluxo de Presença (IMPORTANTE)

O fluxo correto é em **dois passos**:

1. **Confirmação na Agenda** — voluntário acessa a aba Agenda, vê as atividades do dia e clica "Confirmar Presença" na que vai trabalhar. Isso cria um registro em `presencas` com `qr_checkin = false`. A atividade aparece no Dashboard com badge "Confirmado" e botão "Cancelar Presença" (vermelho).

2. **Check-in físico (QR Code)** — no local da Casa, o voluntário escaneia o QR Code impresso (disponível para impressão na aba Admin → QR Code da Casa). O app valida o token, atualiza `qr_checkin = true` no registro existente. O botão "Cancelar Presença" some (presença já efetivada).

> **Regras:** Cancelar presença só é possível ANTES do QR check-in. Após o scan, a presença é permanente.

## 4. Páginas e Funcionalidades

### Acesso Geral (Voluntários)
*   **`BemVindo.jsx`**: Tela de Login via Google OAuth + e-mail/senha (restrito a e-mails em `pre_cadastros`). Título atualizado para "Apometria Elos de Amor e Paz". Logo centralizada (`logo-elos.jpg`) expandida de borda a borda com moldura de vidro fina de 2px e aura luminosa dupla em degradê pulsante. Fundo responsivo com a imagem espiritual `capa-apometria.jpg` em `bg-contain bg-center`. Textos e links auxiliares com micro-pílulas translúcidas escuras (`bg-slate-950/80 backdrop-blur-md`). Botão Google funcional.
*   **`Layout.jsx`**: Navbar inferior flutuante. Esconde abas de Admin para `role = volunteer`.
*   **`Dashboard.jsx` (Início)**: Exibe a atividade confirmada do voluntário para hoje (vazio se não confirmou). Reflexão do Dia dinâmica. Botão "Cancelar Presença" em vermelho (some após QR check-in). Onboarding de perfil (cursos/telefone) no primeiro acesso. Banner de instalação PWA (Android/Chrome).
*   **`Agenda.jsx`**: Agenda semanal (Seg–Sáb). Para o dia atual: botão "Confirmar Presença" funcional (insere em `presencas`) ou "Confirmado ✓ + Cancelar". Para outros dias: aviso "Confirmação disponível no dia".
*   **`Checkin.jsx`**: Scanner de QR Code. Valida o token `LBEB-PRESENCA-2026`. Se já confirmou pela Agenda, apenas marca `qr_checkin = true`. Se não confirmou, insere novo registro com `qr_checkin = true`. QR Code inválido exibe erro.
*   **`Messages.jsx` (Mural)**: Chat em tempo real via Supabase Realtime. Admins podem enviar "Comunicados Oficiais" (broadcast).

### Acesso Restrito (Administração)
*   **`Admin.jsx`**: Quatro abas:
    1. **Presenças Hoje**: Lista todos que confirmaram presença no dia (com ou sem QR check-in). Colunas: Médium, Atividade, Confirmou às, Check-in QR (Realizado/Pendente). Atualiza via Websocket em tempo real.
    2. **Médiuns e Gestores**: Formulário "Cadastrar Novo Médium" com botão **"Cadastrar"** (gera convite WhatsApp). Controle de Promover/Rebaixar admin, filtro por status operacional (Ativo/Inativo), resumo de cadastrados no topo e tradução de níveis de acesso (`Médium`, `Gestor`, `Administrador`).
    3. **Reflexão do Dia**: Live preview. Altera frase e imagem espiritual em tempo real.
    4. **QR Code da Casa**: Exibe e permite imprimir o QR Code oficial da Casa com o título "Apometria Elos de Amor e Paz".

## 5. PWA (Progressive Web App)

O app é instalável como PWA em dispositivos móveis.

*   **`public/manifest.json`**: Manifesto configurado com o nome "Portal do Voluntário - Apometria Elos de Amor e Paz", ícones `logo-elos.jpg`, `display: standalone`, `theme_color: #1a237e`.
*   **`public/sw.js`**: Service Worker — habilita instalação PWA.
*   **`index.html`**: Título "Portal do Voluntário - Apometria Elos de Amor e Paz", favicon e ícone Apple apontando para `/img-apoio/logo-elos.jpg`.
*   **`src/main.jsx`**: Registra o service worker apenas em produção (`import.meta.env.PROD`). Em modo dev (`localhost`), desregistra ativamente qualquer ServiceWorker antigo para evitar cache estático indesejado.
*   **Banner de instalação (Dashboard)**: Captura o evento `beforeinstallprompt` e exibe banner com botão "Instalar" ao usuário. Funciona em Android (Chrome/Edge). No iOS (Safari) o usuário deve usar "Compartilhar → Adicionar à Tela de Início" manualmente.

## 6. Como Manusear o Código
*   **Design Pattern:** Single-File-Components por rota.
*   **Segurança de Sessão:** Proteção global no `<Layout>` (redireciona se sessão expirar). `<ProtectedRoute>` verifica `role === 'admin'`.
*   **RLS:** Camada server-side no Supabase. A função `is_admin()` (SECURITY DEFINER) é usada nas políticas para evitar recursão.
*   **Token QR:** Definido em `src/lib/checkinToken.js`. Compartilhado entre `Checkin.jsx` (validação) e `Admin.jsx` (geração do QR Code).
*   **ErrorBoundary:** Implementado em `main.jsx`. Crashes exibem tela amigável com botão de recarregar.
*   **Aparência:** Glassmorphism sutil, fontes `Plus Jakarta Sans` / `Manrope` via Google Fonts, ícones Material Symbols Outlined.
*   **Imagens estáticas:** Devem estar em `public/img-apoio/`. Arquivos fora de `public/` não são servidos pelo Vite.

## 7. Configuração de Deploy (Cloudflare Pages)

| Configuração | Valor |
|---|---|
| Build command | `npm run build` |
| Build output | `dist` |
| Node.js version | **20** (`.nvmrc` e `NODE_VERSION=20` nas env vars) |
| Env var 1 | `VITE_SUPABASE_URL` |
| Env var 2 | `VITE_SUPABASE_ANON_KEY` |

**Supabase → Authentication → URL Configuration:**
*   **Site URL:** `https://larbeneficienteeuripedesbarsanulfo.pages.dev`
*   **Redirect URLs:** `https://larbeneficienteeuripedesbarsanulfo.pages.dev/dashboard` e `http://localhost:5173/dashboard`

> `package-lock.json` está no `.gitignore` — gerado localmente no Windows causa falha de build no Linux (Cloudflare). Nunca commitar o lock file.

## 8. Roadmap — Módulo Lanchonete (planejado)

Módulo a ser desenvolvido futuramente para a equipe da lanchonete da Casa. Acesso restrito por role dedicado (`lanchonete`), visível apenas para usuários com essa role e admins.

### Funcionalidades previstas (por prioridade):

1. **Cardápio/Produtos** — Cadastro de itens com nome e preço.
2. **Registro de Vendas** — Tela operacional (uso diário da responsável): seleciona produtos, define quantidade, registra venda. Funciona como um "carrinho" que vai acumulando durante o turno.
3. **Fechamento de Caixa** — Resumo do dia: total vendido, lista de vendas, valor esperado em caixa. Acessível também pelo Admin.
4. **Estoque** *(V2)* — Controle de quantidade disponível por item, alerta de estoque baixo.
5. **Relatórios** *(V2)* — Vendas por período, produto mais vendido.

---

## 9. Detalhamento de Implementação da Fila de Atendimento (V1.8 & V1.9)

### Funcionalidades do Módulo Fila de Atendimento
- **Previsão Dinâmica Baseada em Sessões Reais**: Cálculo em tempo real da estimativa de atendimento considerando a quantidade de salas ativas e atendimentos por sala.
- **Cálculo Automático da Data Prevista**: Mapeamento inteligente de dias da semana (Terça, Quarta e Quinta) para calcular as próximas datas disponíveis.
- **Exclusão do Mesmo Dia na Previsão Automática**: Se a consulta/cálculo de previsão for executado no mesmo dia da sessão, o algoritmo ignora o próprio dia e projeta automaticamente para as datas/semanas subsequentes.
- **Disponibilidade Opcional do Atendido**: Suporte a dados detalhados de restrição da pessoa (`p_dias_disponiveis`, `p_periodos_disponiveis`, `p_datas_indisponiveis`, `p_observacoes_disponibilidade`), exibidos em accordion recolhível nos modais.
- **Reagendamento Completo e RPC Transacional**:
  - RPC SQL `public.atendimento_reagendar()` transacional e segura.
  - Marca o agendamento anterior como `cancelado` com observação de auditoria, cria o novo agendamento com status `programado` e recalcula a fila em uma única transação atômica.
  - Rollback automático em caso de falha de validação ou restrição de capacidade.
- **Reorganização Automática da Fila**: Ao cancelar, agendar ou atender uma pessoa, o sistema recalcula imediatamente os `posicao_fila` restantes sem lacunas.
- **Histórico Administrativo e Auditoria**:
  - Tabela `atendimento_historico` como fonte única da verdade para auditoria.
  - Registro de previsões calculadas e ações realizadas com nomes de administradores e timestamptz.
- **Melhorias de Vocabulário & UX**:
  - Substituição padronizada de "Paciente" por "Pessoa".
  - Distinção entre "Novo Atendimento" (para a fila de espera) e "Programação Imediata / Encaixe Urgente".
- **Refinamento de Modais Operacionais**:
  - Modais "Programar Atendimento" e "Reagendar Atendimento" com reordenação de campos (1º Data do Atendimento, 2º Atendimento / Sessão).
  - O campo de sessão inicia desabilitado com a mensagem *"Selecione primeiro a data"* e é filtrado estritamente pelas sessões válidas do dia da semana local selecionado (`day_of_week` ou `event_date`).
  - Limpeza automática do valor da sessão selecionada caso a data seja alterada.
  - Desduplicação estrita de opções nos selects de sessão.
  - Rodapé fixo em dispositivos móveis respeitando safe-area, impedindo que a barra de navegação inferior cubra os botões de ação.
- **Visualização Operacional Limpa**:
  - Registros `cancelados` gerados por reagendamento ou cancelamento manual são ocultados por padrão da lista operacional diária "Todos os Atendimentos Programados", permanecendo 100% intactos no Banco de Dados e na aba "Histórico".
  - Indicação visual discreta em tom âmbar abaixo da data para agendamentos oriundos de reagendamento: `🔄 Reagendado de DD/MM/AAAA para DD/MM/AAAA`.
- **Agrupamento por Data e Identificação por Sala**:
  - Agrupamento visual das programações por Data e Trabalho.
  - Identificação de salas padronizada em badges pequenas: `Sala 1`, `Sala 2`, `Sala 3`.
  - Exibição de cabeçalho único do trabalho ("Apometria") por bloco para eliminar repetição.
- **Dashboard Operacional e Indicadores Rápidos**:
  - Painel superior com 4 cards de acesso rápido: *Pessoas na fila*, *Atendimentos programados*, *Atendimentos de hoje*, *Urgências pendentes*.
  - Barra de métricas secundárias: *Última atualização (HH:mm:ss)*, *Total da semana (54 vagas)* e *Taxa de ocupação (%)*.
  - Barra de progresso visual de ocupação por sessão (ex: `6 de 9 vagas ocupadas` | `[██████░░░]`).
- **Configuração de Vagas Recolhida**:
  - Accordion recolhido por padrão: `⚙ Configuração de vagas` | `6 sessões • 54 vagas semanais`.
- **Menu de Ações por Dropdown `[•••]`**:
  - Botão secundário `[•••]` em todas as tabelas e cards para ações de *Compareceu*, *Atendimento Realizado*, *Reagendar*, *Tornar Urgente*, *Retornar à Fila* e *Excluir da Fila*.
- **Modal Próprio de Exclusão da Fila**:
  - Eliminação completa de `window.confirm()` nativo.
  - Modal customizado com backdrop, card branco, ícone de alerta, botão neutro "Cancelar" e botão vermelho "Excluir da Fila" com feedback `Excluindo...`.

## 10. Atualizações na Administração de Médiuns e Gestores

- **Tradução Visual de Níveis de Acesso**:
  - Mapeamento centralizado de exibição `ROLE_LABELS`: `volunteer` → **Médium**, `admin` → **Administrador**, `manager` → **Gestor**, `lanchonete` → **Lanchonete**.
  - Mantidos os valores internos em inglês no banco de dados Supabase e em regras de RLS/autenticação.
- **Status Operacional Ativo / Inativo**:
  - Adicionada a coluna `active BOOLEAN NOT NULL DEFAULT true` na tabela `public.profiles` (`migration_profiles_active.sql`).
  - Permite indicar quais voluntários estão atualmente em atividade operacional na Casa Espírita sem apagar o cadastro ou bloquear seu login/acesso ao aplicativo.
  - Resumo no topo da aba: `50 cadastrados • 20 ativos • 30 inativos`.
  - Filtros rápidos por status (*Todos*, *Ativos*, *Inativos*) e por nível de acesso (*Médiuns*, *Gestores*, *Administradores*).
  - Modal interno de confirmação para alteração do status operacional restrito a administradores.

## 11. Decisões de Arquitetura e Projeto

1. **Separação entre Status Operacional e Acesso ao Sistema**: O campo `active` em `profiles` representa unicamente se o médium está trabalhando ativamente na Casa no momento. Ele nunca impede o login do usuário nem altera suas permissões de autenticação.
2. **Imutabilidade do Histórico**: Transações de reagendamento ou cancelamento criam/atualizam registros e registram a movimentação no histórico imutável (`atendimento_historico`), garantindo auditoria completa sem perda de dados.
3. **Limpeza da Lista Operacional**: Registros cancelados não pertencem à operação diária de recepção e triagem. Portanto, são ocultados da lista "Todos os Atendimentos Programados", permanecendo acessíveis unicamente no Histórico.
4. **Encaixe Urgente Fora da Fila de Espera**: Quando um atendimento urgente é cadastrado com programação imediata, ele é inserido diretamente na tabela de programações ativas sem transitar pela fila de espera regular.
5. **Cálculo Consistente de Previsão de Atendimento**: A previsão sempre considera sessões futuras oficiais da grade regular e calcula o tempo de espera aproximado com base na velocidade média de vazão das salas.
6. **Disponibilidade Opcional do Atendido**: O fornecimento de restrições de horários e dias pelo atendido é 100% opcional, garantindo fluxo rápido no cadastro presencial.
7. **Design de Baixo Ruído Visual**: A interface prioriza paleta sutil baseada em azul institucional, cores em badges para estados (`Ativo` verde, `Inativo` cinza, `Urgente` laranja), menus dropdown `[•••]` para ações secundárias e accordions para configurações acessadas com pouca frequência.

## 12. Estado Atual do Módulo "Fila de Atendimento"

### Funcionalidades Concluídas
- [x] Cadastro de Pessoas na Fila de Espera com prioridade Normal/Urgente e restrições opcionais.
- [x] Cálculo e exibição da Previsão Estimada em tempo real.
- [x] Modal de Programar Atendimento com seleção filtrada por dia da semana da data escolhida.
- [x] Modal de Reagendar Atendimento com transação atômica RPC no Supabase.
- [x] Cadastro Urgente com Programação Imediata.
- [x] Painel Dashboard Operacional com KPIs e ocupação de vagas.
- [x] Visualização em Lista agrupada por Data e identificação por Sala 1, Sala 2 e Sala 3.
- [x] Modal de confirmação próprio para Exclusão da Fila (sem `window.confirm()`).
- [x] Módulo "Médiuns e Gestores" com status Ativo/Inativo e tradução de níveis de acesso.

### Funcionalidades em Validação
- [ ] Validação presencial pelos administradores da Casa durante os atendimentos públicos de Terça, Quarta e Quinta-feira.

### Pendências Conhecidas / Melhorias Futuras
- [ ] **Formulário Público por Link (Pré-solicitação)**: Link gerado para Instagram/WhatsApp onde a pessoa solicita atendimento público sem login. Entra como `aguardando_analise` em uma fila prévia de triagem para revisão administrativa antes de ser promovido à Fila de Espera regular.
- [ ] Módulo Lanchonete (previsto para V2.0).
- [ ] Relatórios analíticos de frequência e fluxo de atendimento acumulado por mês.
