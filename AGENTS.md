# Project Engineering Rules

- Keep feature-flag reads centralized and enforce the same flag in navigation and route guards so disabled modules cannot be opened by URL.
- Multi-table project setup imports use one authenticated database RPC transaction so validation, upserts, and audit rows commit or roll back together.
- Contract-labour attendance and master changes use dedicated role- and project-checked database functions, keeping employee GPS attendance and payroll data outside the module.
- Daily site reports reuse daily_measurements (trade='daily_site_report') and write only through role- and project-checked SECURITY DEFINER RPCs, so existing measurement RLS stays untouched; construction tasks are marked by project_tasks.work_category because task_type is an existing enum.
- Daily-report elevation photos use kind='elevation' + elevation_id via add_site_report_elevation_photo; legacy fixed kinds stay valid for old rows, and project_elevations changes go only through role-checked RPCs with their own log table.
- Daily Report quantities use site_report_quantities through checked RPCs; measurement_line_items keeps its legacy boq_items foreign key so legacy sheets remain compatible.
