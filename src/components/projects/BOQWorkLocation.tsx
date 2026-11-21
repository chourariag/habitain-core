import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { canViewRunningBill } from "@/lib/running-bill";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
type Item={id:string;sno:number;item_description:string;unit:string|null;work_location:string};
export function BOQWorkLocation({projectId,role}:{projectId:string;role:string|null}) {
 const [items,setItems]=useState<Item[]>([]),[busy,setBusy]=useState<string|null>(null);const allowed=canViewRunningBill(role);
 const load=useCallback(async()=>{if(!allowed)return;const{data,error}=await supabase.rpc("get_boq_work_locations",{p_project_id:projectId});if(error)toast.error(error.message);else setItems(data as unknown as Item[]);},[projectId,allowed]);useEffect(()=>{void load();},[load]);if(!allowed)return null;
 const change=async(id:string,value:string)=>{if(!value)return;setBusy(id);const{error}=await supabase.rpc("set_boq_work_location",{p_item_id:id,p_location:value});setBusy(null);if(error)toast.error(error.message);else await load();};
 return <section className="min-w-0 space-y-3 border-t border-border pt-4" aria-label="BOQ work location"><h2 className="font-display text-lg font-semibold">BOQ work location</h2>{items.map(i=><div key={i.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-border py-2"><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{i.sno} · {i.item_description}</p><span className="text-xs text-muted-foreground">{i.unit}</span></div><ToggleGroup type="single" variant="outline" value={i.work_location} disabled={busy===i.id} onValueChange={v=>void change(i.id,v)} aria-label={`Work location ${i.sno}`}><ToggleGroupItem value="site">Site</ToggleGroupItem><ToggleGroupItem value="factory">Factory</ToggleGroupItem></ToggleGroup></div>)}</section>;
}