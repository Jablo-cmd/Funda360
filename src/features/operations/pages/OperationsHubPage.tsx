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
  const [advanced,setAdvanced]=useState<Record<string, unknown>>({});
  const [csvText,setCsvText]=useState('');
  const [importMessage,setImportMessage]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const canManage=can('operations.manage');

  const load=useCallback(async()=>{
    if(!school)return;
    try{
      const {data,error}=await supabase.rpc('get_operations_analytics',{p_school_id:school.id});
      if(error)throw error;
      setAnalytics((data ?? {}) as Analytics);
      const advancedResult=await supabase.rpc('get_advanced_analytics',{p_school_id:school.id});
      if(advancedResult.error)throw advancedResult.error;
      setAdvanced((advancedResult.data ?? {}) as Record<string, unknown>);
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

      <section className="rounded-card border border-border bg-surface-raised p-5 shadow-card dark:shadow-card-dark">
        <h2 className="mb-3 font-semibold text-content-primary">Advanced analytics</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {Object.entries(advanced).map(([key,value]) => <div key={key} className="rounded-md border border-border p-3"><p className="text-xs font-semibold capitalize text-content-primary">{key}</p><pre className="mt-2 max-h-28 overflow-auto text-[11px] text-content-tertiary">{JSON.stringify(value,null,2)}</pre></div>)}
        </div>
      </section>
    {canManage&&<div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
      <section className="rounded-card border border-border bg-surface-raised p-5 shadow-card dark:shadow-card-dark">
        <h2 className="mb-2 font-semibold text-content-primary">SA-SAMS / CEMIS import staging</h2>
        <p className="mb-3 text-xs text-content-tertiary">Controlled CSV staging with validation, duplicate detection, audit history and an explicit apply step. No undocumented government API is assumed.</p>
        <textarea className={input+" min-h-32"} placeholder="learner_number,admission_number,first_name,last_name,date_of_birth,admission_date" value={csvText} onChange={e=>setCsvText(e.target.value)} />
        <Button disabled={busy||!csvText.trim()} onClick={async()=>{setBusy(true);setImportMessage(null);try{
          const lines=csvText.trim().split(/\r?\n/).filter(Boolean); const headers=lines[0].split(',').map(x=>x.trim()); const rows=lines.slice(1).map(line=>{const cells=line.split(',');return Object.fromEntries(headers.map((h,i)=>[h,(cells[i]??'').trim()]))});
          const created=await supabase.rpc('create_interop_import',{p_school_id:school.id,p_entity_type:'learners',p_file_name:'manual-paste.csv',p_format:'csv',p_rows:rows,p_mapping:{}}); if(created.error)throw created.error;
          const id=(created.data as {id?:string})?.id; if(!id)throw new Error('Import staging did not return an id.');
          const validated=await supabase.rpc('validate_interop_import',{p_import_id:id}); if(validated.error)throw validated.error;
          const status=(validated.data as {status?:string})?.status; if(status!=='validated')throw new Error('Import validation found errors. Review the staged import before applying.');
          const applied=await supabase.rpc('apply_interop_import',{p_import_id:id}); if(applied.error)throw applied.error;
          setImportMessage(`Import applied: ${(applied.data as {valid_rows?:number})?.valid_rows ?? rows.length} learner rows.`); setCsvText(''); await load();
        }catch(e){setImportMessage(getDbErrorMessage(e,'Interoperability import failed.'));}finally{setBusy(false);}}}>Validate and apply learners</Button>
        {importMessage&&<p className="mt-3 text-xs text-content-secondary">{importMessage}</p>}
      </section>
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
