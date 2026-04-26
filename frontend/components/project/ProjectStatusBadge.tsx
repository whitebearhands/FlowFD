import { ProjectStatus } from "@/types/project";

const statusConfig: Record<ProjectStatus, { label: string; className: string }> = {
  active: {
    label: "활성",
    className: "bg-green-100 text-green-700",
  },
  archived: {
    label: "아카이브",
    className: "bg-zinc-100 text-zinc-500",
  },
};

type Props = {
  status: ProjectStatus;
};

export default function ProjectStatusBadge({ status }: Props) {
  const { label, className } = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
