import { sql } from "drizzle-orm";
import { db } from "./db";
import { connection } from "./queue";

export type HealthStatus = {
  postgres: boolean;
  redis: boolean;
  forgejo: boolean;
};

async function checkPostgres() {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

async function checkRedis() {
  try {
    return (await connection.ping()) === "PONG";
  } catch {
    return false;
  }
}

async function checkForgejo() {
  try {
    const res = await fetch(`${process.env.FORGEJO_URL}/api/healthz`, {
      signal: AbortSignal.timeout(2000),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function checkHealth(): Promise<HealthStatus> {
  const [postgres, redis, forgejo] = await Promise.all([
    checkPostgres(),
    checkRedis(),
    checkForgejo(),
  ]);
  return { postgres, redis, forgejo };
}
