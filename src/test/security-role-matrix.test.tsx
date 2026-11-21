import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { DailySiteReport } from "@/components/site/DailySiteReport";
import { canViewRunningBill } from "@/lib/running-bill";
import { quantityPayload, rowProblem, type SubRate } from "@/lib/site-report-subcontract";

const state=vi.hoisted(()=>({role:"site_engineer",rpc:vi.fn()}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{rpc:state.rpc}}));
vi.mock("@/hooks/useUserRole",()=>({useUserRole:()=>({role:state.role,loading:false})}));
vi.mock("@/components/AuthProvider",()=>({useAuth:()=>({signOut:vi.fn()})}));
vi.mock("@/hooks/usePendingApprovalsCount",()=>({usePendingApprovalsCount:()=>0}));
vi.mock("@/contexts/ProjectContext",()=>({useProjectContext:()=>({projects:[],selectedProjectId:null,setSelectedProjectId:vi.fn()})}));
vi.mock("@/hooks/useFeatureFlags",()=>({useFeatureFlags:()=>({isEnabled:()=>true})}));
vi.mock("@/components/RoleSwitcher",()=>({RoleSwitcher:()=>null}));
vi.mock("react-i18next",()=>({useTranslation:()=>({t:(s:string)=>s,i18n:{language:"en",changeLanguage:vi.fn()}})}));

const roles=[
 ["site_engineer",false],["site_installation_mgr",false],["factory_floor_supervisor",false],
 ["finance_manager",true],["head_of_projects",true],["planning_head",true],
 ["quantity_surveyor",true],["costing_engineer",true],["managing_director",true],
 ["finance_director",true],["sales_director",true],["architecture_director",true],["super_admin",true],["planning_engineer",false],
] as const;
const rateMetadata:SubRate={contractor_id:"contractor",boq_item_id:"boq",work_description:null,unit:"cum",rate_type:"lump_sum",package_qty:100,used_qty:25};
const base={can_write:true,today:"2026-11-21",report:{id:"report",status:"draft",notes:"Existing notes",site_clean:false},tasks:[{id:"task",code:"T1",name:"Concrete task",pct:20,planned_start:"2026-11-01",planned_finish:"2026-11-30",actual_start:null}],boq:[{id:"boq",task_id:"task",description:"Concrete",unit:"cum",boq_qty:100,cumulative:25,progress_weight:.01}],progress:[],labour:[],quantities:[{id:"q",boq_item_id:"boq",contractor_id:"contractor",today_qty:5}],photos:[],elevations:[],can_manage_elevations:false,attendance:{workers:0,hours:0},present_workers:[],task_workers:[],expenses:[],contractors:[{id:"contractor",name:"Subcontractor"}],rates:[rateMetadata],headcount:[]};
beforeEach(()=>{vi.stubGlobal("ResizeObserver",class{observe(){} disconnect(){}});state.rpc.mockReset();});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe.each(roles)("security matrix: %s",(role,commercial)=>{
 it("renders the unchanged module menu without reading another role's feature records",()=>{
  state.role=role;
  render(<MemoryRouter><AppSidebar/></MemoryRouter>);
  const links=screen.getAllByRole("link").map(n=>n.getAttribute("href"));
  expect(links).toContain("/dashboard");
  expect(links).toContain("/attendance");
  expect(state.rpc).not.toHaveBeenCalled();
 });
 it("retains Running Bill permission",()=>expect(canViewRunningBill(role)).toBe(commercial));
 it("loads project quantities and preserves package validation without site monetary data",async()=>{
  state.role=role;
  const rates=commercial?[{...rateMetadata,id:"rate",effective_rate:456.78,lump_sum_inr:45678}]:[rateMetadata];
  const canWrite=["site_engineer","site_installation_mgr","head_of_projects","planning_head","managing_director","finance_director","sales_director","architecture_director","super_admin"].includes(role);
  state.rpc.mockResolvedValue({data:{...base,can_write:canWrite,can_see_rates:commercial,rates},error:null});
  render(<MemoryRouter><DailySiteReport projectId="project"/></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button",{name:/Concrete task/}));
  expect((screen.getByLabelText("Quantity today") as HTMLInputElement).value).toBe("5");
  const row={key:"q",boq_item_id:"boq",contractor_id:"contractor",extra_work_description:"",unit:"cum",today_qty:"5"};
  expect(rowProblem(row,rates)).toBeNull();
  expect(quantityPayload([row],rates)[0].today_qty).toBe(5);
  expect(rowProblem({...row,today_qty:"76"},rates)).toBe("This would take the lump-sum package past its total.");
  const amountVisible=screen.queryByText(/₹2,283\.9/)!==null;
  expect(amountVisible).toBe(commercial);
 });
});
it("Other work still obtains its unit from rate metadata without a rate reference",async()=>{
 state.role="site_engineer";
 state.rpc.mockResolvedValue({data:{...base,quantities:[{id:"other",boq_item_id:null,contractor_id:"contractor",today_qty:5,extra_work_description:"Cleaning",unit:"trip"}],rates:[{...rateMetadata,boq_item_id:null,work_description:"Cleaning",unit:"trip"}],can_see_rates:false},error:null});
 render(<MemoryRouter><DailySiteReport projectId="project"/></MemoryRouter>);
 const choice=await screen.findByLabelText("Work");
 expect((choice as HTMLSelectElement).value).toBe("Cleaning");
 fireEvent.change(choice,{target:{value:"Cleaning"}});
 expect(rowProblem({boq_item_id:null,contractor_id:"contractor",extra_work_description:"Cleaning",key:"other",unit:"trip",today_qty:"5"},[{...rateMetadata,boq_item_id:null,work_description:"Cleaning"}])).toBeNull();
});
