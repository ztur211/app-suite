import axios, { type AxiosInstance } from 'axios';
import { TasksApi } from './tasks';

export interface DoSdkOpts {
  /** Base URL of api-do (e.g. http://localhost:3002). Ignored when `http` is provided. */
  baseUrl: string;
  /** Caller service id, used as JWT iss (e.g. 'api-say'). */
  callerApp: string;
  /** Shared HMAC secret with api-do for service JWTs. */
  serviceTokenSecret: string;
  /** Override audience claim. Default 'api-do'. */
  audience?: string;
  /** Injectable axios instance for tests. */
  http?: AxiosInstance;
}

export class DoSdk {
  readonly tasks: TasksApi;

  constructor(opts: DoSdkOpts) {
    const http = opts.http ?? axios.create({ baseURL: opts.baseUrl });
    this.tasks = new TasksApi({
      http,
      callerApp: opts.callerApp,
      serviceTokenSecret: opts.serviceTokenSecret,
      audience: opts.audience ?? 'api-do',
    });
  }
}

export type {
  CreateTaskParams,
  CreateTaskResult,
  DeleteTaskParams,
  TaskSource,
  TasksApi,
} from './tasks';
