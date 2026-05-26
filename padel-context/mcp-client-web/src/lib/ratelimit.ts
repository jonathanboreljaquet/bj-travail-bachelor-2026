import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let chatRatelimit: Ratelimit | undefined;

export function getChatRatelimit(): Ratelimit {
  if (!chatRatelimit) {
    const redis = Redis.fromEnv();

    chatRatelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 m"),
      analytics: true,
      prefix: "padel-context:chat",
    });
  }

  return chatRatelimit;
}
