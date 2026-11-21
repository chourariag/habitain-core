import { TIER1_ROLES } from "@/lib/roles";
import { RUNNING_BILL_ROLES } from "@/lib/running-bill";
import { workerAllocationProblems, type PresentWorker, type TaskWorker } from "@/lib/site-report-task-workers";
export const FACTORY_WRITE_ROLES = [...TIER1_ROLES, "super_admin", "factory_floor_supervisor", "senior_factory_supervisor", "production_head", "head_operations"] as const;
export const FACTORY_COST_ROLES = [...RUNNING_BILL_ROLES, "production_head", "head_operations"] as const;
export const FACTORY_READ_ROLES = [...FACTORY_WRITE_ROLES, ...RUNNING_BILL_ROLES] as const;
export const canWriteFactory = (role: string | null) => !!role && (FACTORY_WRITE_ROLES as readonly string[]).includes(role);
export const canViewFactoryCost = (role: string | null) => !!role && (FACTORY_COST_ROLES as readonly string[]).includes(role);
export const canReadFactory = (role: string | null) => canWriteFactory(role) || (!!role && (RUNNING_BILL_ROLES as readonly string[]).includes(role));
export const factoryToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export type FactoryModule = { id: string; project_id: string; name: string; module_code: string | null; project_name: string; current_stage: string | null; production_system: string | null; recent: boolean; last_logs: {stage_worked:string;stage_progress:number;log_date:string}[] };
export type FactoryBlock = {module_id:string;stage:string;stage_status:"ongoing"|"completed";progress_pct:number;remarks:string};
export type FactoryQuantity = {module_id:string;stage:string;boq_item_id:string;contractor_id:string|null;today_qty:number;unit:string|null;remarks?:string};
export type FactoryAllocation = {module_id:string;stage:string;worker_id:string;hours:number};
export type FactoryExpense = {module_id:string|null;kind:"consumable"|"expense";description:string;amount_inr:number};
export const factoryDraftPayload = <T extends {expenses:FactoryExpense[]}>(payload:T):T => ({...payload,expenses:payload.expenses.filter(e=>e.description.trim()||Number(e.amount_inr)>0)});
export type FactoryBOQ = {id:string;project_id:string;sno:number;item_description:string;unit:string|null;boq_qty:number;so_far:number};
export type FactoryReportData = {report:{id:string;status:string;notes:string|null;submitted_by:string|null}|null;modules:FactoryModule[];boq:FactoryBOQ[];blocks:FactoryBlock[];task_workers:FactoryAllocation[];quantities:FactoryQuantity[];expenses:FactoryExpense[];photos:{storage_path:string}[];present_workers:PresentWorker[];hours_unconfirmed:number;contractors:{contractor_id:string;name:string;project_id:string;boq_item_id:string|null}[]};
export const blockKey = (b: Pick<FactoryBlock,"module_id"|"stage">) => `${b.module_id}|${b.stage}`;
export const toChipRows = (rows:FactoryAllocation[]):TaskWorker[] => rows.map(r=>({task_id:blockKey(r),worker_id:r.worker_id,hours:r.hours}));
export const fromChipRows = (rows:TaskWorker[]):FactoryAllocation[] => rows.map(r=>{const [module_id,stage]=r.task_id.split("|"); return {module_id,stage,worker_id:r.worker_id,hours:r.hours};});
export function factoryBlockers(blocks:FactoryBlock[],notes:string,workers:PresentWorker[],allocations:FactoryAllocation[],unconfirmed:number) {
  return [...(!blocks.length && notes.trim().length<5 ? ["Enter at least one block or a note of five characters."] : []),...workerAllocationProblems(workers,toChipRows(allocations)),...(allocations.some(a=>a.hours<0.5)?["Worker hours must be at least 0.5."]:[]),...(unconfirmed>0?[`Confirm hours for ${unconfirmed} workers in Factory attendance.`]:[])];
}
export type FactoryCostModule = {module_id:string;project_id:string;module_code:string|null;name:string;value_earned:number;hours:number;labour_cost:number;consumables:number;expenses:number;subcontract_cost:number;total_cost:number;value_minus_cost:number};
export type FactoryCostData = {modules:FactoryCostModule[];boq:{module_id:string;boq_item_id:string;sno:number;item_description:string;unit:string;boq_rate:number;qty:number;value:number}[];stages:{module_id:string;stage:string;hours:number;labour_cost:number}[];workers:{module_id:string;stage:string;worker_id:string;worker:string;hours:number;cost:number}[];unallocated:{hours:number;cost:number};factory_level:{consumables:number;expenses:number};attendance_total:number};
export function factoryCostSheets(c:FactoryCostData):Record<string,(string|number)[][]> {return {
  Modules:[["Module","Name","Value earned at BOQ rate before cap","Labour","Consumables","Expenses","Subcontract","Total cost","Value minus cost"],...c.modules.map(m=>[m.module_code||"",m.name,m.value_earned,m.labour_cost,m.consumables,m.expenses,m.subcontract_cost,m.total_cost,m.value_minus_cost]),["Unallocated","",0,c.unallocated.cost||0,0,0,0,c.unallocated.cost||0,0],["Factory level","",0,0,c.factory_level.consumables,c.factory_level.expenses,0,c.factory_level.consumables+c.factory_level.expenses,0]],
  "BOQ items":[["Module","BOQ code","Description","Unit","Quantity","BOQ rate","Value"],...c.boq.map(b=>[b.module_id,b.sno,b.item_description,b.unit,b.qty,b.boq_rate,b.value])],
  Stages:[["Module","Stage","Hours","Labour cost"],...c.stages.map(s=>[s.module_id,s.stage,s.hours,s.labour_cost])],
  Workers:[["Module","Stage","Worker","Hours","Cost"],...c.workers.map(w=>[w.module_id,w.stage,w.worker,w.hours,w.cost])],
};}