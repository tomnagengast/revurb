export type BroadcastDriver = "pusher" | "reverb";

export type EchoOptions<TBroadcaster extends BroadcastDriver = "reverb"> = {
  broadcaster: TBroadcaster;
  auth?: {
    headers: Record<string, string>;
  };
  authEndpoint?: string;
  userAuthentication?: {
    endpoint: string;
    headers: Record<string, string>;
  };
  csrfToken?: string | null;
  bearerToken?: string | null;
  host?: string | null;
  key?: string | null;
  namespace?: string | false;
  withoutInterceptors?: boolean;
  cluster?: string;
  wsHost?: string;
  wsPort?: number;
  wssPort?: number;
  httpHost?: string;
  httpPort?: number;
  httpsPort?: number;
  forceTLS?: boolean;
  encrypted?: boolean;
  enabledTransports?: string[];
  disabledTransports?: string[];
  activityTimeout?: number;
  pongTimeout?: number;
  unavailableTimeout?: number;
  authorizer?: (channel: any, options: any) => any;
  client?: any;
  [key: string]: any;
};

export type EchoOptionsWithDefaults = {
  broadcaster: BroadcastDriver;
  auth: {
    headers: Record<string, string>;
  };
  authEndpoint: string;
  userAuthentication: {
    endpoint: string;
    headers: Record<string, string>;
  };
  csrfToken: string | null;
  bearerToken: string | null;
  host: string | null;
  key: string;
  namespace: string | false;
  [key: string]: any;
};
