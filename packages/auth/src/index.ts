export const PACKAGE_NAME = '@things/auth' as const;

export {
  signServiceToken,
  verifyServiceToken,
  type ServiceJwtPayload,
  type SignOpts,
  type VerifyOpts,
} from './service-jwt';

export { validateSessionFromCookie, type AuthApiLike, type SessionInfo } from './session-validator';
