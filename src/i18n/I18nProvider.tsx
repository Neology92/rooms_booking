import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { dictionaries, en, setErrorLocale, type Lang, type Strings } from "./strings";

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  s: Strings;
}

const I18nContext = createContext<I18n>({
  lang: "en",
  setLang: () => {},
  s: en,
});

// Default is English (NEEDS §12). Polish is opt-in and remembered per browser.
function initialLang(): Lang {
  const saved = localStorage.getItem("rb_lang");
  return saved === "pl" ? "pl" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    setErrorLocale(dictionaries[lang].errors);
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18n>(
    () => ({
      lang,
      s: dictionaries[lang],
      setLang: (l: Lang) => {
        localStorage.setItem("rb_lang", l);
        setLangState(l);
      },
    }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useStrings = () => useContext(I18nContext).s;
export const useLang = () => {
  const { lang, setLang } = useContext(I18nContext);
  return { lang, setLang };
};
