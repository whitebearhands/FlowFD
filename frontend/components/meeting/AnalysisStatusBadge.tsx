"use client";

import { useTranslations } from "next-intl";
import { AnalysisStatus } from "@/types/meeting";

const statusClass: Record<AnalysisStatus, string> = {
  pending:    "bg-zinc-100 text-zinc-500",
  processing: "bg-blue-100 text-blue-600",
  completed:  "bg-green-100 text-green-700",
  failed:     "bg-red-100 text-red-600",
};

type Props = { status: AnalysisStatus };

export default function AnalysisStatusBadge({ status }: Props) {
  const t = useTranslations("meeting.analysisStatus");
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusClass[status]}`}
    >
      {status === "processing" && (
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
      )}
      {t(status)}
    </span>
  );
}
