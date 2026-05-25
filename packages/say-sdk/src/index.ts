import axios, { type AxiosInstance } from 'axios';
import { SayPendingApi } from './pending';

export interface SaySdkOpts {
  /** Base URL of api-say (e.g. http://api-say:3003). Ignored when `http` is provided. */
  baseUrl: string;
  /** Caller service id, used as JWT iss (e.g. 'api-buy'). */
  callerService: string;
  /** Shared HMAC secret with api-say for service JWTs. */
  serviceTokenSecret: string;
  /** Injectable axios instance for tests. */
  http?: AxiosInstance;
}

export class SaySdk {
  readonly pending: SayPendingApi;

  constructor(opts: SaySdkOpts) {
    const http = opts.http ?? axios.create({ baseURL: opts.baseUrl, timeout: 10_000 });
    this.pending = new SayPendingApi({
      http,
      callerService: opts.callerService,
      serviceTokenSecret: opts.serviceTokenSecret,
    });
  }
}

export type { PendingDestination, PendingItem, SayPendingApi } from './pending';
