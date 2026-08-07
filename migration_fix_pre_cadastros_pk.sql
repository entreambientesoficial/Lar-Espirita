-- MIGRATION: Corrigir Chave Primária e Políticas de Exclusão da Tabela public.pre_cadastros

-- 1. Definir email como PRIMARY KEY em public.pre_cadastros (necessário para o PostgREST/Supabase permitir DELETE)
DO $$
BEGIN
  -- Remove constraint antiga se existir com outro nome
  ALTER TABLE public.pre_cadastros DROP CONSTRAINT IF EXISTS pre_cadastros_pkey;
  
  -- Adiciona PRIMARY KEY no campo email
  ALTER TABLE public.pre_cadastros ADD CONSTRAINT pre_cadastros_pkey PRIMARY KEY (email);
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Constraint já ajustada ou erro: %', SQLERRM;
END $$;

-- 2. Garantir RLS em pre_cadastros
ALTER TABLE public.pre_cadastros ENABLE ROW LEVEL SECURITY;

-- 3. Política de SELECT para Admins e Authenticated
DROP POLICY IF EXISTS "Admins podem ver pre_cadastros" ON public.pre_cadastros;
CREATE POLICY "Admins podem ver pre_cadastros" 
  ON public.pre_cadastros FOR SELECT 
  TO authenticated 
  USING (true);

-- 4. Política de INSERT para Admins
DROP POLICY IF EXISTS "Admins podem inserir pre_cadastros" ON public.pre_cadastros;
CREATE POLICY "Admins podem inserir pre_cadastros" 
  ON public.pre_cadastros FOR INSERT 
  TO authenticated 
  WITH CHECK (is_admin());

-- 5. Política de DELETE para Admins (OBRIGATÓRIO para o botão Excluir Convite funcionar)
DROP POLICY IF EXISTS "Admins podem deletar pre_cadastros" ON public.pre_cadastros;
CREATE POLICY "Admins podem deletar pre_cadastros" 
  ON public.pre_cadastros FOR DELETE 
  TO authenticated 
  USING (is_admin());
