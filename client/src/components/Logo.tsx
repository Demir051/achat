import { useId } from "react";

export default function Logo({ size = 40 }: { size?: number }) {
  const gradId = `logo-grad-${useId().replace(/:/g, "")}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-label="achat"
      role="img"
    >
      <rect width="48" height="48" rx="14" fill={`url(#${gradId})`} />
      <text
        x="24"
        y="30.5"
        textAnchor="middle"
        fill="#ffffff"
        fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontWeight="800"
        fontSize="10.5"
        letterSpacing="-0.35"
      >
        achat
      </text>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="48" y2="48">
          <stop stopColor="var(--accent, #7c6cff)" />
          <stop offset="1" stopColor="var(--accent-hover, #8f81ff)" />
        </linearGradient>
      </defs>
    </svg>
  );
}
