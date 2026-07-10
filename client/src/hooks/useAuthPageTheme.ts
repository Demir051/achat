import { useEffect } from "react";
import { applyStandardAuthTheme, applyTheme } from "../themes";
import { useSettings } from "../store/settings";

export function useAuthPageTheme() {
  useEffect(() => {
    applyStandardAuthTheme();
    document.documentElement.classList.add("auth-page");
    return () => {
      document.documentElement.classList.remove("auth-page");
      applyTheme(useSettings.getState().theme);
    };
  }, []);
}
