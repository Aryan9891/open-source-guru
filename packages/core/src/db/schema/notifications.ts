// Channels, subscriptions and deliveries.
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth.ts";
import { events, type IssueEventType, repositories } from "./github.ts";

export type ChannelType = "email" | "discord" | "slack" | "webhook" | "ntfy";
export type ChannelStatus = "pending" | "active" | "disabled";
export type Frequency = "instant" | "hourly" | "daily";
export type LabelMatch = "any" | "all";
export type SubscriptionStatus = "active" | "paused";
export type DeliveryStatus = "pending" | "sent" | "failed" | "skipped";

/** Non-secret channel settings, by channel type. Only email exists in Phase 1. */
export interface EmailChannelConfig {
  address: string;
}

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

export const notificationChannels = pgTable(
  "notification_channels",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text().$type<ChannelType>().notNull(),
    label: text().notNull(),
    config: jsonb().$type<EmailChannelConfig>().notNull(),
    /** Encrypted secrets (OAuth tokens, webhook URLs) for Phase 3 channels. */
    credentialsEncrypted: text(),
    status: text().$type<ChannelStatus>().notNull(),
    verifiedAt: timestamp({ withTimezone: true }),
    consecutiveFailures: integer().default(0).notNull(),
    lastError: text(),
    disabledReason: text(),
    ...timestamps,
  },
  (table) => [
    index("notification_channels_user_id_idx").on(table.userId),
    uniqueIndex("notification_channels_address_idx").on(
      table.userId,
      table.type,
      sql`lower(${table.config}->>'address')`,
    ),
  ],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    repoId: uuid()
      .notNull()
      .references(() => repositories.id, { onDelete: "restrict" }),
    eventTypes: text().array().$type<IssueEventType[]>().notNull(),
    /** Label names as entered; compared case-insensitively. Empty = any issue. */
    labels: text().array().notNull(),
    labelMatch: text().$type<LabelMatch>().default("any").notNull(),
    status: text().$type<SubscriptionStatus>().default("active").notNull(),
    ...timestamps,
  },
  (table) => [
    index("subscriptions_user_id_idx").on(table.userId),
    index("subscriptions_repo_id_idx").on(table.repoId),
  ],
);

export const subscriptionChannels = pgTable(
  "subscription_channels",
  {
    subscriptionId: uuid()
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }),
    channelId: uuid()
      .notNull()
      .references(() => notificationChannels.id, { onDelete: "cascade" }),
    frequency: text().$type<Frequency>().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.subscriptionId, table.channelId] }),
    index("subscription_channels_channel_id_idx").on(table.channelId),
  ],
);

export const deliveries = pgTable(
  "deliveries",
  {
    id: uuid().defaultRandom().primaryKey(),
    eventId: uuid()
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    subscriptionId: uuid()
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }),
    channelId: uuid()
      .notNull()
      .references(() => notificationChannels.id, { onDelete: "cascade" }),
    /** Copied from the subscription channel when the delivery is created. */
    frequency: text().$type<Frequency>().notNull(),
    status: text().$type<DeliveryStatus>().default("pending").notNull(),
    attempts: integer().default(0).notNull(),
    nextAttemptAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    lastError: text(),
    /** Deliveries sent in the same email share a batch ID. */
    batchId: uuid(),
    sentAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("deliveries_event_subscription_channel_key").on(
      table.eventId,
      table.subscriptionId,
      table.channelId,
    ),
    index("deliveries_pending_idx")
      .on(table.channelId, table.frequency, table.nextAttemptAt)
      .where(sql`${table.status} = 'pending'`),
  ],
);

export const emailSuppressions = pgTable("email_suppressions", {
  /** Lowercased address. */
  address: text().primaryKey(),
  reason: text().$type<"bounce" | "complaint" | "unsubscribed">().notNull(),
  detail: text(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});
