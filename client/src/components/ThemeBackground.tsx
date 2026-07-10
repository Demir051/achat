import { createPortal } from "react-dom";
import { useSettings } from "../store/settings";
import { getTheme } from "../themes";

export default function ThemeBackground() {
  const theme = useSettings((s) => s.theme);
  const wp = getTheme(theme).wallpaper;

  return createPortal(
    <div key={theme} className={`theme-bg ${wp}`} aria-hidden />,
    document.body,
  );
}
