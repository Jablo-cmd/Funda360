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
type Center = Record<string, unknown>;
type Tab = 'Command'|'AI'|'Learner Success'|'Family'|'Identity & Gate'|'Safety & Health'|'Teaching AI'|'Automation'|'Documents'|'Trust & Ecosystem';

const tabs: Tab[] = ['Command','AI','Learner Success','Family','Identity & Gate','Safety & Health','Teaching AI','Automation','Documents','Trust & Ecosystem'];
const input = 'focus-ring w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-content-primary';
const card = 'rounded-card border border-border bg-surface-raised p-5 shadow-card dark:shadow-card-dark';
// New additive tables/RPCs are generated into database.types.ts by the production migration pipeline.
// Keep this feature isolated from the pre-existing generated type snapshot until that refresh lands.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fundaDb = supabase as any;

export function Funda360NextPage() {
  const { school } = useSchool();
  const { can } = usePermissions();
  const canManage = can('operations.manage');
  const [tab, setTab] = useState<Tab>('Command');
  const [center, setCenter] = useState<Center>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!school) return;
    const { data, error: e } = await fundaDb.rpc('funda_command_center', { p_school_id: school.id });
    if (e) setError(getDbErrorMessage(e, 'Unable to load Funda Intelligence.'));
    else setCenter((data ?? {}) as Center);
  }, [school]);

  useEffect(() => { void load(); }, [load]);

  const run = async (fn: () => PromiseLike<unknown>, success?: string) => {
    setBusy(true); setError(null); setMessage(null);
    try { await Promise.resolve(fn()); if (success) setMessage(success); await load(); }
    catch (e) { setError(getDbErrorMessage(e, 'The operation could not be completed.')); }
    finally { setBusy(false); }
  };

  if (!school) return <PageContainer><PageHeader title="Funda Intelligence" description="The next-generation operating layer for Funda360."/><NoActiveSchoolNotice resource="Funda Intelligence"/></PageContainer>;

  return <PageContainer>
    <PageHeader title="Funda360 Intelligence" description="Run the school, understand the signals, automate the work and keep every action auditable."/>
    <ErrorAlert message={error}/>
    {message && <div className={card + ' text-sm text-content-secondary'}>{message}</div>}
    <div className="flex gap-2 overflow-x-auto border-b border-border pb-2">
      {tabs.map(t => <button key={t} type="button" onClick={() => setTab(t)} className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${tab===t?'bg-content-primary text-surface':'text-content-secondary hover:bg-surface-raised'}`}>{t}</button>)}
    </div>
    {tab === 'Command' && <Command center={center}/>}
    {tab === 'AI' && <AI schoolId={school.id} canManage={canManage} busy={busy} run={run}/>}
    {tab === 'Learner Success' && <LearnerSuccess schoolId={school.id} canManage={canManage} busy={busy} run={run}/>}
    {tab === 'Family' && <Family schoolId={school.id} canManage={canManage} busy={busy} run={run}/>}
    {tab === 'Identity & Gate' && <IdentityGate schoolId={school.id} canManage={canManage} busy={busy} run={run}/>}
    {tab === 'Safety & Health' && <SafetyHealth schoolId={school.id} canManage={canManage} busy={busy} run={run}/>}
    {tab === 'Teaching AI' && <TeachingAI schoolId={school.id} canManage={canManage} busy={busy} run={run}/>}
    {tab === 'Automation' && <Automation schoolId={school.id} canManage={canManage} busy={busy} run={run}/>}
    {tab === 'Documents' && <Documents schoolId={school.id} canManage={canManage} busy={busy} run={run}/>}
    {tab === 'Trust & Ecosystem' && <Trust schoolId={school.id} canManage={canManage} busy={busy} run={run}/>}
  </PageContainer>;
}

function Section({title,children,wide=false}:{title:string;children:ReactNode;wide?:boolean}) {
  return <section className={card + (wide ? ' md:col-span-2' : '')}><h2 className="mb-4 font-semibold text-content-primary">{title}</h2>{children}</section>;
}
function Empty({text}:{text:string}) { return <p className="text-sm text-content-tertiary">{text}</p>; }
function Select({value,onChange,children}:{value:string;onChange:(v:string)=>void;children:ReactNode}) { return <select className={input} value={value} onChange={e=>onChange(e.target.value)}>{children}</select>; }
function Rows({rows,fields}:{rows:Row[];fields:string[]}) {
  if (!rows.length) return <Empty text="Nothing recorded yet."/>;
  return <div className="max-h-80 divide-y divide-border overflow-auto">{rows.map((r,i)=><div key={String(r.id??i)} className="py-3 text-sm"><div className="font-medium text-content-primary">{String(r.title??r.name??r.summary??r.event_type??r.card_number??'Record')}</div><div className="mt-1 flex flex-wrap gap-3 text-xs text-content-tertiary">{fields.map(f=><span key={f}>{f.replaceAll('_',' ')}: {String(r[f]??'—')}</span>)}</div></div>)}</div>;
}
function Form({title,fields,onSubmit,busy}:{title:string;fields:string[];onSubmit:(v:Record<string,string>)=>Promise<void>;busy:boolean}) {
  const [v,setV]=useState<Record<string,string>>({});
  const submit=async(e:FormEvent)=>{e.preventDefault();await onSubmit(v);setV({});};
  return <form onSubmit={submit} className="space-y-3"><h3 className="text-sm font-semibold text-content-primary">{title}</h3>{fields.map(f=><input key={f} className={input} placeholder={f.replaceAll('_',' ')} value={v[f]??''} onChange={e=>setV(x=>({...x,[f]:e.target.value}))} required={['name','title','summary','card_number','gate','document_type'].includes(f)}/>) }<Button disabled={busy}>Save</Button></form>;
}

function Command({center}:{center:Center}) {
  const groups = Object.entries(center).filter(([k]) => k !== 'school_id');
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
    {groups.map(([key,value])=><section key={key} className={card}><h2 className="mb-3 font-semibold capitalize text-content-primary">{key.replaceAll('_',' ')}</h2>{typeof value === 'object' && value ? <div className="space-y-2">{Object.entries(value as Record<string,unknown>).map(([k,v])=><div key={k} className="flex justify-between gap-3 text-sm"><span className="capitalize text-content-tertiary">{k.replaceAll('_',' ')}</span><b className="text-content-primary">{String(v)}</b></div>)}</div> : <p className="text-sm text-content-secondary">{String(value)}</p>}</section>)}
    <Section title="Operating model" wide><p className="text-sm leading-6 text-content-secondary">Funda360 now treats the school as a connected operating system: learner success, family engagement, identity, safety, teaching intelligence, workflows, documents, integrations and trust are first-class domains. External providers remain configuration-driven and never bypass tenant security.</p></Section>
  </div>;
}

function AI({schoolId,canManage,busy,run}:{schoolId:string;canManage:boolean;busy:boolean;run:(fn:()=>PromiseLike<unknown>,s?:string)=>Promise<void>}) {
  const [q,setQ]=useState('What needs my attention today?'); const [answer,setAnswer]=useState(''); const [history,setHistory]=useState<Row[]>([]);
  const ask=async()=>{const {data,error}=await fundaDb.rpc('funda_ai_copilot',{p_school_id:schoolId,p_question:q});if(error)throw error;setAnswer(String((data as Row)?.answer??''));const {data:h}=await fundaDb.from('funda_ai_artifacts').select('*').eq('school_id',schoolId).eq('artifact_type','copilot_answer').order('created_at',{ascending:false}).limit(8);setHistory((h??[]) as Row[]);};
  return <div className="grid gap-6 lg:grid-cols-2">
    <Section title="Funda Copilot"><textarea className={input+' min-h-32'} value={q} onChange={e=>setQ(e.target.value)}/><Button className="mt-3" disabled={busy||!canManage||!q} onClick={()=>void run(ask,'Copilot refreshed from live school metrics.')}>Ask Funda</Button>{answer&&<div className="mt-4 rounded-md border border-border bg-surface p-4 text-sm leading-6 text-content-secondary">{answer}</div>}<p className="mt-3 text-xs text-content-tertiary">The current engine is deterministic and auditable. A provider-backed model can be enabled later without changing the data contract or security boundary.</p></Section>
    <Section title="AI audit trail"><Rows rows={history} fields={['model','created_at','prompt']}/></Section>
  </div>;
}

function LearnerSuccess({schoolId,canManage,busy,run}:{schoolId:string;canManage:boolean;busy:boolean;run:(fn:()=>PromiseLike<unknown>,s?:string)=>Promise<void>}) {
  const [learners,setLearners]=useState<Row[]>([]); const [selected,setSelected]=useState(''); const [attendance,setAttendance]=useState(''); const [average,setAverage]=useState(''); const [behaviour,setBehaviour]=useState(''); const [risks,setRisks]=useState<Row[]>([]); const [interventions,setInterventions]=useState<Row[]>([]);
  const load=useCallback(async()=>{const [{data:l},{data:r},{data:i}]=await Promise.all([fundaDb.from('learners').select('id,first_name,last_name').eq('school_id',schoolId).limit(500),fundaDb.from('funda_risk_profiles').select('*').eq('school_id',schoolId).order('risk_score',{ascending:false}),fundaDb.from('funda_interventions').select('*').eq('school_id',schoolId).order('created_at',{ascending:false})]);setLearners((l??[]) as Row[]);setRisks((r??[]) as Row[]);setInterventions((i??[]) as Row[]);},[schoolId]);
  useEffect(()=>{void load();},[load]);
  const calculate=async()=>{const {error}=await fundaDb.rpc('funda_calculate_risk',{p_school_id:schoolId,p_learner_id:selected,p_attendance_rate:Number(attendance),p_average_mark:Number(average),p_behaviour_events:Number(behaviour)});if(error)throw error;await load();};
  const createIntervention=async(v:Record<string,string>)=>{const {error}=await fundaDb.from('funda_interventions').insert({school_id:schoolId,learner_id:v.learner_id,title:v.title,objective:v.objective,target_date:v.target_date||null,status:'open'});if(error)throw error;await load();};
  return <div className="grid gap-6 lg:grid-cols-2"><Section title="Early-warning engine"><div className="space-y-3"><Select value={selected} onChange={setSelected}><option value="">Select learner</option>{learners.map(x=><option key={String(x.id)} value={String(x.id)}>{String(x.first_name)} {String(x.last_name)}</option>)}</Select><div className="grid grid-cols-3 gap-2"><input className={input} type="number" min="0" max="100" placeholder="Attendance %" value={attendance} onChange={e=>setAttendance(e.target.value)}/><input className={input} type="number" min="0" max="100" placeholder="Average %" value={average} onChange={e=>setAverage(e.target.value)}/><input className={input} type="number" min="0" placeholder="Behaviour events" value={behaviour} onChange={e=>setBehaviour(e.target.value)}/></div><Button disabled={busy||!canManage||!selected} onClick={()=>void run(calculate,'Risk profile calculated and audited.')}>Calculate risk</Button></div><div className="mt-5"><Rows rows={risks} fields={['risk_level','risk_score','recommended_action','reviewed_at']}/></div></Section><Section title="Intervention management"><Form title="Create intervention" fields={['learner_id','title','objective','target_date']} busy={busy} onSubmit={v=>run(()=>createIntervention(v),'Intervention created.')}/><div className="mt-5"><Rows rows={interventions} fields={['status','target_date','owner_profile_id','outcome']}/></div></Section></div>;
}

function Family({schoolId,canManage,busy,run}:{schoolId:string;canManage:boolean;busy:boolean;run:(fn:()=>PromiseLike<unknown>,s?:string)=>Promise<void>}) {
  const [rows,setRows]=useState<Row[]>([]); const [learner,setLearner]=useState(''); const [title,setTitle]=useState(''); const [body,setBody]=useState(''); const [channel,setChannel]=useState('in_app');
  const load=useCallback(async()=>{const {data,error}=await fundaDb.from('funda_family_events').select('*').eq('school_id',schoolId).order('created_at',{ascending:false}).limit(100);if(error)throw error;setRows((data??[]) as Row[]);},[schoolId]);
  useEffect(()=>{void load().catch(()=>undefined);},[load]);
  const create=async()=>{const {error}=await fundaDb.from('funda_family_events').insert({school_id:schoolId,learner_id:learner||null,title,body,channel,status:'queued'});if(error)throw error;setTitle('');setBody('');await load();};
  return <div className="grid gap-6 lg:grid-cols-2"><Section title="Family communication queue"><Rows rows={rows} fields={['channel','status','scheduled_at','created_at']}/></Section>{canManage&&<Section title="Create family message"><div className="space-y-3"><input className={input} placeholder="Learner ID (optional)" value={learner} onChange={e=>setLearner(e.target.value)}/><input className={input} placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)}/><textarea className={input} placeholder="Message" value={body} onChange={e=>setBody(e.target.value)}/><Select value={channel} onChange={setChannel}><option value="in_app">In-app</option><option value="email">Email</option><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option><option value="push">Push</option></Select><Button disabled={busy||!title} onClick={()=>void run(create,'Family communication queued.')}>Queue message</Button></div><p className="mt-3 text-xs text-content-tertiary">Delivery workers use the existing notification architecture; provider credentials remain external configuration.</p></Section>}</div>;
}

function IdentityGate({schoolId,canManage,busy,run}:{schoolId:string;canManage:boolean;busy:boolean;run:(fn:()=>PromiseLike<unknown>,s?:string)=>Promise<void>}) {
  const [learners,setLearners]=useState<Row[]>([]); const [cards,setCards]=useState<Row[]>([]); const [learner,setLearner]=useState(''); const [card,setCard]=useState(''); const [gate,setGate]=useState('Main Gate'); const [direction,setDirection]=useState('in'); const [scanRows,setScanRows]=useState<Row[]>([]);
  const load=useCallback(async()=>{const [{data:l},{data:c},{data:s}]=await Promise.all([fundaDb.from('learners').select('id,first_name,last_name').eq('school_id',schoolId).limit(500),fundaDb.from('funda_ids').select('*').eq('school_id',schoolId).order('issued_at',{ascending:false}),fundaDb.from('funda_gate_scans').select('*').eq('school_id',schoolId).order('scanned_at',{ascending:false}).limit(100)]);setLearners((l??[]) as Row[]);setCards((c??[]) as Row[]);setScanRows((s??[]) as Row[]);},[schoolId]);
  useEffect(()=>{void load();},[load]);
  const issue=async()=>{const token=crypto.randomUUID();const {error}=await fundaDb.from('funda_ids').insert({school_id:schoolId,learner_id:learner,card_number:card,qr_token:token,status:'active'});if(error)throw error;await load();};
  const scan=async()=>{const {error}=await fundaDb.rpc('funda_record_gate_scan',{p_school_id:schoolId,p_learner_id:learner,p_gate:gate,p_direction:direction,p_method:'qr'});if(error)throw error;await load();};
  return <div className="grid gap-6 lg:grid-cols-2"><Section title="Funda ID issuance"><div className="space-y-3"><Select value={learner} onChange={setLearner}><option value="">Select learner</option>{learners.map(x=><option key={String(x.id)} value={String(x.id)}>{String(x.first_name)} {String(x.last_name)}</option>)}</Select><input className={input} placeholder="Card number" value={card} onChange={e=>setCard(e.target.value)}/><Button disabled={busy||!canManage||!learner||!card} onClick={()=>void run(issue,'Funda ID issued.')}>Issue ID</Button></div><div className="mt-5"><Rows rows={cards} fields={['card_number','status','issued_at','expires_at']}/></div></Section><Section title="Smart Gate"><div className="space-y-3"><Select value={learner} onChange={setLearner}><option value="">Select learner</option>{learners.map(x=><option key={String(x.id)} value={String(x.id)}>{String(x.first_name)} {String(x.last_name)}</option>)}</Select><input className={input} value={gate} onChange={e=>setGate(e.target.value)}/><Select value={direction} onChange={setDirection}><option value="in">Entry</option><option value="out">Exit</option></Select><Button disabled={busy||!canManage||!learner} onClick={()=>void run(scan,'Gate scan recorded.')}>Record scan</Button></div><div className="mt-5"><Rows rows={scanRows} fields={['gate','direction','method','scanned_at']}/></div></Section></div>;
}

function SafetyHealth({schoolId,canManage,busy,run}:{schoolId:string;canManage:boolean;busy:boolean;run:(fn:()=>PromiseLike<unknown>,s?:string)=>Promise<void>}) {
  const [rows,setRows]=useState<Row[]>([]); const [learner,setLearner]=useState(''); const [type,setType]=useState('allergy'); const [summary,setSummary]=useState(''); const [allergies,setAllergies]=useState(''); const [medication,setMedication]=useState('');
  const load=useCallback(async()=>{const {data,error}=await fundaDb.from('funda_health_records').select('id,learner_id,record_type,summary,allergies,medication,created_at').eq('school_id',schoolId).order('created_at',{ascending:false});if(error)throw error;setRows((data??[]) as Row[]);},[schoolId]);
  useEffect(()=>{void load().catch(()=>undefined);},[load]);
  const save=async()=>{const {error}=await fundaDb.from('funda_health_records').insert({school_id:schoolId,learner_id:learner,record_type:type,summary,allergies,medication});if(error)throw error;setSummary('');await load();};
  return <div className="grid gap-6 lg:grid-cols-2"><Section title="Safeguarding & health control"><p className="text-sm text-content-secondary">Health records are separately RLS-protected and restricted to authorised medical/senior roles.</p>{canManage&&<div className="mt-4 space-y-3"><input className={input} placeholder="Learner ID" value={learner} onChange={e=>setLearner(e.target.value)}/><input className={input} placeholder="Record type" value={type} onChange={e=>setType(e.target.value)}/><input className={input} placeholder="Summary" value={summary} onChange={e=>setSummary(e.target.value)}/><input className={input} placeholder="Allergies" value={allergies} onChange={e=>setAllergies(e.target.value)}/><input className={input} placeholder="Medication" value={medication} onChange={e=>setMedication(e.target.value)}/><Button disabled={busy||!learner||!summary} onClick={()=>void run(save,'Health record saved.')}>Save health record</Button></div>}</Section><Section title="Health register"><Rows rows={rows} fields={['record_type','summary','allergies','medication','created_at']}/></Section></div>;
}

function TeachingAI({schoolId,canManage,busy,run}:{schoolId:string;canManage:boolean;busy:boolean;run:(fn:()=>PromiseLike<unknown>,s?:string)=>Promise<void>}) {
  const [subject,setSubject]=useState('Mathematics'),[grade,setGrade]=useState('Grade 7'),[topic,setTopic]=useState('Fractions'),[minutes,setMinutes]=useState('45'),[artifact,setArtifact]=useState<Row|null>(null),[history,setHistory]=useState<Row[]>([]);
  const generate=async()=>{const questions=[`Define ${topic} in your own words.`,`Solve a basic ${topic} problem and show your working.`,`Solve a medium ${topic} problem and explain the method.`,`Create a real-world example using ${topic}.`,`Explain a common misconception about ${topic}.`];const output={lesson_plan:{grade,subject,topic,duration_minutes:Number(minutes),objectives:[`Understand ${topic}`,`Apply ${topic} to problems`,`Explain reasoning clearly`],activities:['Warm-up','Teacher modelling','Guided practice','Independent practice','Exit ticket']},assessment:{questions,marks:questions.map((_,i)=>i<2?2:4)},memo:questions.map((q,i)=>({question:q,answer:'Teacher review required',marks:i<2?2:4}))};const {data,error}=await fundaDb.from('funda_ai_artifacts').insert({school_id:schoolId,artifact_type:'lesson_plan',title:`${grade} ${subject}: ${topic}`,prompt:`Create lesson and assessment for ${grade} ${subject} ${topic}`,output,model:'rules'}).select().single();if(error)throw error;setArtifact(data as Row);await load();};
  const load=async()=>{const {data}=await fundaDb.from('funda_ai_artifacts').select('*').eq('school_id',schoolId).in('artifact_type',['lesson_plan','assessment','quiz','memo']).order('created_at',{ascending:false}).limit(20);setHistory((data??[]) as Row[]);};
  useEffect(()=>{void load();},[schoolId]);
  return <div className="grid gap-6 lg:grid-cols-2"><Section title="AI Teacher Studio"><div className="grid gap-3 sm:grid-cols-2"><input className={input} value={grade} onChange={e=>setGrade(e.target.value)} placeholder="Grade"/><input className={input} value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Subject"/><input className={input} value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Topic"/><input className={input} type="number" value={minutes} onChange={e=>setMinutes(e.target.value)} placeholder="Minutes"/></div><Button className="mt-3" disabled={busy||!canManage} onClick={()=>void run(generate,'Lesson plan, assessment and memo generated.')}>Generate teaching pack</Button>{artifact&&<pre className="mt-4 max-h-96 overflow-auto rounded-md bg-surface p-4 text-xs text-content-secondary">{JSON.stringify(artifact.output,null,2)}</pre>}<p className="mt-3 text-xs text-content-tertiary">Generated content is labelled as assistive and remains teacher-reviewable before publication.</p></Section><Section title="Teaching AI history"><Rows rows={history} fields={['artifact_type','title','model','created_at']}/></Section></div>;
}

function Automation({schoolId,canManage,busy,run}:{schoolId:string;canManage:boolean;busy:boolean;run:(fn:()=>PromiseLike<unknown>,s?:string)=>Promise<void>}) {
  const [rows,setRows]=useState<Row[]>([]); const [name,setName]=useState('Attendance escalation'); const [trigger,setTrigger]=useState('learner.absent'); const [action,setAction]=useState('notify_guardian'); const [conditions,setConditions]=useState('{"days":3}');
  const load=useCallback(async()=>{const {data,error}=await fundaDb.from('funda_workflows').select('*').eq('school_id',schoolId).order('created_at',{ascending:false});if(error)throw error;setRows((data??[]) as Row[]);},[schoolId]);
  useEffect(()=>{void load().catch(()=>undefined);},[load]);
  const create=async()=>{const {error}=await fundaDb.rpc('funda_create_workflow',{p_school_id:schoolId,p_name:name,p_trigger_event:trigger,p_conditions:JSON.parse(conditions),p_actions:[{type:action}]});if(error)throw error;await load();};
  return <div className="grid gap-6 lg:grid-cols-2"><Section title="Funda Flow"><Rows rows={rows} fields={['trigger_event','enabled','last_run_at','created_at']}/></Section>{canManage&&<Section title="Workflow builder"><input className={input+' mb-3'} value={name} onChange={e=>setName(e.target.value)}/><input className={input+' mb-3'} value={trigger} onChange={e=>setTrigger(e.target.value)}/><input className={input+' mb-3'} value={action} onChange={e=>setAction(e.target.value)}/><input className={input+' mb-3'} value={conditions} onChange={e=>setConditions(e.target.value)}/><Button disabled={busy} onClick={()=>void run(create,'Workflow saved.')}>Save workflow</Button></Section>}</div>;
}

function Documents({schoolId,canManage,busy,run}:{schoolId:string;canManage:boolean;busy:boolean;run:(fn:()=>PromiseLike<unknown>,s?:string)=>Promise<void>}) {
  const [rows,setRows]=useState<Row[]>([]); const [title,setTitle]=useState(''); const [type,setType]=useState('Consent'); const [learner,setLearner]=useState(''); const [expires,setExpires]=useState('');
  const load=useCallback(async()=>{const {data,error}=await fundaDb.from('funda_documents').select('*').eq('school_id',schoolId).order('created_at',{ascending:false});if(error)throw error;setRows((data??[]) as Row[]);},[schoolId]); useEffect(()=>{void load().catch(()=>undefined);},[load]);
  const create=async()=>{const {error}=await fundaDb.from('funda_documents').insert({school_id:schoolId,title,document_type:type,learner_id:learner||null,expires_on:expires||null,status:'active',visibility:'restricted'});if(error)throw error;setTitle('');await load();};
  return <div className="grid gap-6 lg:grid-cols-2"><Section title="Secure document vault"><Rows rows={rows} fields={['document_type','learner_id','expires_on','status','visibility']}/></Section>{canManage&&<Section title="Register document"><input className={input+' mb-3'} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Document title"/><input className={input+' mb-3'} value={type} onChange={e=>setType(e.target.value)} placeholder="Document type"/><input className={input+' mb-3'} value={learner} onChange={e=>setLearner(e.target.value)} placeholder="Learner ID (optional)"/><input className={input+' mb-3'} type="date" value={expires} onChange={e=>setExpires(e.target.value)}/><Button disabled={busy||!title} onClick={()=>void run(create,'Document registered.')}>Register document</Button><p className="mt-3 text-xs text-content-tertiary">Storage paths are metadata until a school configures its Supabase Storage bucket and retention policy.</p></Section>}</div>;
}

function Trust({schoolId,canManage,busy,run}:{schoolId:string;canManage:boolean;busy:boolean;run:(fn:()=>PromiseLike<unknown>,s?:string)=>Promise<void>}) {
  const [integrations,setIntegrations]=useState<Row[]>([]); const [sandboxes,setSandboxes]=useState<Row[]>([]); const [apps,setApps]=useState<Row[]>([]); const [name,setName]=useState('Demo School Sandbox');
  const load=useCallback(async()=>{const [{data:i},{data:s},{data:a}]=await Promise.all([fundaDb.from('funda_integrations').select('*').eq('school_id',schoolId),fundaDb.from('funda_sandboxes').select('*').eq('school_id',schoolId),fundaDb.from('funda_apps').select('*').or(`school_id.eq.${schoolId},school_id.is.null`)]);setIntegrations((i??[]) as Row[]);setSandboxes((s??[]) as Row[]);setApps((a??[]) as Row[]);},[schoolId]);
  useEffect(()=>{void load().catch(()=>undefined);},[load]);
  const seed=async()=>{const rows=[{school_id:schoolId,integration_key:'sa-sams',display_name:'SA-SAMS exchange',status:'configured'},{school_id:schoolId,integration_key:'cemis',display_name:'CEMIS exchange',status:'configured'},{school_id:schoolId,integration_key:'payments',display_name:'Payment gateway',status:'configured'},{school_id:schoolId,integration_key:'messaging',display_name:'Messaging delivery',status:'configured'}];const {error}=await fundaDb.from('funda_integrations').upsert(rows,{onConflict:'school_id,integration_key'});if(error)throw error;await load();};
  const sandbox=async()=>{const {error}=await fundaDb.from('funda_sandboxes').insert({school_id:schoolId,name,status:'active',snapshot:{created_from:'live_metadata',safe:true}});if(error)throw error;await load();};
  return <div className="grid gap-6 lg:grid-cols-3"><Section title="Trust & integrations"><Rows rows={integrations} fields={['display_name','status','last_sync_at']}/>{canManage&&<Button className="mt-3" disabled={busy} onClick={()=>void run(seed,'Integration registry initialised.')}>Initialise integrations</Button>}</Section><Section title="Sandbox"><Rows rows={sandboxes} fields={['name','status','created_at']}/>{canManage&&<><input className={input+' mt-3'} value={name} onChange={e=>setName(e.target.value)}/><Button className="mt-3" disabled={busy} onClick={()=>void run(sandbox,'Sandbox created.')}>Create sandbox</Button></>}</Section><Section title="App ecosystem"><Rows rows={apps} fields={['category','publisher','status']}/><p className="mt-3 text-xs text-content-tertiary">Marketplace records are tenant-scoped and do not execute third-party code inside Funda360.</p></Section></div>;
}
