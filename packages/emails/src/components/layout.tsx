import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

export const colors = {
  text: "#1f2328",
  muted: "#59636e",
  border: "#d1d9e0",
  accent: "#0969da",
  background: "#f6f8fa",
};

export interface LayoutProps {
  preview: string;
  children: ReactNode;
  /** Links in the footer, e.g. "Manage subscriptions", "Unsubscribe". */
  footerLinks?: { label: string; href: string }[];
  footerNote?: string;
}

export function Layout({ preview, children, footerLinks = [], footerNote }: LayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: colors.background,
          color: colors.text,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif",
          margin: 0,
          padding: "24px 0",
        }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            maxWidth: 600,
            padding: "24px 28px",
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: 600, margin: "0 0 16px", color: colors.muted }}>
            Open Source Guru
          </Text>
          {children}
          <Hr style={{ borderColor: colors.border, margin: "28px 0 16px" }} />
          <Section>
            {footerNote && (
              <Text style={{ color: colors.muted, fontSize: 12, margin: "0 0 8px" }}>
                {footerNote}
              </Text>
            )}
            {footerLinks.length > 0 && (
              <Text style={{ color: colors.muted, fontSize: 12, margin: 0 }}>
                {footerLinks.map((link, index) => (
                  <span key={link.href}>
                    {index > 0 && " · "}
                    <Link
                      href={link.href}
                      style={{ color: colors.muted, textDecoration: "underline" }}
                    >
                      {link.label}
                    </Link>
                  </span>
                ))}
              </Text>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
