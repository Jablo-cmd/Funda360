import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { useSchool } from '@/features/school/hooks/useSchool';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/lib/supabase';
import { getDbErrorMessage } from '@/lib/dbErrors';

type Row = { id?: string; [key: string]: unknown };
type Workspace = Record<string, Row[]>;
type Analytics = Record<string, Record<string, number>>;
const input='focus-ring w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-content-primary';
const tabs=['Boarding','Library','Sports','Assets','Procurement','Governance','Events','Interoperability','Analytics','Automation','POPIA'] as const;
type Tab=typeof tabs[number];

export function OperationsHubPage() {
  const { school }=useSchool();
  const { can }=usePermissions();
  const canManage=can('operations.manage');
  const [tab,setTab]=useState<Tab>('Boarding');
  const [analytics,setAnalytics]=useState<Analytics>({});
  const [advanced,setAdvanced]=useState<Record<string,unknown>>({});
  const [workspace,setWorkspace]=useState<Workspace>({});
  const [error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState<string|null>(null);

  const load=useCallback(async()=>{
    if(!school)return;
    setError(null);
    try{
      const [a,w,x]=await Promise.all([
        supabase.rpc('get_operations_analytics',{p_school_id:school.id}),
        supabase.rpc('get_operations_workspace',{p_school_id:school.id}),
        supabase.rpc('get_advanced_analytics',{p_school_id:school.id}),
      ]);
      if(a.error)throw a.error;if(w.error)throw w.error;if(x.error)throw x.error;
      setAnalytics((a.data??{}) as Analytics);setWorkspace((w.data??{}) as Workspace);setAdvanced((x.data??{}) as Record<string,unknown>);
    }catch(e){setError(getDbErrorMessage(e,'Unable to load the operations workspace.'));}
  },[school]);

  useEffect(()=>{void load();},[load]);

  const run=async(fn:()=>Promise<unknown>,success?:string)=>{
    setBusy(true);setError(null);setMessage(null);
    try{await Promise.resolve(fn());if(success)setMessage(success);await load();}
    catch(e){setError(getDbErrorMessage(e,'The operation could not be completed.'));}
    finally{setBusy(false);}
  };

  if(!school)return <PageContainer><PageHeader title="Operations" description="Complete school operations across residential, resources, activities, procurement, governance and compliance."/><NoActiveSchoolNotice resource="operations"/></PageContainer>;

  return <PageContainer>
    <PageHeader title="School Operations" description="A production workspace for the remaining Funda360 operational domains."/>
    <ErrorAlert message={error}/>
    {message&&<div className="rounded-md border border-border bg-surface-raised p-3 text-sm text-content-secondary">{message}</div>}

    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      {Object.entries(analytics).map(([key,metrics])=><MetricCard key={key} title={key} metrics={metrics}/>)}
    </div>

    <div className="flex gap-2 overflow-x-auto border-b border-border pb-2">
      {tabs.map(t=><button key={t} type="button" onClick={()=>setTab(t)} className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${tab===t?'bg-content-primary text-surface':'text-content-secondary hover:bg-surface-raised'}`}>{t}</button>)}
    </div>

    {tab==='Boarding'&&<Boarding schoolId={school.id} workspace={workspace} canManage={canManage} busy={busy} run={run}/>}
    {tab==='Library'&&<Library schoolId={school.id} workspace={workspace} canManage={canManage} busy={busy} run={run}/>}
    {tab==='Sports'&&<Sports schoolId={school.id} workspace={workspace} canManage={canManage} busy={busy} run={run}/>}
    {tab==='Assets'&&<Assets workspace={workspace} canManage={canManage} busy={busy} run={run}/>}
    {tab==='Procurement'&&<Procurement schoolId={school.id} workspace={workspace} canManage={canManage} busy={busy} run={run}/>}
    {tab==='Governance'&&<Governance schoolId={school.id} workspace={workspace} canManage={canManage} busy={busy} run={run}/>}
    {tab==='Events'&&<Events schoolId={school.id} workspace={workspace} canManage={canManage} busy={busy} run={run}/>}
    {tab==='Interoperability'&&<Interop schoolId={school.id} canManage={canManage} busy={busy} run={run}/>}
    {tab==='Analytics'&&<AnalyticsPanel data={advanced}/>}
    {tab==='Automation'&&<Automation schoolId={school.id} workspace={workspace} canManage={canManage} busy={busy} run={run}/>}
    {tab==='POPIA'&&<Popia workspace={workspace} canManage={canManage} busy={busy} run={run}/>}
  </PageContainer>;
}

function MetricCard({title,metrics}:{title:string;metrics:Record<string,number>}) {
 return <section className="rounded-card border border-border bg-surface-raised p-3 shadow-card dark:shadow-card-dark"><p className="text-xs font-semibold capitalize text-content-tertiary">{title}</p>{Object.entries(metrics).map(([k,v])=><div key={k} className="mt-1 flex justify-between gap-2 text-xs"><span className="capitalize text-content-tertiary">{k}</span><b className="text-content-primary">{v}</b></div>)}</section>;
}

function Section({title,children}:{title:string;children:ReactNode}) {
 return <section className="rounded-card border border-border bg-surface-raised p-5 shadow-card dark:shadow-card-dark"><h2 className="mb-4 font-semibold text-content-primary">{title}</h2>{children}</section>;
}
function Field({label,children}:{label:string;children:ReactNode}){return <label className="block text-xs text-content-tertiary"><span className="mb-1 block">{label}</span>{children}</label>;}
function Select({value,onChange,children}:{value:string;onChange:(v:string)=>void;children:ReactNode}){return <select className={input} value={value} onChange={e=>onChange(e.target.value)}>{children}</select>;}
function Empty({text}:{text:string}){return <p className="text-sm text-content-tertiary">{text}</p>;}
function Rows({rows,fields}:{rows:Row[];fields:string[]}){return rows.length===0?<Empty text="Nothing recorded yet."/>:<div className="max-h-80 overflow-auto divide-y divide-border">{rows.map((r,i)=><div key={String(r.id??i)} className="py-3 text-sm"><div className="font-medium text-content-primary">{String(r.title??r.description??r.team??r.learner??r.name??r.asset_number??r.request_type??'Record')}</div><div className="mt-1 flex flex-wrap gap-3 text-xs text-content-tertiary">{fields.map(f=><span key={f}>{f.replaceAll('_',' ')}: {String(r[f]??'—')}</span>)}</div></div>)}</div>}

function Form({title,fields,onSubmit,busy}:{title:string;fields:string[];onSubmit:(v:Record<string,string>)=>Promise<void>;busy:boolean}){
 const [v,setV]=useState<Record<string,string>>({});
 const submit=async(e:FormEvent)=>{e.preventDefault();await onSubmit(v);setV({});};
 return <form onSubmit={submit} className="space-y-3"><h3 className="text-sm font-semibold text-content-primary">{title}</h3>{fields.map(f=><input key={f} className={input} placeholder={f.replaceAll('_',' ')} value={v[f]??''} onChange={e=>setV(x=>({...x,[f]:e.target.value}))} required={['name','code','title','description','full_name','role_title'].includes(f)}/>) }<Button disabled={busy}>Save</Button></form>;
}

function Boarding({schoolId,workspace,canManage,busy,run}:{schoolId:string;workspace:Workspace;canManage:boolean;busy:boolean;run:(fn:()=>PromiseLike<unknown>,s?:string)=>Promise<void>}) {
 const [learner,setLearner]=useState(''),[bed,setBed]=useState(''),[date,setDate]=useState(new Date().toISOString().slice(0,10));
 const learners=workspace.learners??[],beds=workspace.boarding_beds??[];
 return <div className="grid gap-6 lg:grid-cols-2">
  <Section title="Boarding register"><Rows rows={workspace.boarding??[]} fields={['house','room','bed_code','effective_from']}/></Section>
  {canManage&&<Section title="Allocate boarder"><div className="space-y-3"><Field label="Learner"><Select value={learner} onChange={setLearner}><option value="">Select learner</option>{learners.map(x=><option key={String(x.id)} value={String(x.id)}>{String(x.first_name)} {String(x.last_name)}</option>)}</Select></Field><Field label="Bed"><Select value={bed} onChange={setBed}><option value="">Select bed</option>{beds.map(x=><option key={String(x.id)} value={String(x.id)}>{String(x.house)} / {String(x.room)} / {String(x.bed_code)}</option>)}</Select></Field><input className={input} type="date" value={date} onChange={e=>setDate(e.target.value)}/><Button disabled={busy||!learner||!bed} onClick={()=>void run(()=>supabase.rpc('boarding_allocate_learner',{p_school_id:schoolId,p_learner_id:learner,p_bed_id:bed,p_effective_from:date}), 'Boarding allocation saved.')}>Allocate</Button></div></Section>}
  {canManage&&<Section title="Boarding master data"><Form title="Add house" fields={['name','code','capacity']} busy={busy} onSubmit={v=>run(()=>supabase.rpc('create_operation_record',{p_entity:'boarding_house',p_school_id:schoolId,p_payload:v}),'Boarding house created.')}/></Section>}
 </div>;
}

function Library({schoolId,workspace,canManage,busy,run}:{schoolId:string;workspace:Workspace;canManage:boolean;busy:boolean;run:(fn:()=>PromiseLike<unknown>,s?:string)=>Promise<void>}) {
 const [copy,setCopy]=useState(''),[learner,setLearner]=useState(''),[due,setDue]=useState(''),[renewLoan,setRenewLoan]=useState('');
 const learners=workspace.learners??[],copies=workspace.library_copies??[],loans=workspace.library??[];
 
 return <div className="grid gap-6 lg:grid-cols-2">
  <Section title="Circulation"><Rows rows={loans} fields={['title','learner','due_at','status']}/></Section>
  {canManage&&<Section title="Checkout / renew"><div className="space-y-3"><Field label="Available copy"><Select value={copy} onChange={setCopy}><option value="">Select copy</option>{copies.filter(x=>x.status==='available').map(x=><option key={String(x.id)} value={String(x.id)}>{String(x.title)} — {String(x.barcode)}</option>)}</Select></Field><Field label="Learner"><Select value={learner} onChange={setLearner}><option value="">Select learner</option>{learners.map(x=><option key={String(x.id)} value={String(x.id)}>{String(x.first_name)} {String(x.last_name)}</option>)}</Select></Field><input className={input} type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/><Button disabled={busy||!copy||!learner||!due} onClick={()=>void run(()=>supabase.rpc('library_checkout',{p_school_id:schoolId,p_copy_id:copy,p_learner_id:learner,p_due_at:new Date(due).toISOString()}),'Book checked out.')}>Checkout</Button><Field label="Renew loan"><Select value={renewLoan} onChange={setRenewLoan}><option value="">Select loan</option>{loans.map(x=><option key={String(x.id)} value={String(x.id)}>{String(x.title)} — {String(x.learner)}</option>)}</Select></Field><Button variant="secondary" disabled={busy||!renewLoan||!due} onClick={()=>void run(()=>supabase.rpc('library_renew',{p_loan_id:renewLoan,p_due_at:new Date(due).toISOString()}),'Loan renewed.')}>Renew</Button></div></Section>}
  {canManage&&<Section title="Catalogue"><Form title="Add book" fields={['title','isbn','author','publisher','category']} busy={busy} onSubmit={v=>run(()=>supabase.rpc('create_operation_record',{p_entity:'library_book',p_school_id:schoolId,p_payload:v}),'Book added.')}/></Section>}
 </div>;
}

function Sports({schoolId,workspace,canManage,busy,run}:{schoolId:string;workspace:Workspace;canManage:boolean;busy:boolean;run:(fn:()=>PromiseLike<unknown>,s?:string)=>Promise<void>}) {
 const [team,setTeam]=useState(''),[learner,setLearner]=useState(''),[fixture,setFixture]=useState(''),[sf,setSf]=useState(''),[sa,setSa]=useState('');
 const schoolId=(window as unknown as {__fundaSchoolId?:string}).__fundaSchoolId??'';
 return <div className="grid gap-6 lg:grid-cols-2"><Section title="Fixtures & results"><Rows rows={workspace.sports??[]} fields={['team','fixture_date','opponent','venue','status','score_for','score_against']}/></Section>{canManage&&<><Section title="Register player"><div className="space-y-3"><Select value={team} onChange={setTeam}><option value="">Select team</option>{(workspace.sports_teams??[]).map(x=><option key={String(x.id)} value={String(x.id)}>{String(x.activity)} — {String(x.team)}</option>)}</Select><Select value={learner} onChange={setLearner}><option value="">Select learner</option>{(workspace.learners??[]).map(x=><option key={String(x.id)} value={String(x.id)}>{String(x.first_name)} {String(x.last_name)}</option>)}</Select><Button disabled={busy||!team||!learner} onClick={()=>void run(()=>supabase.rpc('sports_add_player',{p_school_id:schoolId,p_team_id:team,p_learner_id:learner}),'Player registered.')}>Register</Button></div></Section><Section title="Record result"><div className="space-y-3"><Select value={fixture} onChange={setFixture}><option value="">Select fixture</option>{(workspace.sports??[]).map(x=><option key={String(x.id)} value={String(x.id)}>{String(x.team)} — {String(x.opponent)} — {String(x.fixture_date)}</option>)}</Select><div className="grid grid-cols-2 gap-3"><input className={input} type="number" min="0" placeholder="Score for" value={sf} onChange={e=>setSf(e.target.value)}/><input className={input} type="number" min="0" placeholder="Score against" value={sa} onChange={e=>setSa(e.target.value)}/></div><Button disabled={busy||!fixture||sf===''||sa===''} onClick={()=>void run(()=>supabase.rpc('sports_record_fixture_result',{p_fixture_id:fixture,p_status:'played',p_score_for:Number(sf),p_score_against:Number(sa)}),'Fixture result recorded.')}>Save result</Button></div></Section></>}</div>;
}

function Assets({workspace,canManage,busy,run}:{workspace:Workspace;canManage:boolean;busy:boolean;run:(fn:()=>PromiseLike<unknown>,s?:string)=>Promise<void>}) {
 const [asset,setAsset]=useState(''),[location,setLocation]=useState(''),[status,setStatus]=useState('active');
 return <div className="grid gap-6 lg:grid-cols-2"><Section title="Asset register"><Rows rows={workspace.assets??[]} fields={['asset_number','location','condition','status','warranty_until']}/></Section>{canManage&&<Section title="Lifecycle & transfer"><div className="space-y-3"><Select value={asset} onChange={setAsset}><option value="">Select asset</option>{(workspace.assets??[]).map(x=><option key={String(x.id)} value={String(x.id)}>{String(x.asset_number)} — {String(x.description)}</option>)}</Select><input className={input} placeholder="New location" value={location} onChange={e=>setLocation(e.target.value)}/><Button disabled={busy||!asset||!location} onClick={()=>void run(()=>supabase.rpc('asset_transfer',{p_asset_id:asset,p_to_location:location,p_reason:'Operational transfer'}),'Asset transferred.')}>Transfer</Button><Select value={status} onChange={setStatus}><option value="active">Active</option><option value="maintenance">Maintenance</option><option value="lost">Lost</option><option value="disposed">Disposed</option></Select><Button variant="secondary" disabled={busy||!asset} onClick={()=>void run(()=>supabase.rpc('asset_set_lifecycle',{p_asset_id:asset,p_status:status}),'Asset lifecycle updated.')}>Update lifecycle</Button></div></Section>}</div>;
}

function Procurement({schoolId,workspace,canManage,busy,run}:{schoolId:string;workspace:Workspace;canManage:boolean;busy:boolean;run:(fn:()=>PromiseLike<unknown>,s?:string)=>Promise<void>}) {
 const [desc,setDesc]=useState(''),[amount,setAmount]=useState(''),[request,setRequest]=useState(''),[supplier,setSupplier]=useState(''),[po,setPo]=useState(''),[total,setTotal]=useState('');
 const schoolId=(window as unknown as {__fundaSchoolId?:string}).__fundaSchoolId??'';
 return <div className="grid gap-6 lg:grid-cols-2"><Section title="Requests"><Rows rows={workspace.procurement??[]} fields={['estimated_amount','status','created_at']}/></Section><Section title="Suppliers"><Rows rows={workspace.suppliers??[]} fields={['active']}/></Section>{canManage&&<><Section title="Create request"><div className="space-y-3"><input className={input} placeholder="Description" value={desc} onChange={e=>setDesc(e.target.value)}/><input className={input} type="number" min="0" placeholder="Estimated amount" value={amount} onChange={e=>setAmount(e.target.value)}/><Button disabled={busy||!desc||amount===''} onClick={()=>void run(()=>supabase.rpc('create_purchase_request',{p_school_id:schoolId,p_description:desc,p_estimated_amount:Number(amount)}),'Purchase request created.')}>Submit draft</Button></div></Section><Section title="Approve request / create PO"><div className="space-y-3"><Select value={request} onChange={setRequest}><option value="">Select request</option>{(workspace.procurement??[]).map(x=><option key={String(x.id)} value={String(x.id)}>{String(x.description)} — {String(x.status)}</option>)}</Select><Button disabled={busy||!request} onClick={()=>void run(()=>supabase.rpc('transition_purchase_request',{p_request_id:request,p_status:'approved'}),'Request approved.')}>Approve</Button><Select value={supplier} onChange={setSupplier}><option value="">Select supplier</option>{(workspace.suppliers??[]).map(x=><option key={String(x.id)} value={String(x.id)}>{String(x.name)}</option>)}</Select><input className={input} placeholder="PO number" value={po} onChange={e=>setPo(e.target.value)}/><input className={input} type="number" min="0" placeholder="PO total" value={total} onChange={e=>setTotal(e.target.value)}/><Button variant="secondary" disabled={busy||!request||!supplier||!po||total===''} onClick={()=>void run(()=>supabase.rpc('create_purchase_order',{p_school_id:schoolId,p_request_id:request,p_supplier_id:supplier,p_po_number:po,p_total_amount:Number(total)}),'Purchase order created.')}>Create PO</Button></div></Section></>}</div>;
}

function Governance({schoolId,workspace,canManage,busy,run}:{schoolId:string;workspace:Workspace;canManage:boolean;busy:boolean;run:(fn:()=>PromiseLike<unknown>,s?:string)=>Promise<void>}) {
 const [title,setTitle]=useState(''),[date,setDate]=useState(''),[meeting,setMeeting]=useState(''),[resolutionTitle,setResolutionTitle]=useState(''),[decision,setDecision]=useState('');
 const schoolId=(window as unknown as {__fundaSchoolId?:string}).__fundaSchoolId??'';
 return <div className="grid gap-6 lg:grid-cols-2"><Section title="Meetings"><Rows rows={workspace.governance_meetings??[]} fields={['meeting_date','venue','status']}/></Section><Section title="Resolutions"><Rows rows={workspace.governance??[]} fields={['resolution_number','decision','status','due_date']}/></Section>{canManage&&<><Section title="Create meeting"><div className="space-y-3"><input className={input} placeholder="Meeting title" value={title} onChange={e=>setTitle(e.target.value)}/><input className={input} type="date" value={date} onChange={e=>setDate(e.target.value)}/><Button disabled={busy||!title||!date} onClick={()=>void run(()=>supabase.rpc('create_governance_meeting',{p_school_id:schoolId,p_title:title,p_meeting_date:date}),'Meeting created.')}>Create</Button></div></Section><Section title="Create resolution"><div className="space-y-3"><Select value={meeting} onChange={setMeeting}><option value="">Select meeting</option>{(workspace.governance_meetings??[]).map(x=><option key={String(x.id)} value={String(x.id)}>{String(x.title)}</option>)}</Select><input className={input} placeholder="Resolution title" value={resolutionTitle} onChange={e=>setResolutionTitle(e.target.value)}/><textarea className={input} placeholder="Decision" value={decision} onChange={e=>setDecision(e.target.value)}/><Button disabled={busy||!meeting||!resolutionTitle||!decision} onClick={()=>void run(()=>supabase.rpc('create_governance_resolution',{p_school_id:schoolId,p_meeting_id:meeting,p_title:resolutionTitle,p_decision:decision}),'Resolution recorded.')}>Record resolution</Button></div></Section></>}</div>;
}

function Events({schoolId,workspace,canManage,busy,run}:{schoolId:string;workspace:Workspace;canManage:boolean;busy:boolean;run:(fn:()=>PromiseLike<unknown>,s?:string)=>Promise<void>}) {
 const [title,setTitle]=useState(''),[type,setType]=useState('academic'),[start,setStart]=useState(''),[end,setEnd]=useState(''),[event,setEvent]=useState(''),[learner,setLearner]=useState('');
 const schoolId=(window as unknown as {__fundaSchoolId?:string}).__fundaSchoolId??'';
 return <div className="grid gap-6 lg:grid-cols-2"><Section title="Upcoming calendar"><Rows rows={workspace.events??[]} fields={['event_type','starts_at','ends_at','venue','status']}/></Section>{canManage&&<><Section title="Create event"><div className="space-y-3"><input className={input} placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)}/><input className={input} placeholder="Event type" value={type} onChange={e=>setType(e.target.value)}/><input className={input} type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/><input className={input} type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)}/><Button disabled={busy||!title||!start||!end} onClick={()=>void run(()=>supabase.rpc('create_school_event',{p_school_id:schoolId,p_title:title,p_event_type:type,p_starts_at:new Date(start).toISOString(),p_ends_at:new Date(end).toISOString()}),'Event created.')}>Create</Button></div></Section><Section title="Add learner participant"><div className="space-y-3"><Select value={event} onChange={setEvent}><option value="">Select event</option>{(workspace.events??[]).map(x=><option key={String(x.id)} value={String(x.id)}>{String(x.title)}</option>)}</Select><Select value={learner} onChange={setLearner}><option value="">Select learner</option>{(workspace.learners??[]).map(x=><option key={String(x.id)} value={String(x.id)}>{String(x.first_name)} {String(x.last_name)}</option>)}</Select><Button disabled={busy||!event||!learner} onClick={()=>void run(()=>supabase.rpc('create_event_participant',{p_event_id:event,p_learner_id:learner}),'Participant added.')}>Add</Button></div></Section></>}</div>;
}

function Interop({schoolId,canManage,busy,run}:{schoolId:string;canManage:boolean;busy:boolean;run:(fn:()=>PromiseLike<unknown>,s?:string)=>Promise<void>}) {
 const [csv,setCsv]=useState('');const [result,setResult]=useState('');
 if(!canManage)return <Section title="Interoperability"><Empty text="Interoperability administration is restricted to operational managers."/></Section>;
 const execute=async()=>{const lines=csv.trim().split(/\r?\n/).filter(Boolean);const [head,...body]=lines;if(!head)throw new Error('CSV header required.');const headers=head.split(',').map(x=>x.trim());const rows=body.map(line=>{const cells=line.split(',');return Object.fromEntries(headers.map((h,i)=>[h,(cells[i]??'').trim()]));});const created=await supabase.rpc('create_interop_import',{p_school_id:schoolId,p_entity_type:'learners',p_file_name:'funda360-import.csv',p_format:'csv',p_rows:rows,p_mapping:{}});if(created.error)throw created.error;const id=String((created.data as Row).id);const valid=await supabase.rpc('validate_interop_import',{p_import_id:id});if(valid.error)throw valid.error;if(String((valid.data as Row).status)!=='validated')throw new Error('Validation failed. Correct the staged rows before applying.');const applied=await supabase.rpc('apply_interop_import',{p_import_id:id});if(applied.error)throw applied.error;setResult(`Applied ${String((applied.data as Row).valid_rows??rows.length)} learner rows.`);setCsv('');};
 return <Section title="SA-SAMS / CEMIS-ready import"><p className="mb-3 text-sm text-content-tertiary">Controlled learner CSV staging, validation, duplicate detection and explicit apply. Official government endpoints are intentionally not fabricated.</p><textarea className={input+' min-h-48'} value={csv} onChange={e=>setCsv(e.target.value)} placeholder="learner_number,admission_number,first_name,last_name,date_of_birth,admission_date"/><Button className="mt-3" disabled={busy||!csv.trim()} onClick={()=>void run(execute,'Import applied successfully.')}>Validate and apply</Button>{result&&<p className="mt-3 text-sm text-content-secondary">{result}</p>}</Section>;
}

function AnalyticsPanel({data}:{data:Record<string,unknown>}){return <div className="grid gap-6 md:grid-cols-2">{Object.entries(data).map(([k,v])=><Section key={k} title={k}><pre className="max-h-96 overflow-auto text-xs text-content-tertiary">{JSON.stringify(v,null,2)}</pre></Section>)}</div>;}

function Automation({schoolId,workspace,canManage,busy,run}:{schoolId:string;workspace:Workspace;canManage:boolean;busy:boolean;run:(fn:()=>PromiseLike<unknown>,s?:string)=>Promise<void>}) {
 const [key,setKey]=useState('notifications-dispatch'),[cron,setCron]=useState('0 7 * * *'),[enabled,setEnabled]=useState(true);
 return <div className="grid gap-6 lg:grid-cols-2"><Section title="Automation jobs"><Rows rows={workspace.automation??[]} fields={['job_key','cron_expression','enabled','last_run_at']}/></Section>{canManage&&<Section title="Configure scheduled job"><div className="space-y-3"><input className={input} value={key} onChange={e=>setKey(e.target.value)} placeholder="Job key"/><input className={input} value={cron} onChange={e=>setCron(e.target.value)} placeholder="Cron expression"/><label className="flex items-center gap-2 text-sm text-content-secondary"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Enabled</label><Button disabled={busy||!key||!cron} onClick={()=>void run(()=>supabase.rpc('set_automation_job',{p_school_id:schoolId,p_job_key:key,p_cron_expression:cron,p_enabled:enabled}),'Automation job configured.')}>Save</Button></div></Section>}</div>;
}

function Popia({workspace,canManage,busy,run}:{workspace:Workspace;canManage:boolean;busy:boolean;run:(fn:()=>PromiseLike<unknown>,s?:string)=>Promise<void>}) {
 const [request,setRequest]=useState(''),[status,setStatus]=useState('processing');
 return <div className="grid gap-6 lg:grid-cols-2"><Section title="Data-subject requests"><Rows rows={workspace.dsar??[]} fields={['request_type','status','requested_at']}/></Section>{canManage&&<Section title="Process request"><div className="space-y-3"><Select value={request} onChange={setRequest}><option value="">Select request</option>{(workspace.dsar??[]).map(x=><option key={String(x.id)} value={String(x.id)}>{String(x.request_type)} — {String(x.status)}</option>)}</Select><Select value={status} onChange={setStatus}><option value="identity_verified">Identity verified</option><option value="processing">Processing</option><option value="completed">Completed</option><option value="rejected">Rejected</option></Select><Button disabled={busy||!request} onClick={()=>void run(()=>supabase.rpc('transition_data_subject_request',{p_request_id:request,p_status:status,p_outcome:'Processed through Funda360 compliance workflow'}),'POPIA request updated.')}>Update</Button></div></Section>}</div>;
}
