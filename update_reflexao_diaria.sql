-- ============================================================
-- Migration Idempotente: Atualizar Frase e Imagem da Reflexão do Dia
-- Projeto: Portal do Voluntário - Apometria Elos de Amor e Paz
-- Executar no Supabase SQL Editor
-- ============================================================

BEGIN;

-- 1. Criar a tabela se ela ainda não existir
CREATE TABLE IF NOT EXISTS public.reflexao_diaria (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  quote TEXT NOT NULL,
  author TEXT NULL,
  image_url TEXT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Garantir que as colunas existam mesmo se a tabela já existia antes
ALTER TABLE public.reflexao_diaria ADD COLUMN IF NOT EXISTS author TEXT NULL;
ALTER TABLE public.reflexao_diaria ADD COLUMN IF NOT EXISTS image_url TEXT NULL;
ALTER TABLE public.reflexao_diaria ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3. Inserir ou atualizar a frase e imagem
INSERT INTO public.reflexao_diaria (id, quote, author, image_url)
VALUES (
  1,
  'O mundo exterior é o espelho exato do seu estado de espírito. Quando você desacelera e limpa as energias densas, a sua verdadeira Natureza Divina — que é saudável, pacífica e intocável — se manifesta. Você não é o cansaço que sente hoje; você é a luz que habita atrás dele. Sintonize-se com a harmonia e desfaça os nós do passado.',
  'Apometria - Elos de Amor e Paz',
  'https://lh3.googleusercontent.com/d/1PGTrJdif0iX3-YEGzLzssxIs__o_LQk8'
)
ON CONFLICT (id) DO UPDATE
SET quote = EXCLUDED.quote,
    author = EXCLUDED.author,
    image_url = EXCLUDED.image_url,
    updated_at = now();

NOTIFY pgrst, 'reload schema';

COMMIT;
