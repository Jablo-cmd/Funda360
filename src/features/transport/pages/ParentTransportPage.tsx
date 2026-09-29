import { useEffect, useState } from 'react';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { supabase } from '@/lib/supabase';
import { getDbErrorMessage } from '@/lib/dbErrors';

interface Assignment { id:string; learner_id:string; route_id:string; pickup_stop_id:string|null; dropoff_stop_id:string|null; effective_from:string; effective_to:string|null; status:string; }
interface Learner { id:string; first_name:string; last_name:string; }

export function ParentTransportPage() {
  const [rows,setRows]=useState<Assignment[]>([]);
  const [learners,setLearners]=useState<Record<string,Learner>>({});
  const [routes,setRoutes]=useState<Record<string,string>>({});
  const [stops,setStops]=useState<Record<string,string>>({});
  const [attendance,setAttendance]=useState<Record<string,string>>({});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  useEffect(() => {
    let cancelled=false;
    (async () => {
      try {
        const [a,l,r,s] = await Promise.all([
          supabase.from('transport_assignments').select('*').eq('status','active'),
          supabase.from('learners').select('id,first_name,last_name'),
          supabase.from('transport_routes').select('id,name'),
          supabase.from('transport_stops').select('id,name'),
        ]);
        for (const result of [a,l,r,s]) if (result.error) throw result.error;
        if (cancelled) return;
        setRows((a.data ?? []) as Assignment[]);
        setLearners(Object.fromEntries(((l.data ?? []) as Learner[]).map(x => [x.id,x])));
        setRoutes(Object.fromEntries(((r.data ?? []) as {id:string;name:string}[]).map(x => [x.id,x.name])));
        setStops(Object.fromEntries(((s.data ?? []) as {id:string;name:string}[]).map(x => [x.id,x.name])));
        const learnerIds=(a.data ?? []).map((x:Assignment)=>x.learner_id);
        if (learnerIds.length) {
          const {data: at,error:atError}=await supabase.from('transport_attendance').select('learner_id,status,recorded_at').in('learner_id',learnerIds).order('recorded_at',{ascending:false}).limit(50);
          if (atError) throw atError;
          const latest:Record<string,string>={};
          for (const item of (at ?? []) as {learner_id:string;status:string}[]) if (!latest[item.learner_id]) latest[item.learner_id]=item.status;
          setAttendance(latest);
        }
      } catch(err){ if(!cancelled){setError(getDbErrorMessage(err,'Unable to load transport information.'));} }
      finally{if(!cancelled)setLoading(false);}
    })();
    return () => {cancelled=true;};
  },[]);

  return <PageContainer>
    <PageHeader title="Transport" description="Your children's current transport arrangements and latest trip status." />
    <ErrorAlert message={error} />
    {loading ? <LoadingBlock label="Loading transport…" /> : rows.length===0
      ? <div className="rounded-card border border-border bg-surface-raised p-6 text-sm text-content-tertiary">No active transport arrangements are recorded.</div>
      : <div className="grid gap-4 md:grid-cols-2">{rows.map(row=>{
        const learner=learners[row.learner_id];
        return <article key={row.id} className="rounded-card border border-border bg-surface-raised p-5 shadow-card dark:shadow-card-dark">
          <h2 className="font-semibold text-content-primary">{learner ? `${learner.first_name} ${learner.last_name}` : 'Learner'}</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            <div><dt className="text-content-tertiary">Route</dt><dd className="text-content-primary">{routes[row.route_id] ?? 'Assigned route'}</dd></div>
            <div><dt className="text-content-tertiary">Pickup</dt><dd className="text-content-primary">{row.pickup_stop_id ? stops[row.pickup_stop_id] ?? 'Assigned stop' : 'Not specified'}</dd></div>
            <div><dt className="text-content-tertiary">Drop-off</dt><dd className="text-content-primary">{row.dropoff_stop_id ? stops[row.dropoff_stop_id] ?? 'Assigned stop' : 'Not specified'}</dd></div>
            <div><dt className="text-content-tertiary">Latest trip status</dt><dd className="font-medium capitalize text-content-primary">{(attendance[row.learner_id] ?? 'No trip recorded').replaceAll('_',' ')}</dd></div>
          </dl>
        </article>;
      })}</div>}
  </PageContainer>;
}
