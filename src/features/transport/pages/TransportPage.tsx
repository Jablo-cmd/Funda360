import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { useSchool } from '@/features/school/hooks/useSchool';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/lib/supabase';
import { transportService } from '@/features/transport/services/transportService';
import type { TransportDriver, TransportRoute, TransportSchedule, TransportStop, TransportVehicle, TransportSummary } from '@/features/transport/types/transport.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

const inputClass = 'focus-ring w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-content-primary';
const today = () => new Date().toISOString().slice(0, 10);

export function TransportPage() {
  const { school } = useSchool();
  const { can } = usePermissions();
  const canManage = can('transport.manage');
  const [summary, setSummary] = useState<TransportSummary | null>(null);
  const [vehicles, setVehicles] = useState<TransportVehicle[]>([]);
  const [drivers, setDrivers] = useState<TransportDriver[]>([]);
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [stops, setStops] = useState<TransportStop[]>([]);
  const [schedules, setSchedules] = useState<TransportSchedule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!school) return;
    setError(null);
    try {
      const [nextSummary, v, d, r, s, tripRows] = await Promise.all([
        transportService.getSummary(school.id),
        supabase.from('transport_vehicles').select('*').eq('school_id', school.id).order('registration_number'),
        supabase.from('transport_drivers').select('*').eq('school_id', school.id).order('last_name'),
        supabase.from('transport_routes').select('*').eq('school_id', school.id).order('name'),
        supabase.from('transport_stops').select('*').eq('school_id', school.id).order('name'),
        supabase.from('transport_schedules').select('*').eq('school_id', school.id).gte('service_date', today()).order('service_date').limit(20),
      ]);
      for (const result of [v, d, r, s, tripRows]) if (result.error) throw result.error;
      setSummary(nextSummary);
      setVehicles((v.data ?? []) as TransportVehicle[]);
      setDrivers((d.data ?? []) as TransportDriver[]);
      setRoutes((r.data ?? []) as TransportRoute[]);
      setStops((s.data ?? []) as TransportStop[]);
      setSchedules((tripRows.data ?? []) as TransportSchedule[]);
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load transport operations.'));
    }
  }, [school]);

  useEffect(() => { void load(); }, [load]);

  const [vehicleReg, setVehicleReg] = useState('');
  const [vehicleCapacity, setVehicleCapacity] = useState('20');
  const [driverFirst, setDriverFirst] = useState('');
  const [driverLast, setDriverLast] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [routeName, setRouteName] = useState('');
  const [routeCode, setRouteCode] = useState('');
  const [stopName, setStopName] = useState('');
  const [stopAddress, setStopAddress] = useState('');
  const [tripDate, setTripDate] = useState(today());

  const create = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); await load(); }
    catch (err) { setError(getDbErrorMessage(err, 'Transport operation failed.')); }
    finally { setBusy(false); }
  };

  if (!school) return <PageContainer><PageHeader title="Transport" description="Manage school transport safely and centrally." /><NoActiveSchoolNotice resource="transport operations" /></PageContainer>;

  return (
    <PageContainer>
      <PageHeader title="Transport Operations" description="Fleet, drivers, routes, learner transport and daily trip operations." />
      <ErrorAlert message={error} />

      {summary ? (
        <dl className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
          {[
            ['Vehicles', summary.vehicles], ['Active fleet', summary.activeVehicles], ['Drivers', summary.drivers],
            ['Active drivers', summary.activeDrivers], ['Routes', summary.routes], ['Active routes', summary.activeRoutes],
            ['Learners assigned', summary.activeAssignments], ['Upcoming trips', summary.upcomingTrips],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-card border border-border bg-surface-raised p-4 shadow-card dark:shadow-card-dark">
              <dt className="text-xs text-content-tertiary">{label}</dt>
              <dd className="mt-1 text-2xl font-semibold text-content-primary">{value}</dd>
            </div>
          ))}
        </dl>
      ) : <LoadingBlock label="Loading transport operations…" />}

      {canManage && (
        <div className="grid gap-6 xl:grid-cols-4">
          <FormCard title="Add vehicle">
            <input className={inputClass} placeholder="Registration number" value={vehicleReg} onChange={e => setVehicleReg(e.target.value)} />
            <input className={inputClass} type="number" min="1" placeholder="Capacity" value={vehicleCapacity} onChange={e => setVehicleCapacity(e.target.value)} />
            <Button disabled={busy || !vehicleReg.trim()} onClick={() => void create(() => transportService.createVehicle(school.id, { registration_number: vehicleReg.trim(), capacity: Number(vehicleCapacity) }))}>Add vehicle</Button>
          </FormCard>
          <FormCard title="Add driver">
            <input className={inputClass} placeholder="First name" value={driverFirst} onChange={e => setDriverFirst(e.target.value)} />
            <input className={inputClass} placeholder="Last name" value={driverLast} onChange={e => setDriverLast(e.target.value)} />
            <input className={inputClass} placeholder="Phone" value={driverPhone} onChange={e => setDriverPhone(e.target.value)} />
            <Button disabled={busy || !driverFirst.trim() || !driverLast.trim()} onClick={() => void create(async () => { await transportService.createDriver(school.id, { first_name: driverFirst.trim(), last_name: driverLast.trim(), phone: driverPhone || null }); setDriverFirst(''); setDriverLast(''); setDriverPhone(''); })}>Add driver</Button>
          </FormCard>
          <FormCard title="Add route">
            <input className={inputClass} placeholder="Route name" value={routeName} onChange={e => setRouteName(e.target.value)} />
            <input className={inputClass} placeholder="Code" value={routeCode} onChange={e => setRouteCode(e.target.value)} />
            <Button disabled={busy || !routeName.trim() || !routeCode.trim()} onClick={() => void create(async () => { await transportService.createRoute(school.id, { name: routeName.trim(), code: routeCode.trim(), direction: 'morning' }); setRouteName(''); setRouteCode(''); })}>Add route</Button>
          </FormCard>
          <FormCard title="Add stop">
            <input className={inputClass} placeholder="Stop name" value={stopName} onChange={e => setStopName(e.target.value)} />
            <input className={inputClass} placeholder="Address" value={stopAddress} onChange={e => setStopAddress(e.target.value)} />
            <Button disabled={busy || !stopName.trim()} onClick={() => void create(async () => { await transportService.createStop(school.id, { name: stopName.trim(), address: stopAddress || null }); setStopName(''); setStopAddress(''); })}>Add stop</Button>
          </FormCard>
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <DataCard title="Fleet">
          {vehicles.length === 0 ? <Empty /> : vehicles.map(v => <Row key={v.id} title={v.registration_number} detail={`${v.capacity} seats · ${v.status}`} />)}
        </DataCard>
        <DataCard title="Drivers">
          {drivers.length === 0 ? <Empty /> : drivers.map(d => <Row key={d.id} title={`${d.first_name} ${d.last_name}`} detail={d.phone ?? 'No phone'} />)}
        </DataCard>
        <DataCard title="Routes">
          {routes.length === 0 ? <Empty /> : routes.map(r => <Row key={r.id} title={`${r.name} · ${r.code}`} detail={r.direction} />)}
        </DataCard>
        <DataCard title="Stops">
          {stops.length === 0 ? <Empty /> : stops.map(s => <Row key={s.id} title={s.name} detail={s.address ?? 'Address not recorded'} />)}
        </DataCard>
      </section>

      {canManage && routes.length > 0 && vehicles.length > 0 && (
        <FormCard title="Schedule a trip">
          <div className="grid gap-3 md:grid-cols-4">
            <select className={inputClass} defaultValue={routes[0].id} id="transport-route">
              {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <select className={inputClass} defaultValue={vehicles[0].id} id="transport-vehicle">
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_number}</option>)}
            </select>
            <input className={inputClass} type="date" value={tripDate} onChange={e => setTripDate(e.target.value)} />
            <Button disabled={busy} onClick={() => {
              const routeId = (document.getElementById('transport-route') as HTMLSelectElement).value;
              const vehicleId = (document.getElementById('transport-vehicle') as HTMLSelectElement).value;
              void create(() => transportService.createSchedule(school.id, { route_id: routeId, vehicle_id: vehicleId, service_date: tripDate }));
            }}>Schedule</Button>
          </div>
        </FormCard>
      )}

      <DataCard title="Upcoming trips">
        {schedules.length === 0 ? <Empty /> : schedules.map(s => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3 last:border-0">
            <div><p className="text-sm font-medium text-content-primary">{s.service_date}</p><p className="text-xs text-content-tertiary">{s.status}</p></div>
            {canManage && s.status !== 'completed' && s.status !== 'cancelled' && <Button variant="secondary" disabled={busy} onClick={() => void create(() => transportService.setTripStatus(s.id, s.status === 'scheduled' ? 'boarding' : 'completed'))}>{s.status === 'scheduled' ? 'Start boarding' : 'Complete trip'}</Button>}
          </div>
        ))}
      </DataCard>
    </PageContainer>
  );
}

function FormCard({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-card border border-border bg-surface-raised p-4 shadow-card dark:shadow-card-dark"><h2 className="mb-4 text-sm font-semibold text-content-primary">{title}</h2><div className="flex flex-col gap-3">{children}</div></section>;
}
function DataCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-card border border-border bg-surface-raised p-4 shadow-card dark:shadow-card-dark"><h2 className="mb-3 text-sm font-semibold text-content-primary">{title}</h2>{children}</section>;
}
function Row({ title, detail }: { title: string; detail: string }) {
  return <div className="border-b border-border py-2.5 last:border-0"><p className="text-sm font-medium text-content-primary">{title}</p><p className="text-xs text-content-tertiary">{detail}</p></div>;
}
function Empty() { return <p className="py-3 text-sm text-content-tertiary">Nothing configured yet.</p>; }
