export const ROUTE_PORT = Symbol('ROUTE_PORT');

export interface RoutePort {
  getDistanceAndDuration(
    origin: [number, number],
    destination: [number, number],
  ): Promise<{ distanceKm: number; durationMin: number } | null>;
}
