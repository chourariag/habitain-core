# Project Engineering Rules

- Keep feature-flag reads centralized and enforce the same flag in navigation and route guards so disabled modules cannot be opened by URL.
- Multi-table project setup imports use one authenticated database RPC transaction so validation, upserts, and audit rows commit or roll back together.
- Contract-labour attendance and master changes use dedicated role- and project-checked database functions, keeping employee GPS attendance and payroll data outside the module.
