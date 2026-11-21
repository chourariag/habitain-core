import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskWorkerChips } from "@/components/site/TaskWorkerChips";
afterEach(cleanup);
const workers = [{worker_id:"w1",name:"Worker one",skill_type:"mason",contractor_name:"First contractor",attendance_hours:8},{worker_id:"w2",name:"Worker two",skill_type:"helper",contractor_name:"Second contractor",attendance_hours:8}];
describe("task worker chip actions", () => {
  it("a worker tap allocates only remaining attendance hours", () => {
    const onChange=vi.fn(); render(<TaskWorkerChips taskId="b" workers={workers} rows={[{task_id:"a",worker_id:"w1",hours:5}]} readOnly={false} onChange={onChange}/>);
    fireEvent.click(screen.getByRole("button",{name:"Worker one · 3 h"}));
    expect(onChange).toHaveBeenCalledWith([{task_id:"a",worker_id:"w1",hours:5},{task_id:"b",worker_id:"w1",hours:3}]);
  });
  it("select all skips fully allocated workers", () => {
    const onChange=vi.fn(); render(<TaskWorkerChips taskId="b" workers={workers} rows={[{task_id:"a",worker_id:"w1",hours:8}]} readOnly={false} onChange={onChange}/>);
    fireEvent.click(screen.getByRole("button",{name:"Select all present"}));
    expect(onChange).toHaveBeenCalledWith([{task_id:"a",worker_id:"w1",hours:8},{task_id:"b",worker_id:"w2",hours:8}]);
  });
  it("a selected worker can be removed without clearing another task", () => {
    const onChange=vi.fn();render(<TaskWorkerChips taskId="b" workers={workers} rows={[{task_id:"a",worker_id:"w1",hours:5},{task_id:"b",worker_id:"w1",hours:3}]} readOnly={false} onChange={onChange}/>);
    fireEvent.click(screen.getByRole("button",{name:"Worker one · 3 h"}));
    expect(onChange).toHaveBeenCalledWith([{task_id:"a",worker_id:"w1",hours:5}]);
  });
});