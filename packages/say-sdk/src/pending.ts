import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import { signServiceToken } from '@things/auth';
import type { ShoppingPayload, MealPayload } from '@things/types';

export type PendingDestination = 'PENDING_BUY' | 'PENDING_EAT';

export interface PendingItem {
  dictationId: string;
  createdAt: string;
  payload: ShoppingPayload | MealPayload;
  transcript: string;
}

export interface SayPendingApiOpts {
  http: AxiosInstance;
  callerService: string;
  serviceTokenSecret: string;
}

export class SayPendingApi {
  constructor(private readonly opts: SayPendingApiOpts) {}

  async list(args: { userId: string; destination: PendingDestination }): Promise<PendingItem[]> {
    const { data } = await this.opts.http.get<PendingItem[]>('/pending', {
      ...this.authHeaders(args.userId),
      params: { destination: args.destination },
    });
    return data;
  }

  async consume(
    dictationId: string,
    args: { userId: string; destinationRef: string },
  ): Promise<{ ok: true }> {
    const { data } = await this.opts.http.post<{ ok: true }>(
      `/pending/${encodeURIComponent(dictationId)}/consume`,
      { destinationRef: args.destinationRef },
      this.authHeaders(args.userId),
    );
    return data;
  }

  private authHeaders(userId: string): AxiosRequestConfig {
    const token = signServiceToken(
      { iss: this.opts.callerService, aud: 'api-say', sub: userId },
      { secret: this.opts.serviceTokenSecret },
    );
    return { headers: { Authorization: `Bearer ${token}` } };
  }
}
