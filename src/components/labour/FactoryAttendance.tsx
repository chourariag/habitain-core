import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ToolboxCamera, type CapturedPhoto } from "@/components/labour/ToolboxCamera";
import { canWriteFactory, factoryToday } from "@/lib/factory-report";
import { parseLabourDateInput } from "@/lib/labour-rules";
type Worker={worker_id:string;name:string;skill_type:string;contractor_name:string|null;worker_code:string};
type Day={standard_hours:number;workers:Worker[];attendance:{worker_id:string;hours:number;hours_confirmed:boolean;no_photo_exception:boolean}[];photos:{id:string;storage_path:string;captured_at:string;url?:string}[]};
export function FactoryAttendance({role}:{role:string|null}) {
 const [date,setDate]=useState(factoryToday()),[dateText,setDateText]=useState(format(parseISO(factoryToday()),"dd/MM/yyyy"));
 const [data,setData]=useState<Day|null>(null),[present,setPresent]=useState<Record<string,boolean>>({}),[hours,setHours]=useState<Record<string,number>>({}),[reason,setReason]=useState(""),[search,setSearch]=useState(""),[busy,setBusy]=useState(false);
 const editable=canWriteFactory(role);
 const load=useCallback(async()=>{const {data:d,error}=await supabase.rpc("get_factory_attendance",{p_date:date});if(error){toast.error(error.message);return;}const v=d as unknown as Day;v.photos=await Promise.all(v.photos.map(async p=>{const{data:u}=await supabase.storage.from("attendance-photos").createSignedUrl(p.storage_path,3600);return {...p,url:u?.signedUrl};}));setData(v);setPresent(Object.fromEntries(v.attendance.map(a=>[a.worker_id,a.hours>0])));setHours(Object.fromEntries(v.attendance.map(a=>[a.worker_id,a.hours])));},[date]);
 useEffect(()=>{void load();},[load]);
 const capture=async(p:CapturedPhoto)=>{const path=`factory-attendance/${factoryToday()}/${crypto.randomUUID()}.jpg`;const{error:u}=await supabase.storage.from("attendance-photos").upload(path,p.blob,{contentType:"image/jpeg"});if(u)throw u;const{error}=await supabase.rpc("add_factory_attendance_photo",{p_storage_path:path,p_captured_at:p.capturedAt,p_lat:p.lat,p_lng:p.lng,p_accuracy_m:p.accuracy});if(error)throw error;await load();};
 const save=async()=>{setBusy(true);const rows=(data?.workers||[]).filter(w=>present[w.worker_id]||data?.attendance.some(a=>a.worker_id===w.worker_id)).map(w=>({worker_id:w.worker_id,present:!!present[w.worker_id]}));const{error}=await supabase.rpc("save_factory_attendance",{p_date:date,p_rows:rows as unknown as Json,p_reason:reason||undefined});setBusy(false);if(error)toast.error(error.message);else{toast.success("Factory attendance saved");await load();}};
 const confirm=async(rows:{worker_id:string;hours:number}[])=>{setBusy(true);const{error}=await supabase.rpc("confirm_factory_hours",{p_date:date,p_rows:rows as unknown as Json});setBusy(false);if(error)toast.error(error.message);else{toast.success("Factory hours confirmed");await load();}};
 const workers=data?.workers.filter(w=>`${w.name} ${w.worker_code} ${w.skill_type}`.toLowerCase().includes(search.toLowerCase()))||[];
 return <section className="min-w-0 space-y-4" aria-label="Factory attendance">
 <div className="space-y-1"><Label htmlFor="factory-att-date">Work date</Label><Input id="factory-att-date" className="w-40" value={dateText} placeholder="DD/MM/YYYY" maxLength={10} onChange={e=>{setDateText(e.target.value);const d=parseLabourDateInput(e.target.value);if(d)setDate(d);}} /></div>
 <h2 className="font-display font-semibold">Step 1 · Toolbox talk photo</h2>
 <div className="grid grid-cols-3 gap-2">{data?.photos.map(p=><img key={p.id} src={p.url} alt="Factory toolbox talk" className="aspect-video w-full rounded object-cover" />)}</div>
 {editable&&date===factoryToday()&&(data?.photos.length||0)<3&&<ToolboxCamera projectName="Factory" onCaptured={capture}/>}
 {date!==factoryToday()&&!data?.photos.length&&<p className="text-sm text-warning">No toolbox photo for this date. A permitted no-photo exception needs a reason.</p>}
 <h2 className="font-display font-semibold">Step 2 · Mark workers</h2><Input aria-label="Search factory workers" placeholder="Search workers" value={search} onChange={e=>setSearch(e.target.value)}/>
 <div className="space-y-2">{workers.map(w=><div key={w.worker_id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-border py-3"><div className="min-w-0 flex-1"><p className="break-words font-medium">{w.name}</p><p className="break-words text-xs text-muted-foreground">{w.skill_type} · {w.contractor_name||"Direct"}</p></div><div className="flex gap-1"><Button className="min-h-11" size="sm" variant={present[w.worker_id]?"default":"outline"} disabled={!editable||busy||(!data?.photos.length&&date===factoryToday())} onClick={()=>setPresent(p=>({...p,[w.worker_id]:true}))}>Present</Button><Button className="min-h-11" size="sm" variant={!present[w.worker_id]?"secondary":"outline"} disabled={!editable||busy} onClick={()=>setPresent(p=>({...p,[w.worker_id]:false}))}>Absent</Button></div></div>)}</div>
 <Label htmlFor="factory-att-reason">Reason for editing / no-photo exception</Label><Input id="factory-att-reason" value={reason} onChange={e=>setReason(e.target.value)}/>
 <Button className="w-full" disabled={!editable||busy} onClick={()=>void save()}>Save attendance</Button>
 <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-display font-semibold">Evening · Confirm hours</h2><Button variant="outline" disabled={!editable||busy} onClick={()=>void confirm((data?.attendance||[]).filter(a=>a.hours>0&&!a.hours_confirmed).map(a=>({worker_id:a.worker_id,hours:Number(data?.standard_hours||8)})))}>Confirm all at standard hours</Button></div>
 {data?.attendance.filter(a=>a.hours>0).map(a=><div key={a.worker_id} className="flex min-w-0 flex-wrap items-center gap-2 border-b border-border py-3"><div className="min-w-0 flex-1"><p className="break-words">{data.workers.find(w=>w.worker_id===a.worker_id)?.name||"Worker"}</p><Badge variant="outline">{a.hours_confirmed?"Hours confirmed":"Not confirmed"}</Badge>{a.no_photo_exception&&<Badge variant="outline">No photo · exception</Badge>}</div><div className="inline-flex shrink-0 items-stretch"><Input aria-label={`Factory hours ${a.worker_id}`} type="number" className="h-11 w-20 rounded-r-none" min={0} max={16} step={0.5} value={hours[a.worker_id]??a.hours} disabled={!editable} onChange={e=>setHours(h=>({...h,[a.worker_id]:Number(e.target.value)}))}/><Button className="h-11 rounded-l-none" disabled={!editable||busy} onClick={()=>void confirm([{worker_id:a.worker_id,hours:hours[a.worker_id]??a.hours}])}>Confirm hours</Button></div></div>)}
 </section>;
}