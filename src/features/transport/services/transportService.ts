import { supabase } from '@/lib/supabase';
import type {
  TransportVehicle, TransportDriver, TransportRoute, TransportStop,
  TransportRouteStop, TransportAssignment, TransportSchedule, TransportAttendance,
  TransportSummary, CreateTransportVehicleInput, CreateTransportDriverInput,
  CreateTransportRouteInput, CreateTransportStopInput, CreateTransportAssignmentInput,
  CreateTransportScheduleInput, TransportAssignmentStatus, TransportAttendanceStatus, TransportTripStatus,
} from '@/features/transport/types/transport.types';

async function list<T extends string>(
  table: T,
  schoolId: string,
): Promise<any[]> {
  const { data, error } = await supabase.from(table as any).select('*').eq('school_id', schoolId);
  if (error) throw error;
  return data ?? [];
}

async function getSummary(schoolId: string): Promise<TransportSummary> {
  const [vehicles, drivers, routes, assignments, schedules] = await Promise.all([
    list('transport_vehicles', schoolId),
    list('transport_drivers', schoolId),
    list('transport_routes', schoolId),
    list('transport_assignments', schoolId),
    supabase.from('transport_schedules').select('id,status,service_date').eq('school_id', schoolId),
  ]);
  const upcoming = (schedules.data ?? []).filter((s) => s.service_date >= new Date().toISOString().slice(0, 10) && s.status !== 'completed' && s.status !== 'cancelled');
  return {
    vehicles: vehicles.length,
    activeVehicles: vehicles.filter((v) => v.status === 'active').length,
    drivers: drivers.length,
    activeDrivers: drivers.filter((d) => d.status === 'active').length,
    routes: routes.length,
    activeRoutes: routes.filter((r) => r.active).length,
    activeAssignments: assignments.filter((a) => a.status === 'active').length,
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
  const { data, error } = await supabase.from('transport_schedules').insert({ school_id: schoolId, status: 'scheduled', ...input }).select('*').single();
  if (error) throw error; return data as TransportSchedule;
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
  listAttendance, setAssignmentStatus, setTripStatus, recordAttendance,
};
