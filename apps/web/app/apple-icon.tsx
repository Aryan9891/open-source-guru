import { ImageResponse } from "next/og";

// Home-screen icon for iOS (must be a PNG). iOS rounds the corners itself.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#45056E",
      }}
    >
      <svg width="132" height="132" viewBox="0 0 112 112" aria-hidden="true">
        <path d="M56 56C56 34 40 22 18 22 18 44 34 56 56 56Z" fill="#B57BE0" />
        <path d="M56 50C56 28 72 14 96 16 96 38 80 50 56 50Z" fill="#E47676" />
        <path d="M56 52V72M56 100V104" stroke="#F6EEFB" strokeWidth="10" strokeLinecap="round" />
        <circle cx="56" cy="86" r="10" fill="none" stroke="#F6EEFB" strokeWidth="8" />
      </svg>
    </div>,
    size,
  );
}
