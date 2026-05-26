function tryDecodeJwtPayload(jwtToken: string): unknown {
  const parts = jwtToken.split(".");
  if (parts.length < 2) return undefined;

  try {
    const payloadJson = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(payloadJson) as unknown;
  } catch {
    return undefined;
  }
}

export function getJwtUserId(jwtToken: string | undefined): number | undefined {
  if (!jwtToken) return undefined;

  const payload = tryDecodeJwtPayload(jwtToken);
  if (!payload || typeof payload !== "object") return undefined;

  const maybeUserId = (payload as { userId?: unknown }).userId;
  if (typeof maybeUserId === "number" && Number.isFinite(maybeUserId)) {
    return maybeUserId;
  }

  return undefined;
}

export function getClientIp(request: Request): string | undefined {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  return undefined;
}

export function getRateLimitIdentifier(
  request: Request,
  jwtToken: string | undefined,
): string {
  const userId = getJwtUserId(jwtToken);
  if (userId !== undefined) return `user:${userId}`;

  const ip = getClientIp(request);
  if (ip) return `ip:${ip}`;

  return "anon";
}
