# SCHED-2g — Active account role report (read-only)

Source: `profiles` (is_active) joined to `user_roles` on `user_roles.user_id = profiles.auth_user_id`. Generated 27/11/2026. No account was changed. The screen (get_user_role) uses `profiles.role`.

| Email | Name | user_roles | profiles.role | Differs |
|---|---|---|---|---|
| accounts@altree.in | Mary | finance_manager | finance_manager | no |
| accounts2@altree.in | Kavya | accounts_executive | accounts_executive | no |
| arun@surinauto.com | Arun Choudhari | chairman | chairman | no |
| costing@altree.in | Mohammed Sayeed | costing_engineer | costing_engineer | no |
| designblr2@altree.in | Vaishnavi N V | project_architect | project_architect | no |
| designblr3@altree.in | Venkat | head_operations | head_operations | no |
| designblr4@altree.in | Ribunzad | senior_architect | senior_architect | no |
| designblr5@altree.in | Aditi | project_architect | project_architect | no |
| designblr7@altree.in | Sanjana | senior_architect | senior_architect | no |
| gaurav@altree.in | Gaurav Chouraria | managing_director | managing_director | no |
| hr@altree.in | Aditya | hr_admin, hr_executive | hr_executive | YES |
| john@altree.in | John Kunnath | sales_director | sales_director | no |
| karan@altree.in | Karan Nadig | architecture_director, principal_architect | architecture_director | YES |
| maint@altree.in | Mohan | electrical_installer | electrical_installer | no |
| marketing@altree.in | Lekha | marketing | marketing | no |
| marketing2@altree.in | Vaibhav | super_admin | super_admin | no |
| opshead@altree.in | Stanley | head_of_projects | head_of_projects | no |
| planning@altree.in | Karthik | planning_engineer | planning_engineer | no |
| ppchead@altree.in | Suraj Rao | planning_head | planning_head | no |
| procurement@altree.in | Basavaraj | assistant_manager | assistant_manager | no |
| prod.dbr2@altree.in | Bala | logistics_manager | delivery_rm_lead | YES |
| prod.dbr3@altree.in | Azad Ali | production_head | production_head | no |
| prod.dbr4@altree.in | Nazim Raja | site_engineer | site_installation_mgr | YES |
| prod.dbr5@altree.in | Vincent | factory_supervisor, site_engineer | site_engineer | YES |
| prod.dbr6@altree.in | Rakesh | site_engineer | site_engineer | no |
| purchasedbr2@altree.in | Gangadhar | purchase_assistant | purchase_assistant | no |
| quality@altree.in | Tagore | qc_inspector | qc_inspector | no |
| salesblr@altree.in | George | sales_associate, sales_executive | sales_executive | YES |
| salesblr2@altree.in | Smaran | sales_executive | sales_executive | no |
| shiv@altree.in | Shiv Choudhari | finance_director | finance_director | no |
| storesdbr@altree.in | Sandeep | stores_executive | stores_executive | no |

**31 active accounts, 6 differ.**

