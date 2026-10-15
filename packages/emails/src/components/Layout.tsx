import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import type { CSSProperties, ReactNode } from "react";

/** The Sunset Violet palette (apps/web/app/globals.css), as fixed values for email clients. */
export const colors = {
  plum: "#1F024C",
  violet: "#45056E",
  orchid: "#8F1383",
  coral: "#E47676",
  /** Page background. */
  mist: "#FBF7FD",
  /** Muted surfaces: chips, callouts. */
  lilac: "#F3EAF9",
  border: "#E3D5EE",
  /** Muted text. */
  dusk: "#6B5683",
  /** Secondary text. */
  twilight: "#4A3863",
  white: "#FFFFFF",
};

/** Every email shows the logo, served by the web app (`/brand/osg-icon.png`). */
export interface BrandProps {
  logoUrl: string;
}

const fontFamily =
  "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif";
const displayFont =
  "'Bricolage Grotesque', 'Geist', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

export const textStyle: CSSProperties = { color: colors.plum, fontSize: 15, lineHeight: "24px" };
export const headingStyle: CSSProperties = {
  color: colors.plum,
  fontFamily: displayFont,
  fontSize: 22,
  fontWeight: 800,
  letterSpacing: "-0.01em",
  margin: "0 0 12px",
};
export const linkStyle: CSSProperties = { color: colors.orchid, fontWeight: 600 };

/** The site's pill button: violet, white text. */
export function PrimaryButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button
      href={href}
      style={{
        backgroundColor: colors.violet,
        borderRadius: 999,
        color: colors.white,
        fontSize: 14,
        fontWeight: 600,
        padding: "12px 22px",
      }}
    >
      {children}
    </Button>
  );
}

/** A small rounded label, e.g. an issue label or "Not assigned yet". */
export function Chip({
  children,
  tone = "lilac",
}: {
  children: ReactNode;
  tone?: "lilac" | "coral";
}) {
  return (
    <span
      style={{
        backgroundColor: tone === "coral" ? colors.coral : colors.lilac,
        borderRadius: 999,
        color: tone === "coral" ? colors.plum : colors.violet,
        display: "inline-block",
        fontSize: 12,
        fontWeight: 600,
        lineHeight: "18px",
        margin: "0 4px 4px 0",
        padding: "1px 9px",
      }}
    >
      {children}
    </span>
  );
}

export interface LayoutProps extends BrandProps {
  preview: string;
  children: ReactNode;
  /** Links in the footer, e.g. "Manage subscriptions", "Unsubscribe". */
  footerLinks?: { label: string; href: string }[];
  footerNote?: string;
}

export function Layout({ preview, children, footerLinks = [], footerNote, logoUrl }: LayoutProps) {
  return (
    <Html lang="en">
      <Head>
        {/* Clients that respect it render light: the brand colors are tuned for light. */}
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: colors.mist,
          color: colors.plum,
          fontFamily,
          margin: 0,
          padding: "32px 12px",
        }}
      >
        <Container style={{ maxWidth: 600 }}>
          <Section style={{ padding: "0 4px 16px" }}>
            <Row>
              <Column style={{ width: 40, verticalAlign: "middle" }}>
                <Img src={logoUrl} alt="" width={32} height={32} style={{ borderRadius: 8 }} />
              </Column>
              <Column style={{ verticalAlign: "middle" }}>
                <Text
                  style={{
                    color: colors.plum,
                    fontFamily: displayFont,
                    fontSize: 18,
                    fontWeight: 800,
                    letterSpacing: "-0.01em",
                    margin: 0,
                  }}
                >
                  Open Source <span style={{ color: colors.orchid }}>Guru</span>
                </Text>
              </Column>
            </Row>
          </Section>

          <Section
            style={{
              backgroundColor: colors.white,
              border: `1px solid ${colors.border}`,
              borderRadius: 16,
              padding: "28px 32px",
            }}
          >
            {children}
          </Section>

          <Section style={{ padding: "16px 8px 0" }}>
            {footerNote && (
              <Text
                style={{ color: colors.dusk, fontSize: 12, lineHeight: "18px", margin: "0 0 8px" }}
              >
                {footerNote}
              </Text>
            )}
            {footerLinks.length > 0 && (
              <Text style={{ color: colors.dusk, fontSize: 12, lineHeight: "18px", margin: 0 }}>
                {footerLinks.map((link, index) => (
                  <span key={link.href}>
                    {index > 0 && " · "}
                    <Link
                      href={link.href}
                      style={{ color: colors.dusk, textDecoration: "underline" }}
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
