const LOGO_SRC = "/logo.png";

export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <img
      src={LOGO_SRC}
      alt="achat"
      className="app-logo"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}
