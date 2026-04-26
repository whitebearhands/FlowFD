"use client";

import { useEffect, useState } from "react";
import { listenToLatestJobs } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/firebase/useAuth";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function JobStatusPanel({ projectId }: { projectId: string }) {
  const { groupId } = useAuth();
  const t = useTranslations("jobs");
  const [jobs, setJobs] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!groupId || !projectId) return;
    const unsub = listenToLatestJobs(groupId, projectId, 5, (newJobs) => {
      setJobs(newJobs);
      // Processing 중인 작업이 있으면 자동으로 패널을 엽니다.
      if (newJobs.some((j) => j.status === "processing")) {
        setIsOpen(true);
      }
    });
    return () => unsub();
  }, [groupId, projectId]);

  if (jobs.length === 0) return null;

  const activeCount = jobs.filter((j) => j.status === "processing").length;
  
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 text-sm">
      {isOpen && (
        <div className="bg-white border rounded-lg shadow-xl w-72 overflow-hidden flex flex-col max-h-80 animate-in slide-in-from-bottom-2 fade-in relative">
          <div className="bg-zinc-50 border-b px-4 py-2.5 font-medium text-zinc-700 flex justify-between items-center z-10 sticky top-0">
            <span className="text-xs font-semibold">{t("title", { count: activeCount })}</span>
            <button onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-zinc-600 outline-none">
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-y-auto w-full p-2 space-y-1">
            {jobs.map((job) => (
              <div key={job.id} className={`flex items-start gap-3 p-2.5 rounded transition-colors ${job.status === "processing" ? "bg-blue-50/50" : "hover:bg-zinc-50"}`}>
                <div className="mt-0.5 shrink-0">
                  {job.status === "processing" && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                  {job.status === "completed" && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  {job.status === "failed" && <XCircle className="w-4 h-4 text-red-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-zinc-900 truncate text-xs">
                    {/* fallback manually since next-intl will throw if strictly checked or return the key */}
                    {job.type === "cps_analysis" || job.type === "prd_generation" || job.type === "design_generation"
                      ? t(`types.${job.type}`) 
                      : job.type}
                  </p>
                  <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                    {job.status === "processing" 
                      ? t("status.processing") 
                      : job.status === "completed" ? t("status.completed") : t("status.failed")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {!isOpen && activeCount > 0 && (
         <button onClick={() => setIsOpen(true)} className="bg-white border shadow-lg rounded-full pl-3 pr-4 py-2 flex items-center gap-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors animate-in fade-in slide-in-from-bottom-4 outline-none">
           <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
           <span className="text-xs">{t("active_summary", { count: activeCount })}</span>
           <ChevronUp className="w-3.5 h-3.5 text-zinc-400 ml-0.5" />
         </button>
      )}
    </div>
  );
}
