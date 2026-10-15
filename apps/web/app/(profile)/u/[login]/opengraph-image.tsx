import { ImageResponse } from "next/og";
import { formatNumber } from "@/lib/contributions";
import { fetchProfile } from "@/lib/profile";

// The card shown when a profile link is shared (Sunset Violet colors).
export const alt = "Open Source Contributions on Open Source Guru";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PLUM = "#1F024C";
const PETAL = "#F6EEFB";
const WISTERIA = "#BCA7D3";
const VIOLET_BRIGHT = "#B57BE0";
const CORAL = "#E47676";

function Logo() {
  return (
    <svg width="56" height="56" viewBox="0 0 112 112" aria-hidden="true">
      <path d="M56 56C56 34 40 22 18 22 18 44 34 56 56 56Z" fill={VIOLET_BRIGHT} />
      <path d="M56 50C56 28 72 14 96 16 96 38 80 50 56 50Z" fill={CORAL} />
      <path d="M56 52V72M56 100V104" stroke={PETAL} strokeWidth="10" strokeLinecap="round" />
      <circle cx="56" cy="86" r="10" fill="none" stroke={PETAL} strokeWidth="8" />
    </svg>
  );
}

export default async function Image({ params }: { params: Promise<{ login: string }> }) {
  const { login } = await params;
  const profile = await fetchProfile(login, null);
  const streak = profile ? profile.stats.streaks[profile.stats.streaks.period] : null;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: `linear-gradient(135deg, ${PLUM} 0%, #45056E 100%)`,
        color: PETAL,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
        {profile?.avatarUrl ? (
          // biome-ignore lint/performance/noImgElement: rendered to an image by next/og
          <img
            src={profile.avatarUrl}
            alt=""
            width={128}
            height={128}
            style={{ borderRadius: 64, border: `4px solid ${VIOLET_BRIGHT}` }}
          />
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 60, fontWeight: 800 }}>
            {profile ? profile.name || profile.login : "Open Source Guru"}
          </span>
          {profile && <span style={{ fontSize: 32, color: WISTERIA }}>@{profile.login}</span>}
        </div>
      </div>

      {profile ? (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 64 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 120, fontWeight: 800, lineHeight: 1 }}>
              {formatNumber(profile.stats.total)}
            </span>
            <span style={{ fontSize: 32, color: WISTERIA }}>
              Open Source Contributions in the last year
            </span>
          </div>
          {streak && streak.current > 0 && (
            <div
              style={{
                display: "flex",
                padding: "12px 28px",
                borderRadius: 40,
                background: CORAL,
                color: PLUM,
                fontSize: 32,
                fontWeight: 800,
              }}
            >
              {formatNumber(streak.current)}-{profile.stats.streaks.period} streak
            </div>
          )}
        </div>
      ) : (
        <span style={{ fontSize: 40, color: WISTERIA }}>
          Find, follow and track open-source work
        </span>
      )}

      <div
        style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, color: WISTERIA }}
      >
        <Logo />
        Open Source Guru
      </div>
    </div>,
    size,
  );
}
