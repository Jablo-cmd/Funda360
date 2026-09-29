import { supabase } from '@/lib/supabase';
import type {
  TransportVehicle, TransportDriver, TransportRoute, TransportStop,
  TransportRouteStop, TransportAssignment, TransportSchedule, TransportAttendance,
  TransportSummary, CreateTransportVehicleInput, CreateTransportDriverInput,
  CreateTransportRouteInput, CreateTransportStopInput, CreateTransportAssignmentInput,
  CreateTransportScheduleInput, TransportAssignmentStatus, TransportAttendanceStatus, TransportTripStatus,
} from '@/features/transport/types/transport.types';

async function getSummary(schoolId: string): Promise<TransportSummary> {
  const [vehicles, drivers, routes, assignments, schedules] = await Promise.all([
    supabase.from('transport_vehicles').select('id,status').eq('school_id', schoolId),
    supabase.from('transport_drivers').select('id,status').eq('school_id', schoolId),
    supabase.from('transport_routes').select('id,active').eq('school_id', schoolId),
    supabase.from('transport_assignments').select('id,status').eq('school_id', schoolId),
    supabase.from('transport_schedules').select('id,status,service_date').eq('school_id', schoolId),
  ]);
  for (const result of [vehicles, drivers, routes, assignments, schedules]) if (result.error) throw result.error;
  const upcoming = (schedules.data ?? []).filter((s) => s.service_date >= new Date().toISOString().slice(0, 10) && s.status !== 'completed' && s.status !== 'cancelled');
  return {
    vehicles: vehicles.data?.length ?? 0,
    activeVehicles: vehicles.data?.filter((v) => v.status === 'active').length ?? 0,
    drivers: drivers.data?.length ?? 0,
    activeDrivers: drivers.data?.filter((d) => d.status === 'active').length ?? 0,
    routes: routes.data?.length ?? 0,
    activeRoutes: routes.data?.filter((r) => r.active).length ?? 0,
    activeAssignments: assignments.data?.filter((a) => a.status === 'active').length ?? 0,
    upcomingTrips: upcoming.length,
  };
}

async function createVehicle(schoolId: string, input: CreateTransportVehicleInput): Promise<TransportVehicle> {
  const { data, error } = await supabase.from('transport_vehicles').insert({ school_id: schoolId, ...input }).select('*').single();
  if (error) throw error; return data as TransportVehicle;
}
async function createDriver(schoolId: string, input: CreateTransportDriverInput): Promise<TransportDriver> {
  const { data, error } = await supabase.from('transport_drivers').insert({ school_id: schoolId, ...input }).select('*').single();
  if (error) throw error; return data as TransportDriver;
}
async function createRoute(schoolId: string, input: CreateTransportRouteInput): Promise<TransportRoute> {
  const { data, error } = await supabase.from('transport_routes').insert({ school_id: schoolId, active: true, ...input }).select('*').single();
  if (error) throw error; return data as TransportRoute;
}
async function createStop(schoolId: string, input: CreateTransportStopInput): Promise<TransportStop> {
  const { data, error } = await supabase.from('transport_stops').insert({ school_id: schoolId, active: true, ...input }).select('*').single();
  if (error) throw error; return data as TransportStop;
}
async function createAssignment(schoolId: string, input: CreateTransportAssignmentInput): Promise<TransportAssignment> {
  const { data, error } = await supabase.from('transport_assignments').insert({ school_id: schoolId, status: 'active', ...input }).select('*').single();
  if (error) throw error; return data as TransportAssignment;
}
async function createSchedule(schoolId: string, input: CreateTransportScheduleInput): Promise<TransportSchedule> {
  const { data, error } = await supabase.rpc('create_transport_schedule', {
    p_school_id: schoolId, p_route_id: input.route_id, p_vehicle_id: input.vehicle_id,
    p_driver_id: input.driver_id ?? null, p_service_date: input.service_date,
    p_departure_time: input.departure_time ?? null, p_notes: input.notes ?? null,
  });
  if (error) throw error; return data as TransportSchedule;
}

async function listTransportLearners(schoolId: string) {
  const { data, error } = await supabase.rpc('list_transport_learners', { p_school_id: schoolId });
  if (error) throw error;
  return data ?? [];
}
async function createAssignment(schoolId: string, input: CreateTransportAssignmentInput): Promise<TransportAssignment> {
  const { data, error } = await supabase.rpc('create_transport_assignment', {
    p_school_id: schoolId, p_learner_id: input.learner_id, p_route_id: input.route_id,
    p_pickup_stop_id: input.pickup_stop_id ?? null, p_dropoff_stop_id: input.dropoff_stop_id ?? null,
    p_effective_from: input.effective_from, p_effective_to: input.effective_to ?? null, p_notes: input.notes ?? null,
  });
  if (error) throw error; return data as TransportAssignment;
}
async function addRouteStop(routeId: string, stopId: string, stopOrder: number, pickupTime?: string | null, dropoffTime?: string | null): Promise<TransportRouteStop> {
  const { data, error } = await supabase.rpc('add_transport_route_stop', {
    p_route_id: routeId, p_stop_id: stopId, p_stop_order: stopOrder,
    p_pickup_time: pickupTime ?? null, p_dropoff_time: dropoffTime ?? null,
  });
  if (error) throw error; return data as TransportRouteStop;
}
async function listRouteStops(routeId: string): Promise<TransportRouteStop[]> {
  const { data, error } = await supabase.from('transport_route_stops').select('*').eq('route_id', routeId).order('stop_order');
  if (error) throw error; return (data ?? []) as TransportRouteStop[];
}
async function getRoster(scheduleId: string) {
  const { data, error } = await supabase.rpc('get_transport_roster', { p_schedule_id: scheduleId });
  if (error) throw error; return data ?? [];
}
async function createTransportCharge(learnerId: string, feeStructureId: string, dueDate?: string | null, notes?: string | null) {
  const { data, error } = await supabase.rpc('create_transport_charge', {
    p_learner_id: learnerId, p_fee_structure_id: feeStructureId, p_due_date: dueDate ?? null, p_notes: notes ?? null,
  });
  if (error) throw error; return data;
}

async function listAttendance(scheduleId: string): Promise<TransportAttendance[]> {
  const { data, error } = await supabase.from('transport_attendance').select('*').eq('schedule_id', scheduleId).order('recorded_at');
  if (error) throw error; return (data ?? []) as TransportAttendance[];
}
async function setAssignmentStatus(id: string, status: TransportAssignmentStatus): Promise<TransportAssignment> {
  const { data, error } = await supabase.rpc('set_transport_assignment_status', { p_assignment_id: id, p_status: status });
  if (error) throw error; return data as TransportAssignment;
}
async function setTripStatus(id: string, status: TransportTripStatus): Promise<TransportSchedule> {
  const { data, error } = await supabase.rpc('set_transport_trip_status', { p_schedule_id: id, p_status: status });
  if (error) throw error; return data as TransportSchedule;
}
async function recordAttendance(scheduleId: string, learnerId: string, status: TransportAttendanceStatus, notes?: string | null): Promise<TransportAttendance> {
  const { data, error } = await supabase.rpc('record_transport_attendance', {
    p_schedule_id: scheduleId, p_learner_id: learnerId, p_status: status, p_notes: notes ?? null,
  });
  if (error) throw error; return data as TransportAttendance;
}

export const transportService = {
  getSummary, createVehicle, createDriver, createRoute, createStop, createAssignment, createSchedule,
  listAttendance, listTransportLearners, createAssignment, addRouteStop, listRouteStops, getRoster, createTransportCharge, setAssignmentStatus, setTripStatus, recordAttendance,
};
