import { afterEach,describe,expect,it,vi } from "vitest";
import { cleanup,render,waitFor } from "@testing-library/react";
import { FactoryCostCard } from "@/components/production/FactoryCostCard";
const mock=vi.hoisted(()=>({rpc:vi.fn(async()=>({data:{modules:[],boq:[],stages:[],workers:[],unallocated:{hours:0,cost:0},factory_level:{consumables:0,expenses:0},attendance_total:0},error:null}))}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{rpc:mock.rpc}}));
afterEach(()=>{cleanup();mock.rpc.mockClear();});
describe("Factory cost disclosure",()=>{
 for(const role of ["factory_floor_supervisor","senior_factory_supervisor","site_engineer","site_installation_mgr","chairman"]){it(`${role} receives no monetary screen or cost request`,()=>{const {container}=render(<FactoryCostCard role={role}/>);expect(mock.rpc).not.toHaveBeenCalled();expect(container.textContent).toBe("");});}
 for(const role of ["production_head","head_operations","managing_director","finance_director","sales_director","architecture_director","super_admin","finance_manager","head_of_projects","planning_head","quantity_surveyor","costing_engineer"]){it(`${role} can request the checked cost statement`,async()=>{render(<FactoryCostCard role={role}/>);await waitFor(()=>expect(mock.rpc).toHaveBeenCalled());});}
});