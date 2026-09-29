import { useEffect, useState } from 'react';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { supabase } from '@/lib/supabase';
import { getDbErrorMessage } from '@/lib/dbErrors';

type Assignment = { id:string; route_id:string; pickup_stop_id:string|null; dropoff_stop_id:string|null; effective_from:string; effective_to:string|null; status:string };
type Route = { id:string; name:string; code:string };
type Stop = { id:string; name:string; address:string|null; pickup_time:string|null; dropoff_time:string|null };
type Attendance = { schedule_id:string; status:string; recorded_at:string };

export function LearnerTransportPage() {
  const [assignment,setAssignment]=useState<Assignment|null>(null);
  const [route,setRoute]=useState<Route|null>(null);
  const [stops,setStops]=useState<Record<string,Stop>>({});
  const [attendance,setAttendance]=useState<Attendance[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  useEffect(() => {
    let cancelled=false;
    (async () => {
      try {
        const { data:a,error:aError }=await supabase.from('transport_assignments').select('*').eq('status','active').order('effective_from',{ascending:false}).limit(1).maybeSingle();
        if(aError) throw aError;
        if(!a){if(!cancelled)setLoading(false);return;}
        const [r,s,at]=await Promise.all([
          supabase.from('transport_routes').select('id,name,code').eq('id',a.route_id).maybeSingle(),
          supabase.from('transport_stops').select('id,name,address,pickup_time,dropoff_time').in('id',[a.pickup_stop_id,a.dropoff_stop_id].filter(Boolean)),
          supabase.from('transport_attendance').select('schedule_id,status,recorded_at').eq('learner_id',a.learner_id).order('recorded_at',{ascending:false}).limit(10),
        ]);
        for(const result of [r,s,at]) if(result.error) throw result.error;
        if(cancelled)return;
        setAssignment(a as Assignment);
        setRoute((r.data ?? null) as Route|null);
        setStops(Object.fromEntries(((s.data ?? []) as Stop[]).map(x=>[x.id,x])));
        setAttendance((at.data ?? []) as Attendance[]);
      } catch(err){if(!cancelled)setError(getDbErrorMessage(err,'Unable to load learner transport information.'));} finally{if(!cancelled)setLoading(false);}
    })();
    return()=>{cancelled=true;};
  },[]);

  const stop=(id:string|null)=>id?stops[id]:undefined;
  return <PageContainer>
    <PageHeader title="My Transport" description="Your current school transport arrangement and latest trip records." />
    <ErrorAlert message={error} />
    {loading?<LoadingBlock label="Loading transport…" />:!assignment?<div className="rounded-card border border-border bg-surface-raised p-6 text-sm text-content-tertiary">No active transport arrangement is recorded.</div>:
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-card border border-border bg-surface-raised p-5 shadow-card dark:shadow-card-dark">
          <h2 className="font-semibold text-content-primary">{route?.name ?? 'Assigned route'} <span className="text-xs text-content-tertiary">{route?.code ?? ''}</span></h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div><dt className="text-content-tertiary">Pickup</dt><dd className="text-content-primary">{stop(assignment.pickup_stop_id)?.name ?? 'Not specified'}{stop(assignment.pickup_stop_id)?.pickup_time ? ` · ${stop(assignment.pickup_stop_id)?.pickup_time}` : ''}</dd></div>
            <div><dt className="text-content-tertiary">Drop-off</dt><dd className="text-content-primary">{stop(assignment.dropoff_stop_id)?.name ?? 'Not specified'}{stop(assignment.dropoff_stop_id)?.dropoff_time ? ` · ${stop(assignment.dropoff_stop_id)?.dropoff_time}` : ''}</dd></div>
            <div><dt className="text-content-tertiary">Effective</dt><dd className="text-content-primary">{assignment.effective_from}{assignment.effective_to ? ` → ${assignment.effective_to}` : ''}</dd></div>
          </dl>
        </section>
        <section className="rounded-card border border-border bg-surface-raised p-5 shadow-card dark:shadow-card-dark">
          <h2 className="font-semibold text-content-primary">Recent trip records</h2>
          {attendance.length===0?<p className="mt-4 text-sm text-content-tertiary">No transport attendance has been recorded yet.</p>:
            <div className="mt-3 space-y-2">{attendance.map(a=><div key={a.schedule_id} className="flex items-center justify-between border-b border-border py-2 last:border-0"><span className="text-sm text-content-secondary">{new Date(a.recorded_at).toLocaleString()}</span><span className="text-sm font-medium capitalize text-content-primary">{a.status.replaceAll('_',' ')}</span></div>)}</div>}
        </section>
      </div>}
  </PageContainer>;
}
