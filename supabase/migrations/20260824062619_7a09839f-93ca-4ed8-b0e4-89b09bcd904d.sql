-- Fix smr_insert_supervisor RLS policy to include production_head
-- Matches client-side canCreate in SpecialMaterialRequests.tsx and existing SELECT/UPDATE policies
ALTER POLICY "smr_insert_supervisor" ON public.special_material_requests
  WITH CHECK (
    created_by = auth.uid()
    AND public.user_has_any_role(auth.uid(), ARRAY[
      'factory_floor_supervisor','production_head','super_admin','managing_director'
    ]::app_role[])
  );