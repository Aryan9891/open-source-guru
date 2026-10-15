import { Heading, Link, Section, Text } from "@react-email/components";
import {
  type BrandProps,
  Chip,
  colors,
  headingStyle,
  Layout,
  linkStyle,
  textStyle,
} from "./components/Layout.tsx";

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

export interface NotificationEmailProps extends BrandProps {
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
  logoUrl,
}: NotificationEmailProps) {
  const total = countIssues(sections);
  const intro =
    kind === "instant"
      ? `${plural(total, "issue")} matched your subscriptions.`
      : `${plural(total, "issue")} matched your subscriptions in the last ${kind === "hourly" ? "hour" : "day"}.`;

  return (
    <Layout
      logoUrl={logoUrl}
      preview={notificationSubject({ kind, sections })}
      footerNote="You receive this email because you subscribed to these repositories on Open Source Guru."
      footerLinks={[
        { label: "Manage subscriptions", href: dashboardUrl },
        { label: "Unsubscribe from all notifications", href: unsubscribeAllUrl },
      ]}
    >
      <Heading as="h1" style={{ ...headingStyle, fontSize: 20 }}>
        {kind === "instant"
          ? "New issues for you"
          : kind === "hourly"
            ? "Your hourly digest"
            : "Your daily digest"}
      </Heading>
      <Text style={{ ...textStyle, color: colors.twilight, margin: "0 0 8px" }}>{intro}</Text>
      {sections.map((section) => (
        <Section key={section.fullName} style={{ marginTop: 24 }}>
          <Heading as="h2" style={{ fontSize: 15, margin: "0 0 10px", fontFamily: "monospace" }}>
            <Link href={section.url} style={{ color: colors.plum }}>
              {section.fullName}
            </Link>
          </Heading>
          {section.issues.map((issue) => (
            <Section
              key={issue.number}
              style={{
                backgroundColor: colors.mist,
                borderLeft: `3px solid ${colors.orchid}`,
                borderRadius: 8,
                margin: "0 0 10px",
                padding: "10px 14px",
              }}
            >
              <Text style={{ fontSize: 15, lineHeight: "22px", margin: "0 0 6px" }}>
                <Link href={issue.url} style={linkStyle}>
                  #{issue.number} {issue.title}
                </Link>
              </Text>
              <Text
                style={{ color: colors.dusk, fontSize: 13, lineHeight: "18px", margin: "0 0 6px" }}
              >
                {issue.reasons.join(" · ")}
              </Text>
              <Text style={{ margin: 0 }}>
                {issue.assignees.length > 0 ? (
                  <Chip>Assigned to {issue.assignees.join(", ")}</Chip>
                ) : (
                  <Chip tone="coral">Not assigned yet</Chip>
                )}
                {issue.labels.map((label) => (
                  <Chip key={label}>{label}</Chip>
                ))}
              </Text>
            </Section>
          ))}
          <Text style={{ fontSize: 12, margin: "6px 0 0" }}>
            <Link
              href={section.unsubscribeUrl}
              style={{ color: colors.dusk, textDecoration: "underline" }}
            >
              Stop emails for {section.fullName}
            </Link>
          </Text>
        </Section>
      ))}
    </Layout>
  );
}
