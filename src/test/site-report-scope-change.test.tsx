import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { DailySiteReport } from "@/components/site/DailySiteReport";
const calls = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: calls.rpc } }));
const data = {can_write:true,today:"2026-11-21",report:{id:"report",status:"draft",notes:"Original",site_clean:false},tasks:[],boq:[],progress:[],labour:[],quantities:[],photos:[],elevations:[],can_manage_elevations:false,attendance:{workers:0,hours:0},present_workers:[],task_workers:[],expenses:[]};
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-21T08:00:00Z"));
  vi.stubGlobal("ResizeObserver",class {observe(){} disconnect(){}});
  calls.rpc.mockReset().mockImplementation(async () => ({data,error:null}));
});
afterEach(() => {cleanup();vi.unstubAllGlobals();vi.useRealTimers();});
describe("Daily Report scope transitions", () => {
  it("quantity edits switch Completed back to Ongoing and Completed still forces 100", async () => {
    calls.rpc.mockResolvedValue({data:{...data,
      tasks:[{id:"task",code:"T1",name:"Concrete task",pct:50,planned_start:"2026-11-01",planned_finish:"2026-11-30",actual_start:null}],
      boq:[{id:"boq",task_id:"task",description:"Concrete",unit:"cum",boq_qty:12,cumulative:0,progress_weight:1/12}],
      progress:[{task_id:"task",pct:50,task_status:"ongoing"}],
      quantities:[{id:"q",boq_item_id:"boq",contractor_id:null,today_qty:6}],
    },error:null});
    render(<MemoryRouter><DailySiteReport projectId="A"/></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button",{name:/Concrete task/}));
    fireEvent.change(screen.getByLabelText("Quantity today"),{target:{value:"12"}});
    expect(screen.getByRole("button",{name:/Concrete task/}).textContent).toContain("Completed");
    fireEvent.change(screen.getByLabelText("Quantity today"),{target:{value:"11"}});
    expect(screen.getByRole("button",{name:/Concrete task/}).textContent).toContain("Ongoing");
    fireEvent.click(screen.getByRole("button",{name:/^Completed$/}));
    expect(screen.getByRole("button",{name:/Concrete task/}).textContent).toContain("100%");
    fireEvent.change(screen.getByLabelText("Quantity today"),{target:{value:"6"}});
    expect(screen.getByRole("button",{name:/Concrete task/}).textContent).toContain("50%");
    expect(screen.getByRole("button",{name:/Concrete task/}).textContent).toContain("Ongoing");
  });
  it.each(["date","project"])("awaits current autosave before loading a changed %s", async mode => {
    const events: string[] = [];
    let complete: (() => void) | undefined;
    calls.rpc.mockImplementation((name,args) => {
      if(name==="save_site_report_draft") {
        events.push(`save:${args.p_project_id}:${args.p_date}:${args.p_payload.notes}`);
        return new Promise(resolve => {complete=()=>resolve({data:"report",error:null});});
      }
      events.push(`load:${args.p_project_id}:${args.p_date}`);
      return Promise.resolve({data,error:null});
    });
    const renderReport = (projectId:string) => <MemoryRouter><DailySiteReport projectId={projectId}/></MemoryRouter>;
    const view=render(renderReport("A"));
    await screen.findByPlaceholderText("If no work happened today, say why");
    const date=(screen.getByLabelText("Report date") as HTMLSelectElement).value;
    events.length=0;
    fireEvent.change(screen.getByPlaceholderText("If no work happened today, say why"),{target:{value:"Pending edit"}});
    if(mode==="date") fireEvent.change(screen.getByLabelText("Report date"),{target:{value:date==="2026-11-21"?"2026-11-20":"2026-11-21"}});
    else view.rerender(renderReport("B"));
    await waitFor(()=>expect(events).toEqual([`save:A:${date}:Pending edit`]));
    complete?.();
    await waitFor(()=>expect(events).toHaveLength(2));
    expect(events[1]).toBe(mode==="date"?`load:A:${date==="2026-11-21"?"2026-11-20":"2026-11-21"}`:`load:B:${date}`);
  });
});