export type RideStatus =
  | 'requested'
  | 'offered'
  | 'accepted'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type TransitionDecision =
  | { kind: 'apply' }
  | { kind: 'idempotent' }
  | { kind: 'conflict'; message: string };

export function decideAccept(status: RideStatus, currentDriverId: string | null, requestedDriverId: string): TransitionDecision {
  if (status === 'requested' && currentDriverId === null) return { kind: 'apply' };

  if (status === 'offered') {
    if (currentDriverId === requestedDriverId) return { kind: 'apply' };
    return { kind: 'conflict', message: 'Ride is offered to another driver' };
  }

  if (status === 'accepted') {
    if (currentDriverId === requestedDriverId) return { kind: 'idempotent' };
    return { kind: 'conflict', message: 'Ride is already accepted by another driver' };
  }

  if (status === 'cancelled') return { kind: 'conflict', message: 'Ride is cancelled' };
  if (status === 'completed') return { kind: 'conflict', message: 'Ride is completed' };

  // arrived / in_progress are not acceptable
  return { kind: 'conflict', message: 'Ride is not available to accept' };
}

export function decideCancel(status: RideStatus): TransitionDecision {
  if (status === 'cancelled') return { kind: 'idempotent' };
  if (status === 'requested' || status === 'offered' || status === 'accepted' || status === 'arrived') return { kind: 'apply' };
  if (status === 'completed') return { kind: 'conflict', message: 'Ride is completed' };
  return { kind: 'conflict', message: 'Ride cannot be cancelled in current state' };
}

export function decideArrive(status: RideStatus, rideDriverId: string | null, driverId: string): TransitionDecision {
  if (rideDriverId !== driverId) return { kind: 'conflict', message: 'Forbidden' };
  if (status === 'arrived') return { kind: 'idempotent' };
  if (status === 'accepted') return { kind: 'apply' };
  if (status === 'cancelled') return { kind: 'conflict', message: 'Ride is cancelled' };
  if (status === 'completed') return { kind: 'conflict', message: 'Ride is completed' };
  return { kind: 'conflict', message: 'Ride cannot be marked arrived in current state' };
}

export function decideStart(status: RideStatus, rideDriverId: string | null, driverId: string): TransitionDecision {
  if (rideDriverId !== driverId) return { kind: 'conflict', message: 'Forbidden' };
  if (status === 'in_progress') return { kind: 'idempotent' };
  if (status === 'arrived') return { kind: 'apply' };
  if (status === 'cancelled') return { kind: 'conflict', message: 'Ride is cancelled' };
  if (status === 'completed') return { kind: 'conflict', message: 'Ride is completed' };
  return { kind: 'conflict', message: 'Ride cannot be started in current state' };
}

export function decideComplete(status: RideStatus, rideDriverId: string | null, driverId: string): TransitionDecision {
  if (rideDriverId !== driverId) return { kind: 'conflict', message: 'Forbidden' };
  if (status === 'completed') return { kind: 'idempotent' };
  if (status === 'in_progress') return { kind: 'apply' };
  if (status === 'cancelled') return { kind: 'conflict', message: 'Ride is cancelled' };
  return { kind: 'conflict', message: 'Ride cannot be completed in current state' };
}
