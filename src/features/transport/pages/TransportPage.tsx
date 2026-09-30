import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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
import type {
  TransportDriver, TransportRoute, TransportRouteStop, TransportSchedule, TransportStop,
  TransportVehicle, TransportSummary, TransportAssignment,
  TransportAttendanceStatus,
} from '@/features/transport/types/transport.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

const inputClass = 'focus-ring w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-content-primary';
const today = () => new Date().toISOString().slice(0, 10);

type TransportLearner = { id: string; learner_number: string; first_name: string; last_name: string };
type FeeStructure = { id: string; name: string; amount: number; academic_year_id: string };
type RosterRow = {
  learner_id: string; learner_number: string; first_name: string; last_name: string;
  pickup_stop_id: string | null; dropoff_stop_id: string | null;
  attendance_status: TransportAttendanceStatus | null; recorded_at: string | null;
};

export function TransportPage() {
  const { school } = useSchool();
  const { can } = usePermissions();
  const canManage = can('transport.manage');
  const canManageFees = can('learner.manage_financial');

  const [summary, setSummary] = useState<TransportSummary | null>(null);
  const [vehicles, setVehicles] = useState<TransportVehicle[]>([]);
  const [drivers, setDrivers] = useState<TransportDriver[]>([]);
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [stops, setStops] = useState<TransportStop[]>([]);
  const [schedules, setSchedules] = useState<TransportSchedule[]>([]);
  const [assignments, setAssignments] = useState<TransportAssignment[]>([]);
  const [learners, setLearners] = useState<TransportLearner[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [routeStops, setRouteStops] = useState<TransportRouteStop[]>([]);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!school) return;
    setError(null);
    try {
      const [nextSummary, v, d, r, s, tripRows, a] = await Promise.all([
        transportService.getSummary(school.id),
        supabase.from('transport_vehicles').select('*').eq('school_id', school.id).order('registration_number'),
        supabase.from('transport_drivers').select('*').eq('school_id', school.id).order('last_name'),
        supabase.from('transport_routes').select('*').eq('school_id', school.id).order('name'),
        supabase.from('transport_stops').select('*').eq('school_id', school.id).order('name'),
        supabase.from('transport_schedules').select('*').eq('school_id', school.id).gte('service_date', today()).order('service_date').order('departure_time').limit(50),
        supabase.from('transport_assignments').select('*').eq('school_id', school.id).eq('status', 'active').order('effective_from'),
      ]);
      for (const result of [v, d, r, s, tripRows, a]) if (result.error) throw result.error;

      setSummary(nextSummary);
      setVehicles((v.data ?? []) as TransportVehicle[]);
      setDrivers((d.data ?? []) as TransportDriver[]);
      setRoutes((r.data ?? []) as TransportRoute[]);
      setStops((s.data ?? []) as TransportStop[]);
      setSchedules((tripRows.data ?? []) as TransportSchedule[]);
      setAssignments((a.data ?? []) as TransportAssignment[]);

      if (canManage) {
        setLearners(await transportService.listTransportLearners(school.id));
      }
      if (canManageFees) {
        const fees = await supabase.from('fee_structures').select('id,name,amount,academic_year_id').eq('school_id', school.id).eq('category', 'transport').eq('active', true).order('name');
        if (fees.error) throw fees.error;
        setFeeStructures((fees.data ?? []) as FeeStructure[]);
      }
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load transport operations.'));
    }
  }, [school, canManage, canManageFees]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!selectedRouteId && routes[0]) setSelectedRouteId(routes[0].id);
    if (!selectedScheduleId && schedules[0]) setSelectedScheduleId(schedules[0].id);
  }, [routes, schedules, selectedRouteId, selectedScheduleId]);

  const loadRouteStops = useCallback(async () => {
    if (!selectedRouteId) { setRouteStops([]); return; }
    try { setRouteStops(await transportService.listRouteStops(selectedRouteId)); }
    catch (err) { setError(getDbErrorMessage(err, 'Failed to load route stops.')); }
  }, [selectedRouteId]);

  const loadRoster = useCallback(async () => {
    if (!selectedScheduleId || !canManage) { setRoster([]); return; }
    try { setRoster((await transportService.getRoster(selectedScheduleId)) as RosterRow[]); }
    catch (err) { setError(getDbErrorMessage(err, 'Failed to load the trip roster.')); }
  }, [selectedScheduleId, canManage]);

  useEffect(() => { void loadRouteStops(); }, [loadRouteStops]);
  useEffect(() => { void loadRoster(); }, [loadRoster]);

  const [vehicleReg, setVehicleReg] = useState('');
  const [vehicleCapacity, setVehicleCapacity] = useState('20');
  const [driverFirst, setDriverFirst] = useState('');
  const [driverLast, setDriverLast] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [routeName, setRouteName] = useState('');
  const [routeCode, setRouteCode] = useState('');
  const [routeDirection, setRouteDirection] = useState<'morning'|'afternoon'|'both'>('morning');
  const [stopName, setStopName] = useState('');
  const [stopAddress, setStopAddress] = useState('');
  const [assignmentLearner, setAssignmentLearner] = useState('');
  const [assignmentRoute, setAssignmentRoute] = useState('');
  const [assignmentPickup, setAssignmentPickup] = useState('');
  const [assignmentDropoff, setAssignmentDropoff] = useState('');
  const [assignmentFrom, setAssignmentFrom] = useState(today());
  const [routeStopId, setRouteStopId] = useState('');
  const [routeStopOrder, setRouteStopOrder] = useState('1');
  const [tripDate, setTripDate] = useState(today());
  const [tripRoute, setTripRoute] = useState('');
  const [tripVehicle, setTripVehicle] = useState('');
  const [tripDriver, setTripDriver] = useState('');
  const [feeStructure, setFeeStructure] = useState('');
  const [feeDueDate, setFeeDueDate] = useState('');
  const [feeLearner, setFeeLearner] = useState('');

  useEffect(() => {
    if (!assignmentRoute && routes[0]) setAssignmentRoute(routes[0].id);
    if (!tripRoute && routes[0]) setTripRoute(routes[0].id);
    if (!tripVehicle && vehicles[0]) setTripVehicle(vehicles[0].id);
    if (!tripDriver && drivers[0]) setTripDriver(drivers[0].id);
    if (!assignmentLearner && learners[0]) setAssignmentLearner(learners[0].id);
    if (!feeLearner && learners[0]) setFeeLearner(learners[0].id);
    if (!feeStructure && feeStructures[0]) setFeeStructure(feeStructures[0].id);
  }, [routes, vehicles, drivers, learners, feeStructures, assignmentRoute, tripRoute, tripVehicle, tripDriver, assignmentLearner, feeLearner, feeStructure]);

  const selectedTrip = useMemo(() => schedules.find(s => s.id === selectedScheduleId) ?? null, [schedules, selectedScheduleId]);

  const create = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); await load(); await loadRouteStops(); await loadRoster(); }
    catch (err) { setError(getDbErrorMessage(err, 'Transport operation failed.')); }
    finally { setBusy(false); }
  };

  const markAttendance = async (learnerId: string, status: TransportAttendanceStatus) => {
    if (!selectedScheduleId) return;
    await create(() => transportService.recordAttendance(selectedScheduleId, learnerId, status));
  };

  const exportRoster = () => {
    const header = ['Learner number','Learner','Pickup','Drop-off','Status'];
    const rows = roster.map(r => [
      r.learner_number, `${r.first_name} ${r.last_name}`,
      stops.find(s => s.id === r.pickup_stop_id)?.name ?? '',
      stops.find(s => s.id === r.dropoff_stop_id)?.name ?? '',
      r.attendance_status ?? 'not recorded',
    ]);
    const csv = [header, ...rows].map(row => row.map(value => `"${String(value).replaceAll('"','""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `funda360-transport-roster-${selectedTrip?.service_date ?? today()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (!school) return <PageContainer><PageHeader title="Transport" description="Manage school transport safely and centrally." /><NoActiveSchoolNotice resource="transport operations" /></PageContainer>;

  return (
    <PageContainer>
      <PageHeader title="Transport Operations" description="Fleet, drivers, routes, learner assignments and daily trip operations." />
      <ErrorAlert message={error} />

      {summary ? (
        <dl className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
          {[
            ['Vehicles', summary.vehicles], ['Active fleet', summary.activeVehicles], ['Drivers', summary.drivers],
            ['Active drivers', summary.activeDrivers], ['Routes', summary.routes], ['Active routes', summary.activeRoutes],
            ['Learners assigned', summary.activeAssignments], ['Upcoming trips', summary.upcomingTrips],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-card border border-border bg-surface-raised p-4 shadow-card dark:shadow-card-dark">
              <dt className="text-xs text-content-tertiary">{label}</dt><dd className="mt-1 text-2xl font-semibold text-content-primary">{value}</dd>
            </div>
          ))}
        </dl>
      ) : <LoadingBlock label="Loading transport operations…" />}

      {canManage && (
        <>
          <div className="grid gap-6 xl:grid-cols-4">
            <FormCard title="Add vehicle">
              <input className={inputClass} aria-label="Registration number" placeholder="Registration number" value={vehicleReg} onChange={e => setVehicleReg(e.target.value)} />
              <input className={inputClass} type="number" min="1" aria-label="Capacity" placeholder="Capacity" value={vehicleCapacity} onChange={e => setVehicleCapacity(e.target.value)} />
              <Button disabled={busy || !vehicleReg.trim()} onClick={() => void create(async () => { await transportService.createVehicle(school.id, { registration_number: vehicleReg.trim(), capacity: Number(vehicleCapacity) }); setVehicleReg(''); })}>Add vehicle</Button>
            </FormCard>
            <FormCard title="Add driver">
              <input className={inputClass} aria-label="First name" placeholder="First name" value={driverFirst} onChange={e => setDriverFirst(e.target.value)} />
              <input className={inputClass} aria-label="Last name" placeholder="Last name" value={driverLast} onChange={e => setDriverLast(e.target.value)} />
              <input className={inputClass} aria-label="Phone" placeholder="Phone" value={driverPhone} onChange={e => setDriverPhone(e.target.value)} />
              <Button disabled={busy || !driverFirst.trim() || !driverLast.trim()} onClick={() => void create(async () => { await transportService.createDriver(school.id, { first_name: driverFirst.trim(), last_name: driverLast.trim(), phone: driverPhone || null }); setDriverFirst(''); setDriverLast(''); setDriverPhone(''); })}>Add driver</Button>
            </FormCard>
            <FormCard title="Add route">
              <input className={inputClass} aria-label="Route name" placeholder="Route name" value={routeName} onChange={e => setRouteName(e.target.value)} />
              <input className={inputClass} aria-label="Code" placeholder="Code" value={routeCode} onChange={e => setRouteCode(e.target.value)} />
              <select className={inputClass} aria-label="Route direction" value={routeDirection} onChange={e => setRouteDirection(e.target.value as 'morning'|'afternoon'|'both')}><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="both">Both</option></select>
              <Button disabled={busy || !routeName.trim() || !routeCode.trim()} onClick={() => void create(async () => { const r = await transportService.createRoute(school.id, { name: routeName.trim(), code: routeCode.trim(), direction: routeDirection }); setRouteName(''); setRouteCode(''); setSelectedRouteId(r.id); })}>Add route</Button>
            </FormCard>
            <FormCard title="Add stop">
              <input className={inputClass} aria-label="Stop name" placeholder="Stop name" value={stopName} onChange={e => setStopName(e.target.value)} />
              <input className={inputClass} aria-label="Address" placeholder="Address" value={stopAddress} onChange={e => setStopAddress(e.target.value)} />
              <Button disabled={busy || !stopName.trim()} onClick={() => void create(async () => { await transportService.createStop(school.id, { name: stopName.trim(), address: stopAddress || null }); setStopName(''); setStopAddress(''); })}>Add stop</Button>
            </FormCard>
          </div>

          <section className="grid gap-6 lg:grid-cols-2">
            <FormCard title="Build route stops">
              <select className={inputClass} aria-label="Route" value={selectedRouteId} onChange={e => setSelectedRouteId(e.target.value)}><option value="">Select route</option>{routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
              <select className={inputClass} aria-label="Stop to add" value={routeStopId} onChange={e => setRouteStopId(e.target.value)}><option value="">Select stop</option>{stops.filter(s => !routeStops.some(rs => rs.stop_id === s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <input className={inputClass} type="number" min="1" aria-label="Stop order" value={routeStopOrder} onChange={e => setRouteStopOrder(e.target.value)} />
              <Button disabled={busy || !selectedRouteId || !routeStopId} onClick={() => void create(() => transportService.addRouteStop(selectedRouteId, routeStopId, Number(routeStopOrder)))}>Add stop to route</Button>
              <div className="space-y-2">{routeStops.map(rs => <Row key={rs.id} title={`#${rs.stop_order} · ${stops.find(s => s.id === rs.stop_id)?.name ?? 'Stop'}`} detail={rs.pickup_time ?? rs.dropoff_time ?? 'No scheduled time'} />)}</div>
            </FormCard>

            <FormCard title="Assign learner to transport">
              <select className={inputClass} aria-label="Learner" value={assignmentLearner} onChange={e => setAssignmentLearner(e.target.value)}><option value="">Select learner</option>{learners.map(l => <option key={l.id} value={l.id}>{l.last_name}, {l.first_name} · {l.learner_number}</option>)}</select>
              <select className={inputClass} aria-label="Route" value={assignmentRoute} onChange={e => setAssignmentRoute(e.target.value)}><option value="">Select route</option>{routes.filter(r => r.active).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
              <select className={inputClass} aria-label="Pickup stop" value={assignmentPickup} onChange={e => setAssignmentPickup(e.target.value)}><option value="">Pickup stop (optional)</option>{stops.filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <select className={inputClass} aria-label="Drop-off stop" value={assignmentDropoff} onChange={e => setAssignmentDropoff(e.target.value)}><option value="">Drop-off stop (optional)</option>{stops.filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <input className={inputClass} type="date" aria-label="Assignment start date" value={assignmentFrom} onChange={e => setAssignmentFrom(e.target.value)} />
              <Button disabled={busy || !assignmentLearner || !assignmentRoute} onClick={() => void create(() => transportService.createAssignment(school.id, { learner_id: assignmentLearner, route_id: assignmentRoute, pickup_stop_id: assignmentPickup || null, dropoff_stop_id: assignmentDropoff || null, effective_from: assignmentFrom }))}>Assign learner</Button>
            </FormCard>
          </section>

          <FormCard title="Schedule a trip">
            <div className="grid gap-3 md:grid-cols-5">
              <select className={inputClass} aria-label="Trip route" value={tripRoute} onChange={e => setTripRoute(e.target.value)}><option value="">Route</option>{routes.filter(r => r.active).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
              <select className={inputClass} aria-label="Vehicle" value={tripVehicle} onChange={e => setTripVehicle(e.target.value)}><option value="">Vehicle</option>{vehicles.filter(v => v.status === 'active').map(v => <option key={v.id} value={v.id}>{v.registration_number} · {v.capacity} seats</option>)}</select>
              <select className={inputClass} aria-label="Driver" value={tripDriver} onChange={e => setTripDriver(e.target.value)}><option value="">Driver (optional)</option>{drivers.filter(d => d.status === 'active').map(d => <option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>)}</select>
              <input className={inputClass} type="date" aria-label="Trip date" value={tripDate} onChange={e => setTripDate(e.target.value)} />
              <Button disabled={busy || !tripRoute || !tripVehicle} onClick={() => void create(async () => { const trip = await transportService.createSchedule(school.id, { route_id: tripRoute, vehicle_id: tripVehicle, driver_id: tripDriver || null, service_date: tripDate }); setSelectedScheduleId(trip.id); })}>Schedule trip</Button>
            </div>
          </FormCard>
        </>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <DataCard title="Active assignments">
          {assignments.length === 0 ? <Empty /> : assignments.map(a => {
            const learner = learners.find(l => l.id === a.learner_id);
            return <Row key={a.id} title={learner ? `${learner.last_name}, ${learner.first_name}` : 'Assigned learner'} detail={routes.find(r => r.id === a.route_id)?.name ?? 'Route'} />;
          })}
        </DataCard>
        <DataCard title="Upcoming trips">
          {schedules.length === 0 ? <Empty /> : schedules.map(s => (
            <button type="button" key={s.id} onClick={() => setSelectedScheduleId(s.id)} className="block w-full border-b border-border py-3 text-left last:border-0 hover:bg-surface-sunken">
              <p className="text-sm font-medium text-content-primary">{s.service_date} · {routes.find(r => r.id === s.route_id)?.name ?? 'Route'}</p>
              <p className="text-xs capitalize text-content-tertiary">{s.status} · {vehicles.find(v => v.id === s.vehicle_id)?.registration_number ?? 'Vehicle'}</p>
            </button>
          ))}
        </DataCard>
      </section>

      {canManage && selectedTrip && (
        <DataCard title={`Trip register · ${selectedTrip.service_date}`}>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <select className={inputClass + ' max-w-sm'} aria-label="Trip schedule" value={selectedScheduleId} onChange={e => setSelectedScheduleId(e.target.value)}>{schedules.map(s => <option key={s.id} value={s.id}>{s.service_date} · {routes.find(r => r.id === s.route_id)?.name ?? 'Route'}</option>)}</select>
            <Button variant="secondary" onClick={exportRoster} disabled={roster.length === 0}>Export roster</Button>
            <Button disabled={busy} onClick={() => void create(() => transportService.setTripStatus(selectedTrip.id, selectedTrip.status === 'scheduled' ? 'boarding' : selectedTrip.status === 'boarding' ? 'in_progress' : 'completed'))}>{selectedTrip.status === 'scheduled' ? 'Start boarding' : selectedTrip.status === 'boarding' ? 'Start trip' : selectedTrip.status === 'in_progress' ? 'Complete trip' : selectedTrip.status}</Button>
          </div>
          {roster.length === 0 ? <Empty /> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead><tr className="border-b border-border text-left text-xs text-content-tertiary"><th className="px-3 py-2">Learner</th><th className="px-3 py-2">Pickup</th><th className="px-3 py-2">Drop-off</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Action</th></tr></thead><tbody>{roster.map(r => <tr key={r.learner_id} className="border-b border-border last:border-0"><td className="px-3 py-3 font-medium text-content-primary">{r.last_name}, {r.first_name}<span className="ml-2 text-xs text-content-tertiary">{r.learner_number}</span></td><td className="px-3 py-3 text-content-secondary">{stops.find(s => s.id === r.pickup_stop_id)?.name ?? '—'}</td><td className="px-3 py-3 text-content-secondary">{stops.find(s => s.id === r.dropoff_stop_id)?.name ?? '—'}</td><td className="px-3 py-3 capitalize text-content-secondary">{r.attendance_status?.replaceAll('_',' ') ?? 'Not recorded'}</td><td className="px-3 py-3"><div className="flex flex-wrap gap-2">{(['boarded','picked_up','dropped_off','absent','no_show'] as TransportAttendanceStatus[]).map(status => <Button key={status} variant="secondary" disabled={busy} onClick={() => void markAttendance(r.learner_id,status)}>{status.replaceAll('_',' ')}</Button>)}</div></td></tr>)}</tbody></table></div>}
        </DataCard>
      )}

      {canManageFees && feeStructures.length > 0 && (
        <FormCard title="Transport fee integration">
          <p className="text-xs text-content-tertiary">Charges use Funda360's existing fee ledger and active transport fee structures. Duplicate matching charges are rejected.</p>
          <div className="grid gap-3 md:grid-cols-4">
            <select className={inputClass} aria-label="Learner to bill" value={feeLearner} onChange={e => setFeeLearner(e.target.value)}>{learners.map(l => <option key={l.id} value={l.id}>{l.last_name}, {l.first_name}</option>)}</select>
            <select className={inputClass} aria-label="Fee structure" value={feeStructure} onChange={e => setFeeStructure(e.target.value)}>{feeStructures.map(f => <option key={f.id} value={f.id}>{f.name} · R{Number(f.amount).toFixed(2)}</option>)}</select>
            <input className={inputClass} type="date" aria-label="Fee due date" value={feeDueDate} onChange={e => setFeeDueDate(e.target.value)} />
            <Button disabled={busy || !feeLearner || !feeStructure} onClick={() => void create(() => transportService.createTransportCharge(feeLearner, feeStructure, feeDueDate || null))}>Raise transport charge</Button>
          </div>
        </FormCard>
      )}
    </PageContainer>
  );
}

function FormCard({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-card border border-border bg-surface-raised p-4 shadow-card dark:shadow-card-dark"><h2 className="mb-4 text-sm font-semibold text-content-primary">{title}</h2><div className="flex flex-col gap-3">{children}</div></section>;
}
function DataCard({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-card border border-border bg-surface-raised p-4 shadow-card dark:shadow-card-dark"><h2 className="mb-3 text-sm font-semibold text-content-primary">{title}</h2>{children}</section>;
}
function Row({ title, detail }: { title: string; detail: string }) {
  return <div className="border-b border-border py-2.5 last:border-0"><p className="text-sm font-medium text-content-primary">{title}</p><p className="text-xs text-content-tertiary">{detail}</p></div>;
}
function Empty() { return <p className="py-3 text-sm text-content-tertiary">Nothing configured yet.</p>; }
