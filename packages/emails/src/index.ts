import { render, toPlainText } from "@react-email/render";
import { createElement } from "react";
import {
  VerifyEmail,
  type VerifyEmailProps,
  WelcomeEmail,
  type WelcomeEmailProps,
} from "./account.tsx";
import {
  NotificationEmail,
  type NotificationEmailProps,
  notificationSubject,
} from "./notification.tsx";

export type { VerifyEmailProps, WelcomeEmailProps } from "./account.tsx";
export type {
  NotificationEmailProps,
  NotificationIssue,
  NotificationKind,
  NotificationSection,
} from "./notification.tsx";

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
