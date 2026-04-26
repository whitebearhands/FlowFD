import { useTranslations } from "next-intl";
import { CpsVersion } from "@/types/cps";

type Props = {
  versions: CpsVersion[];
  currentVersion: string;
  onSelect: (version: string) => void;
};

export default function CpsVersionHistory({ versions, currentVersion, onSelect }: Props) {
  const t = useTranslations("cps");

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-zinc-500 px-2 mb-2">{t("history.title")}</p>
      {versions.map((v) => (
        <button
          key={v.version}
          type="button"
          onClick={() => onSelect(v.version)}
          className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
            v.version === currentVersion
              ? "bg-zinc-900 text-white"
              : "hover:bg-zinc-100 text-zinc-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono">{v.version}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              v.changeType === "manual_edit"
                ? "bg-purple-100 text-purple-600"
                : "bg-blue-100 text-blue-600"
            }`}>
              {v.changeType === "manual_edit" ? t("history.manual") : t("history.auto")}
            </span>
          </div>
          {v.changedFields?.length > 0 && (
            <p className="text-xs mt-0.5 truncate opacity-70">
              {v.changedFields.join(", ")}
            </p>
          )}
          <p className="text-xs mt-0.5 opacity-50">
            {new Date(v.createdAt).toLocaleDateString()}
          </p>
        </button>
      ))}
    </div>
  );
}
