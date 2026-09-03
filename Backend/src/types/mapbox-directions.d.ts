declare module '@mapbox/mapbox-sdk/services/directions' {
  export interface DirectionsRoute {
    distance: number;
    duration: number;
  }

  export interface DirectionsResponse {
    body: {
      routes?: DirectionsRoute[];
    };
  }

  export interface DirectionsRequest {
    getDirections(options: {
      profile: string;
      waypoints: Array<{ coordinates: [number, number] }>;
      geometries: string;
      alternatives: boolean;
      overview: string;
      steps: boolean;
    }): { send(): Promise<DirectionsResponse> };
  }

  const createDirections: (config: { accessToken: string }) => DirectionsRequest;
  export = createDirections;
}
