import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe } from "lucide-react";

const LANGUAGES = [{ code: "en", name: "English" }];

export const LanguageSwitcher = ({ className = "" }: { className?: string }) => {
  const { i18n, t } = useTranslation();

  const currentLang = LANGUAGES.some((l) => l.code === i18n.language)
    ? i18n.language
    : i18n.language?.split("-")[0] || "en";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Globe className="size-4 text-muted-foreground shrink-0" />
      <Select value={currentLang} onValueChange={(lang) => i18n.changeLanguage(lang)}>
        <SelectTrigger className="h-8 w-[110px] bg-background text-xs cursor-pointer focus:ring-0">
          <SelectValue placeholder={t("profile.selectLanguage")} />
        </SelectTrigger>
        <SelectContent className="z-[70]">
          {LANGUAGES.map((lang) => (
            <SelectItem key={lang.code} value={lang.code} className="text-xs cursor-pointer">
              {lang.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
