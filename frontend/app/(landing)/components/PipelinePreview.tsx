type Props = {
  labels: {
    meeting: string;
    design: string;
    code: string;
  };
};

const steps = [
  {
    labelKey: "meeting" as const,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 16 16" stroke="#1D9E75" strokeWidth={1.5}>
        <path strokeLinecap="round" d="M2 4h12M2 7h8M2 10h10" />
      </svg>
    ),
  },
  {
    label: "CPS",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 16 16" stroke="#1D9E75" strokeWidth={1.5}>
        <circle cx="8" cy="8" r="5" />
        <path strokeLinecap="round" d="M8 5v3l2 2" />
      </svg>
    ),
  },
  {
    label: "PRD",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 16 16" stroke="#1D9E75" strokeWidth={1.5}>
        <rect x="2" y="2" width="12" height="12" rx="2" />
        <path strokeLinecap="round" d="M5 6h6M5 9h4" />
      </svg>
    ),
  },
  {
    labelKey: "design" as const,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 16 16" stroke="#1D9E75" strokeWidth={1.5}>
        <path strokeLinecap="round" d="M2 8h3l2-5 2 10 2-5h3" />
      </svg>
    ),
  },
  {
    labelKey: "code" as const,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 16 16" stroke="#1D9E75" strokeWidth={1.5}>
        <polyline points="4,5 1,8 4,11" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="12,5 15,8 12,11" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="9" y1="3" x2="7" y2="13" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "GitHub",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 16 16" fill="#1D9E75">
        <path d="M8 1C4.13 1 1 4.13 1 8c0 3.08 2 5.7 4.74 6.62.35.06.47-.15.47-.34v-1.18c-1.93.42-2.33-.93-2.33-.93-.32-.8-.77-1.02-.77-1.02-.63-.43.05-.42.05-.42.7.05 1.06.71 1.06.71.62 1.06 1.63.75 2.03.57.06-.44.24-.75.44-.92-1.55-.17-3.18-.77-3.18-3.44 0-.76.27-1.38.71-1.87-.07-.18-.31-.88.07-1.84 0 0 .58-.19 1.9.71a6.6 6.6 0 011.74-.23c.59 0 1.18.08 1.74.23 1.32-.9 1.9-.71 1.9-.71.38.96.14 1.66.07 1.84.44.49.71 1.11.71 1.87 0 2.68-1.64 3.27-3.19 3.44.25.21.47.63.47 1.28v1.89c0 .19.12.41.47.34C13 13.7 15 11.08 15 8c0-3.87-3.13-7-7-7z" />
      </svg>
    ),
  },
];

export default function PipelinePreview({ labels }: Props) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-2xl px-8 py-6 flex items-center">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center flex-1 min-w-0">
          <div className="flex flex-col items-center flex-1 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-white border border-[#1D9E75]/25 shadow-sm flex items-center justify-center mb-3">
              {step.icon}
            </div>
            <div className="text-[14px] font-semibold text-gray-800 truncate">
              {step.labelKey ? labels[step.labelKey] : step.label}
            </div>
          </div>
          {i < steps.length - 1 && (
            <div className="text-[#1D9E75]/40 text-[18px] font-bold flex-shrink-0 mb-5 mx-1">→</div>
          )}
        </div>
      ))}
    </div>
  );
}
