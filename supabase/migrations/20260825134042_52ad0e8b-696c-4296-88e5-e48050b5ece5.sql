ALTER FUNCTION public.user_has_projects_module_access(uuid) SECURITY INVOKER;
ALTER FUNCTION public.user_is_project_participant(uuid, uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_project_chat_participants(uuid) SECURITY INVOKER;