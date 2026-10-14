import { Heading, Link, Section, Text } from "@react-email/components";
import { colors, Layout } from "./components/Layout.tsx";

export type NotificationKind = "instant" | "hourly" | "daily";

export interface NotificationIssue {
  number: number;
  title: string;
  url: string;
  labels: string[];
  assignees: string[];
  /** e.g. "New issue", "Labeled help wanted". */
  reasons: string[];
}

export interface NotificationSection {
  fullName: string;
  url: string;
  /** Stops emails for this repo's subscriptions only. */
  unsubscribeUrl: string;
  issues: NotificationIssue[];
}

export interface NotificationEmailProps {
  kind: NotificationKind;
  sections: NotificationSection[];
  dashboardUrl: string;
  /** Stops every notification sent to this address. */
  unsubscribeAllUrl: string;
}

const countIssues = (sections: NotificationSection[]) =>
  sections.reduce((total, section) => total + section.issues.length, 0);

const plural = (count: number, word: string, pluralWord = `${word}s`) =>
  `${count} ${count === 1 ? word : pluralWord}`;

export function notificationSubject({
  kind,
  sections,
}: Pick<NotificationEmailProps, "kind" | "sections">) {
  const total = countIssues(sections);
  const [first] = sections;
  const prefix = kind === "daily" ? "Daily digest: " : kind === "hourly" ? "Hourly digest: " : "";

  if (sections.length === 1 && first) {
    const [issue] = first.issues;
    if (total === 1 && issue) return `${prefix}${first.fullName}#${issue.number}: ${issue.title}`;
    return `${prefix}${plural(total, "issue")} in ${first.fullName}`;
  }
  return `${prefix}${plural(total, "issue")} in ${plural(sections.length, "repository", "repositories")}`;
}

export function NotificationEmail({
  kind,
  sections,
  dashboardUrl,
  unsubscribeAllUrl,
}: NotificationEmailProps) {
  const total = countIssues(sections);
  const intro =
    kind === "instant"
      ? `${plural(total, "issue")} matched your subscriptions.`
      : `${plural(total, "issue")} matched your subscriptions in the last ${kind === "hourly" ? "hour" : "day"}.`;

  return (
    <Layout
      preview={notificationSubject({ kind, sections })}
      footerNote="You receive this email because you subscribed to these repositories on Open Source Guru."
      footerLinks={[
        { label: "Manage subscriptions", href: dashboardUrl },
        { label: "Unsubscribe from all notifications", href: unsubscribeAllUrl },
      ]}
    >
      <Text style={{ fontSize: 15, margin: "0 0 8px" }}>{intro}</Text>
      {sections.map((section) => (
        <Section key={section.fullName} style={{ marginTop: 20 }}>
          <Heading as="h2" style={{ fontSize: 16, margin: "0 0 8px" }}>
            <Link href={section.url} style={{ color: colors.text }}>
              {section.fullName}
            </Link>
          </Heading>
          {section.issues.map((issue) => (
            <Section
              key={issue.number}
              style={{
                borderLeft: `3px solid ${colors.accent}`,
                margin: "0 0 12px",
                paddingLeft: 12,
              }}
            >
              <Text style={{ fontSize: 15, margin: 0 }}>
                <Link href={issue.url} style={{ color: colors.accent, fontWeight: 600 }}>
                  #{issue.number} {issue.title}
                </Link>
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13, margin: "2px 0 0" }}>
                {issue.reasons.join(" · ")}
                {issue.labels.length > 0 && ` — labels: ${issue.labels.join(", ")}`}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13, margin: "2px 0 0" }}>
                {issue.assignees.length > 0
                  ? `Assigned to ${issue.assignees.join(", ")}`
                  : "Not assigned yet"}
              </Text>
            </Section>
          ))}
          <Text style={{ fontSize: 12, margin: "4px 0 0" }}>
            <Link href={section.unsubscribeUrl} style={{ color: colors.muted }}>
              Stop emails for {section.fullName}
            </Link>
          </Text>
        </Section>
      ))}
    </Layout>
  );
}
