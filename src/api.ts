import type { Config, DaysOffMap, WeekSummary } from "./utils/hours";

type ApiError = {
  error: string;
  detail?: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    ...init,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(body.error ?? `Request failed with status ${res.status}`);
  }

  return (await res.json()) as T;
}

export async function getConfig(): Promise<Config> {
  return request<Config>("/api/config");
}

export async function getCurrentUser(): Promise<{ user: { email: string; name?: string; picture?: string } }> {
  return request<{ user: { email: string; name?: string; picture?: string } }>("/api/auth/me");
}

export async function loginWithGoogle(credential: string) {
  const data = await request<{ user: { email: string; name?: string; picture?: string } }>("/api/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });

  return data.user;
}

export async function logout() {
  await request<void>("/api/auth/logout", { method: "POST" });
}

export async function getHours(): Promise<WeekSummary[]> {
  const data = await request<{ weeks: WeekSummary[] }>("/api/hours");

  return data.weeks;
}

export async function getDaysOff(): Promise<DaysOffMap> {
  const data = await request<{ daysOff: DaysOffMap }>("/api/days-off");

  return data.daysOff;
}

export async function setDaysOff(weekStart: string, daysOff: number[]): Promise<DaysOffMap> {
  const data = await request<{ daysOff: DaysOffMap }>("/api/days-off", {
    method: "PUT",
    body: JSON.stringify({ weekStart, daysOff }),
  });

  return data.daysOff;
}
