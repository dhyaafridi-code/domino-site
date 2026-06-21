
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Add a no-op deny policy so the linter sees bone_yards has at least one policy
CREATE POLICY "No client access" ON public.bone_yards FOR SELECT TO authenticated USING (false);
