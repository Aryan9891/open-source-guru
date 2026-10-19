import { render, toPlainText } from "@react-email/render";
import { createElement } from "react";
import {
  AccountDeletedEmail,
  type AccountDeletedEmailProps,
  VerifyEmail,
  type VerifyEmailProps,
  WelcomeEmail,
  type WelcomeEmailProps,
} from "./AccountEmails.tsx";
import {
  NotificationEmail,
  type NotificationEmailProps,
  notificationSubject,
} from "./NotificationEmail.tsx";
import {
  GoalAchievedEmail,
  type GoalAchievedEmailProps,
  goalAchievedSubject,
  StreakReminderEmail,
  type StreakReminderEmailProps,
  streakReminderSubject,
} from "./ProgressEmails.tsx";

export type {
  AccountDeletedEmailProps,
  VerifyEmailProps,
  WelcomeEmailProps,
} from "./AccountEmails.tsx";
export type {
  NotificationEmailProps,
  NotificationIssue,
  NotificationKind,
  NotificationSection,
} from "./NotificationEmail.tsx";
export type {
  AchievedGoal,
  GoalAchievedEmailProps,
  StreakReminderEmailProps,
} from "./ProgressEmails.tsx";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

async function renderEmail(subject: string, element: React.ReactElement): Promise<RenderedEmail> {
  const html = await render(element);
  return { subject, html, text: toPlainText(html) };
}

export const renderNotificationEmail = (props: NotificationEmailProps) =>
  renderEmail(notificationSubject(props), createElement(NotificationEmail, props));

export const renderWelcomeEmail = (props: WelcomeEmailProps) =>
  renderEmail("Welcome to Open Source Guru", createElement(WelcomeEmail, props));

export const renderVerifyEmail = (props: VerifyEmailProps) =>
  renderEmail("Confirm your email address", createElement(VerifyEmail, props));

export const renderAccountDeletedEmail = (props: AccountDeletedEmailProps) =>
  renderEmail(
    "Your Open Source Guru account has been deleted",
    createElement(AccountDeletedEmail, props),
  );

export const renderStreakReminderEmail = (props: StreakReminderEmailProps) =>
  renderEmail(streakReminderSubject(props), createElement(StreakReminderEmail, props));

export const renderGoalAchievedEmail = (props: GoalAchievedEmailProps) =>
  renderEmail(goalAchievedSubject(props), createElement(GoalAchievedEmail, props));
