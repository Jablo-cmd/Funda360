import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { useSchool } from '@/features/school/hooks/useSchool';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/lib/supabase';
import { getDbErrorMessage } from '@/lib/dbErrors';

type Metric = Record<string, number>;
type Analytics = Record<string, Metric>;
const input='focus-ring w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-content-primary';

export function OperationsHubPage() {
  const { school }=useSchool();
  const { can }=usePermissions();
  const [analytics,setAnalytics]=useState<Analytics>({});
  const [error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const canManage=can('operations.manage');

  const load=useCallback(async()=>{
    if(!school)return;
    try{
      const {data,error}=await supabase.rpc('get_operations_analytics',{p_school_id:school.id});
      if(error)throw error;
      setAnalytics((data ?? {}) as Analytics);
    }catch(e){setError(getDbErrorMessage(e,'Unable to load operations analytics.'));}
  },[school]);
  useEffect(()=>{void load();},[load]);

  const create=async(entity:string,payload:Record<string,string|number|null>)=>{
    if(!school)return;
    setBusy(true);setError(null);
    try{const {error}=await supabase.rpc('create_operation_record',{p_entity:entity,p_school_id:school.id,p_payload:payload});if(error)throw error;await load();}
    catch(e){setError(getDbErrorMessage(e,'Operation could not be saved.'));}finally{setBusy(false);}
  };

  if(!school)return <PageContainer><PageHeader title="Operations" description="Boarding, library, sport, assets, procurement, governance, events and compliance."/><NoActiveSchoolNotice resource="operations" /> </PageContainer>;

  return <PageContainer>
    <PageHeader title="School Operations" description="One operational workspace across boarding, library, sport, assets, procurement, governance, events, interoperability and compliance."/>
    <ErrorAlert message={error}/>
    {Object.keys(analytics).length===0?<LoadingBlock label="Loading operational intelligence…"/>:
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">{Object.entries(analytics).map(([domain,metrics])=><section key={domain} className="rounded-card border border-border bg-surface-raised p-4 shadow-card dark:shadow-card-dark"><h2 className="text-sm font-semibold capitalize text-content-primary">{domain}</h2>{Object.entries(metrics).map(([k,v])=><div key={k} className="mt-2 flex justify-between text-xs"><span className="capitalize text-content-tertiary">{k}</span><span className="font-semibold text-content-primary">{v}</span></div>)}</section>)}</div>}
    {canManage&&<div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
      <OperationForm title="Boarding house" fields={['name','code','capacity']} busy={busy} onSubmit={p=>create('boarding_house',p)}/>
      <OperationForm title="Library book" fields={['title','isbn','author','publisher','category']} busy={busy} onSubmit={p=>create('library_book',p)}/>
      <OperationForm title="Sports activity" fields={['name','category']} busy={busy} onSubmit={p=>create('sports_activity',p)}/>
      <OperationForm title="Asset category" fields={['name','code']} busy={busy} onSubmit={p=>create('asset_category',p)}/>
      <OperationForm title="Supplier" fields={['name','registration_number','contact_name','email','phone']} busy={busy} onSubmit={p=>create('supplier',p)}/>
      <OperationForm title="Governance member" fields={['full_name','role_title','term_start','term_end']} busy={busy} onSubmit={p=>create('governance_member',p)}/>
      <OperationForm title="School event" fields={['title','event_type','starts_at','ends_at','venue','description']} busy={busy} onSubmit={p=>create('event',p)}/>
      <section className="rounded-card border border-border bg-surface-raised p-5 shadow-card dark:shadow-card-dark"><h2 className="mb-2 font-semibold text-content-primary">POPIA data request</h2><p className="mb-3 text-xs text-content-tertiary">Create an auditable access, correction, restriction, deletion or portability request for the current school.</p><Button disabled={busy} onClick={async()=>{setBusy(true);try{const {error}=await supabase.rpc('create_data_subject_request',{p_school_id:school.id,p_request_type:'access'});if(error)throw error;await load();}catch(e){setError(getDbErrorMessage(e,'DSAR request failed.'));}finally{setBusy(false);}}}>Create access request</Button></section>
    </div>}
  </PageContainer>;
}

function OperationForm({title,fields,busy,onSubmit}:{title:string;fields:string[];busy:boolean;onSubmit:(p:Record<string,string>)=>Promise<void>}) {
 const [values,setValues]=useState<Record<string,string>>({});
 const submit=async(e:FormEvent)=>{e.preventDefault();await onSubmit(values);setValues({});};
 return <form onSubmit={submit} className="rounded-card border border-border bg-surface-raised p-5 shadow-card dark:shadow-card-dark"><h2 className="mb-4 font-semibold text-content-primary">{title}</h2><div className="space-y-3">{fields.map(f=><input key={f} className={input} required={['name','code','title','full_name','role_title','event_type'].includes(f)} placeholder={f.replaceAll('_',' ')} value={values[f]??''} onChange={e=>setValues(v=>({...v,[f]:e.target.value}))}/>)}</div><Button className="mt-4" disabled={busy}>Create</Button></form>;
}
