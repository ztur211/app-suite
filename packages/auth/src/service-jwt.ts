import jwt from 'jsonwebtoken';

export interface ServiceJwtPayload {
  /** Caller service (e.g. 'api-say') */
  iss: string;
  /** Target service (e.g. 'api-do') */
  aud: string;
  /** userId being acted on behalf of, or 'system' */
  sub: string;
}

export interface SignOpts {
  secret: string;
  /** Default: 300 (5 minutes) */
  expiresInSeconds?: number;
}

export interface VerifyOpts {
  secret: string;
  expectedAud: string;
}

/**
 * Signs a short-lived HMAC-SHA256 JWT for service-to-service calls.
 * Tokens expire in 5 minutes by default.
 */
export function signServiceToken(payload: ServiceJwtPayload, opts: SignOpts): string {
  const { secret, expiresInSeconds = 300 } = opts;
  return jwt.sign({ iss: payload.iss, aud: payload.aud, sub: payload.sub }, secret, {
    algorithm: 'HS256',
    expiresIn: expiresInSeconds,
  });
}

/**
 * Verifies a service JWT. Throws if the token is expired, tampered,
 * signed with the wrong secret, or addressed to a different audience.
 */
export function verifyServiceToken(token: string, opts: VerifyOpts): ServiceJwtPayload {
  const { secret, expectedAud } = opts;

  // jwt.verify throws on invalid signature or expiry.
  // We do NOT pass the audience option directly to jwt.verify because it
  // formats the error as "jwt audience invalid" which is fine, but we want
  // a consistent error message. We'll check audience ourselves after decode.
  const decoded = jwt.verify(token, secret, {
    algorithms: ['HS256'],
  }) as jwt.JwtPayload;

  // Audience check — jwt.verify with `audience` option would also work,
  // but this gives us a clearer error message.
  const tokenAud = decoded['aud'];
  // aud may be a string or string[] per the JWT spec.
  const audList = Array.isArray(tokenAud) ? tokenAud : [tokenAud];
  if (!audList.includes(expectedAud)) {
    throw new Error(`JWT audience mismatch: expected "${expectedAud}", got "${String(tokenAud)}"`);
  }

  // Return the full decoded payload (includes iat, exp, etc.)
  // Cast is safe: we verified signature, alg, and audience above.
  return decoded as unknown as ServiceJwtPayload;
}
