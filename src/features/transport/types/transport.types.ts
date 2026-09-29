import type {
  TransportVehicleRow, TransportDriverRow, TransportRouteRow, TransportStopRow,
  TransportRouteStopRow, TransportAssignmentRow, TransportScheduleRow,
  TransportAttendanceRow, TransportVehicleStatus, TransportDriverStatus,
  TransportAssignmentStatus, TransportTripStatus, TransportAttendanceStatus,
} from '@/lib/database.types';

export type { TransportVehicleStatus, TransportDriverStatus, TransportAssignmentStatus, TransportTripStatus, TransportAttendanceStatus };

export interface TransportVehicle extends TransportVehicleRow {}
export interface TransportDriver extends TransportDriverRow {}
export interface TransportRoute extends TransportRouteRow {}
export interface TransportStop extends TransportStopRow {}
export interface TransportRouteStop extends TransportRouteStopRow {}
export interface TransportAssignment extends TransportAssignmentRow {}
export interface TransportSchedule extends TransportScheduleRow {}
export interface TransportAttendance extends TransportAttendanceRow {}

export interface TransportSummary {
  vehicles: number;
  activeVehicles: number;
  drivers: number;
  activeDrivers: number;
  routes: number;
  activeRoutes: number;
  activeAssignments: number;
  upcomingTrips: number;
}

export interface CreateTransportVehicleInput {
  registration_number: string; fleet_number?: string | null; make?: string | null;
  model?: string | null; year?: number | null; capacity: number; status?: TransportVehicleStatus; notes?: string | null;
}
export interface CreateTransportDriverInput {
  first_name: string; last_name: string; employee_id?: string | null; phone?: string | null;
  licence_number?: string | null; licence_expiry?: string | null; status?: TransportDriverStatus; notes?: string | null;
}
export interface CreateTransportRouteInput {
  name: string; code: string; direction: 'morning'|'afternoon'|'both'; notes?: string | null;
}
export interface CreateTransportStopInput {
  name: string; address?: string | null; latitude?: number | null; longitude?: number | null;
  pickup_time?: string | null; dropoff_time?: string | null;
}
export interface CreateTransportAssignmentInput {
  learner_id: string; route_id: string; pickup_stop_id?: string | null; dropoff_stop_id?: string | null;
  effective_from: string; effective_to?: string | null; notes?: string | null;
}
export interface CreateTransportScheduleInput {
  route_id: string; vehicle_id: string; driver_id?: string | null; service_date: string;
  departure_time?: string | null; notes?: string | null;
}
