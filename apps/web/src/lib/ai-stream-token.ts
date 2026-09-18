import { env } from "@tccpet/env/server";
import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_SECONDS = 60 * 60;

type StreamTokenPayload = {
  expiresAt: number;
  userId: string;
};

function sign(value: string) {
  return createHmac("sha256", env.BETTER_AUTH_SECRET).update(value).digest("base64url");
}

export function createAiStreamToken(userId: string) {
  const payload: StreamTokenPayload = {
    userId,
    expiresAt: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");

  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function getAiStreamTokenUserId(token: string) {
  const [encodedPayload, receivedSignature, ...extraParts] = token.split(".");
  if (!encodedPayload || !receivedSignature || extraParts.length > 0) return null;

  const expectedSignature = sign(encodedPayload);
  const receivedBuffer = Buffer.from(receivedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as StreamTokenPayload;

    if (
      typeof payload.userId !== "string" ||
      !payload.userId ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return payload.userId;
  } catch {
    return null;
  }
}
