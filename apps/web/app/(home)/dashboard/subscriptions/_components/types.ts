import type { Frequency } from "@/components/subscriptions/FrequencyPicker";

export type EventType = "issue.opened" | "issue.labeled";

/** A subscription, as returned by GET /v1/me/subscriptions. */
export interface Subscription {
  id: string;
  repo: { fullName: string; url: string };
  events: EventType[];
  labels: string[];
  labelMatch: "any" | "all";
  status: "active" | "paused";
  channels: { channelId: string; frequency: Frequency }[];
  createdAt: string;
}

/** A notification channel, as returned by GET /v1/me/channels. */
export interface Channel {
  id: string;
  type: string;
  label: string;
  address: string;
  status: "pending" | "active" | "disabled";
}

export const EVENT_LABELS: Record<EventType, string> = {
  "issue.opened": "New issues",
  "issue.labeled": "Labels added to existing issues",
};

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  instant: "right away",
  hourly: "in an hourly digest",
  daily: "in a daily digest",
};
