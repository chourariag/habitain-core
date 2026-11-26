UPDATE public.schedule_library_tasks SET responsible_role='factory_supervisor' WHERE responsible_role='factory_floor_supervisor';
UPDATE public.project_tasks t SET responsible_role='factory_supervisor'
FROM public.schedule_library_tasks lt
WHERE t.library_task_id=lt.id AND t.responsible_role='factory_floor_supervisor' AND lt.responsible_role='factory_supervisor'
  AND NOT EXISTS (SELECT 1 FROM public.schedule_baselines b WHERE b.project_id=t.project_id);