import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import AnalysisStatusBadge from "./AnalysisStatusBadge";
import { MeetingSummary } from "@/types/meeting";

type Props = {
  meeting: MeetingSummary;
};

export default function MeetingCard({ meeting }: Props) {
  const t = useTranslations("meeting");

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-sm">
              {meeting.title ?? t("untitled")}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">{meeting.date}</p>
          </div>
          <AnalysisStatusBadge status={meeting.analysisStatus} />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-zinc-500">
          {t("participants")}: {meeting.participants.join(", ")}
        </p>
      </CardContent>
    </Card>
  );
}
