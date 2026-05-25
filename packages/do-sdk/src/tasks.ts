import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import { signServiceToken } from '@things/auth';

export interface TaskSource {
  /** Originating app id (e.g. 'say-things'). */
  app: string;
  dictationId?: string;
  [k: string]: unknown;
}

export interface CreateTaskParams {
  /** End-user the task is being created on behalf of. */
  userId: string;
  title: string;
  /** ISO 8601 string, or null for no due date. */
  dueAt: string | null;
  notes?: string;
  /** Cross-app provenance; api-do stores this verbatim for traceability. */
  source?: TaskSource;
}

export interface CreateTaskResult {
  id: string;
  userId: string;
  title: string;
  completed: boolean;
  dueAt: string | null;
}

export interface DeleteTaskParams {
  userId: string;
  taskId: string;
}

export interface TasksApiOpts {
  http: AxiosInstance;
  callerApp: string;
  serviceTokenSecret: string;
  audience: string;
}

export class TasksApi {
  constructor(private readonly opts: TasksApiOpts) {}

  async create(params: CreateTaskParams): Promise<CreateTaskResult> {
    const body: Record<string, unknown> = {
      title: params.title,
      dueAt: params.dueAt,
    };
    if (params.notes !== undefined) body['notes'] = params.notes;
    if (params.source !== undefined) body['source'] = params.source;
    const { data } = await this.opts.http.post<CreateTaskResult>(
      '/tasks',
      body,
      this.authHeaders(params.userId),
    );
    return data;
  }

  async delete(params: DeleteTaskParams): Promise<{ ok: true }> {
    const { data } = await this.opts.http.delete<{ ok: true }>(
      `/tasks/${encodeURIComponent(params.taskId)}`,
      this.authHeaders(params.userId),
    );
    return data;
  }

  private authHeaders(userId: string): AxiosRequestConfig {
    const token = signServiceToken(
      { iss: this.opts.callerApp, aud: this.opts.audience, sub: userId },
      { secret: this.opts.serviceTokenSecret },
    );
    return { headers: { Authorization: `Bearer ${token}` } };
  }
}
