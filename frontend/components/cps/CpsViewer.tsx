"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CpsDocument, Confidence } from "@/types/cps";
import { updateCps } from "@/lib/api/cpsApi";

// ─── Confidence 배지 ──────────────────────────────────────
const confidenceStyle: Record<Confidence, string> = {
  suspected: "bg-yellow-100 text-yellow-700",
  probable: "bg-blue-100 text-blue-600",
  confirmed: "bg-green-100 text-green-700",
};

function ConfidenceBadge({ confidence }: { confidence: Confidence | null | undefined }) {
  if (!confidence) return null;
  const style = confidenceStyle[confidence as Confidence] ?? "bg-zinc-100 text-zinc-500";
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style}`}>
      {confidence}
    </span>
  );
}

// ─── 섹션 레이블 색상 ────────────────────────────────────
const sectionColors: Record<string, { bg: string; text: string; border: string }> = {
  CONTEXT:      { bg: "bg-green-100",  text: "text-green-700",  border: "border-l-green-500" },
  PROBLEM:      { bg: "bg-orange-100", text: "text-orange-700", border: "border-l-orange-500" },
  SOLUTION:     { bg: "bg-purple-100", text: "text-purple-700", border: "border-l-purple-500" },
  ASSUMPTIONS:  { bg: "bg-blue-100",   text: "text-blue-700",   border: "border-l-blue-500" },
  RISKS:        { bg: "bg-red-100",    text: "text-red-700",    border: "border-l-red-500" },
  "OUT OF SCOPE": { bg: "bg-zinc-100", text: "text-zinc-600",   border: "border-l-zinc-400" },
  PENDING:      { bg: "bg-zinc-100",   text: "text-zinc-600",   border: "border-l-zinc-400" },
  "DECISION LOG": { bg: "bg-zinc-100", text: "text-zinc-600",   border: "border-l-zinc-400" },
};

// ─── 편집 모달 ───────────────────────────────────────────
function EditModal({
  fieldPath, currentValue, onSave, onClose,
}: {
  fieldPath: string;
  currentValue: string;
  onSave: (value: string) => Promise<void>;
  onClose: () => void;
}) {
  const t = useTranslations("cps");
  const [value, setValue] = useState(currentValue);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    await onSave(value);
    setIsSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-medium text-zinc-500 mb-2 font-mono">{fieldPath}</p>
        <textarea
          className="w-full border rounded-md px-3 py-2 text-sm resize-y min-h-[120px] outline-none focus:ring-1 focus:ring-zinc-400"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-3">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-zinc-600 border rounded-md hover:bg-zinc-50">{t("edit.cancel")}</button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-3 py-1.5 text-sm bg-zinc-900 text-white rounded-md hover:bg-zinc-700 disabled:opacity-50"
          >
            {isSaving ? t("edit.saving") : t("edit.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 필드 행 ─────────────────────────────────────────────
function FieldRow({
  label, value, fieldPath, onEdit, extra, isSample,
}: {
  label: string;
  value: string | null | undefined;
  fieldPath?: string;
  onEdit?: (path: string, current: string) => void;
  extra?: React.ReactNode;
  isSample?: boolean;
}) {
  const t = useTranslations("cps");
  const [hovered, setHovered] = useState(false);
  if (!value) return null;
  return (
    <div
      className="group flex gap-3 py-2.5 px-2 rounded-md hover:bg-zinc-50 transition-colors border border-transparent hover:border-zinc-100"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-zinc-400 mb-0.5">{label}</p>
        <div className="flex items-start gap-2">
          <p className="text-sm text-zinc-700 whitespace-pre-wrap flex-1">{value}</p>
          {extra}
        </div>
      </div>
      {fieldPath && onEdit && hovered && !isSample && (
        <button
          type="button"
          onClick={() => onEdit(fieldPath, value)}
          className="shrink-0 text-xs text-blue-500 hover:text-blue-700 self-start mt-0.5"
        >
          {t("edit.editBtn")}
        </button>
      )}
    </div>
  );
}

// ─── 섹션 카드 ────────────────────────────────────────────
function SectionCard({
  sectionKey, label, children, defaultOpen = true, twoCol = false,
}: {
  sectionKey: string;
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  twoCol?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const colors = sectionColors[sectionKey] ?? sectionColors["DECISION LOG"];

  return (
    <div
      id={`cps-section-${sectionKey.toLowerCase().replace(/ /g, "-")}`}
      className={`bg-white rounded-lg border border-l-4 ${colors.border} overflow-hidden`}
    >
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors text-left"
      >
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${colors.bg} ${colors.text} shrink-0`}>
          {sectionKey}
        </span>
        <span className="text-sm font-medium text-zinc-700 flex-1">{label}</span>
        <svg
          className={`w-4 h-4 text-zinc-400 transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className={
          twoCol
            ? "px-4 pb-3 grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-0"
            : "px-4 pb-3 divide-y divide-zinc-50"
        }>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── 메인 ────────────────────────────────────────────────
type Props = {
  cps: CpsDocument;
  projectId: string;
  onUpdated?: () => void;
  isSample?: boolean;
};

export default function CpsViewer({ cps, projectId, onUpdated, isSample }: Props) {
  const t = useTranslations("cps");
  const [editTarget, setEditTarget] = useState<{ path: string; value: string } | null>(null);
  const [checkedPending, setCheckedPending] = useState<Set<string>>(new Set());

  function handleEdit(path: string, current: string) {
    setEditTarget({ path, value: current });
  }

  async function handleSave(value: string) {
    if (!editTarget) return;
    await updateCps(projectId, { fieldPath: editTarget.path, value });
    onUpdated?.();
  }

  function togglePending(key: string) {
    setCheckedPending((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const empty = <p className="text-xs text-zinc-400 italic py-2">{t("empty")}</p>;

  return (
    <div className="space-y-3">
      {/* CONTEXT */}
      <SectionCard sectionKey="CONTEXT" label={t("section.context")} twoCol>
        {cps.context?.background || cps.context?.environment || cps.context?.stakeholders || cps.context?.constraints ? (
          <>
            <FieldRow label={t("field.background")} value={cps.context?.background} fieldPath="context.background" onEdit={handleEdit} isSample={isSample} />
            <FieldRow label={t("field.environment")} value={cps.context?.environment} fieldPath="context.environment" onEdit={handleEdit} isSample={isSample} />
            <FieldRow label={t("field.stakeholders")} value={cps.context?.stakeholders} fieldPath="context.stakeholders" onEdit={handleEdit} isSample={isSample} />
            <FieldRow label={t("field.constraints")} value={cps.context?.constraints} fieldPath="context.constraints" onEdit={handleEdit} isSample={isSample} />
          </>
        ) : empty}
      </SectionCard>

      {/* PROBLEM */}
      <SectionCard sectionKey="PROBLEM" label={t("section.problem")} twoCol>
        {cps.problem?.businessProblem || cps.problem?.technicalProblem || cps.problem?.impact || cps.problem?.rootCause?.content ? (
          <>
            <FieldRow label={t("field.businessProblem")} value={cps.problem?.businessProblem} fieldPath="problem.business_problem" onEdit={handleEdit} isSample={isSample} />
            <FieldRow label={t("field.technicalProblem")} value={cps.problem?.technicalProblem} fieldPath="problem.technical_problem" onEdit={handleEdit} isSample={isSample} />
            <FieldRow label={t("field.impact")} value={cps.problem?.impact} fieldPath="problem.impact" onEdit={handleEdit} isSample={isSample} />
            {cps.problem?.rootCause?.content && (
              <FieldRow
                label={t("field.rootCause")}
                value={cps.problem.rootCause.content}
                fieldPath="problem.root_cause.content"
                onEdit={handleEdit}
                extra={<ConfidenceBadge confidence={cps.problem.rootCause.confidence as Confidence} />}
                isSample={isSample}
              />
            )}
          </>
        ) : empty}
      </SectionCard>

      {/* SOLUTION */}
      <SectionCard sectionKey="SOLUTION" label={t("section.solution")} twoCol>
        {cps.solution?.proposedByClient || cps.solution?.proposedByFde || cps.solution?.hypothesis?.content || cps.solution?.successCriteria ? (
          <>
            <FieldRow label={t("field.proposedByClient")} value={cps.solution?.proposedByClient} fieldPath="solution.proposed_by_client" onEdit={handleEdit} isSample={isSample} />
            <FieldRow label={t("field.proposedByFde")} value={cps.solution?.proposedByFde} fieldPath="solution.proposed_by_fde" onEdit={handleEdit} isSample={isSample} />
            {cps.solution?.hypothesis?.content && (
              <FieldRow
                label={t("field.hypothesis")}
                value={cps.solution.hypothesis.content}
                fieldPath="solution.hypothesis.content"
                onEdit={handleEdit}
                extra={<ConfidenceBadge confidence={cps.solution.hypothesis.confidence as Confidence} />}
                isSample={isSample}
              />
            )}
            <FieldRow label={t("field.successCriteria")} value={cps.solution?.successCriteria} fieldPath="solution.success_criteria" onEdit={handleEdit} isSample={isSample} />
          </>
        ) : empty}
      </SectionCard>

      {/* ASSUMPTIONS */}
      <SectionCard sectionKey="ASSUMPTIONS" label={t("section.assumptions")} defaultOpen={false}>
        {cps.assumptions?.length ? (
          <ul className="space-y-3 py-2">
            {cps.assumptions.map((a, i) => (
              <li key={i} className="border-l-2 border-blue-200 pl-3">
                <p className="text-sm text-zinc-700">{a.content}</p>
                {a.riskIfWrong && (
                  <p className="text-xs text-red-500 mt-1">
                    <span className="font-medium">{t("field.riskIfWrong")}:</span> {a.riskIfWrong}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : empty}
      </SectionCard>

      {/* RISKS */}
      <SectionCard sectionKey="RISKS" label={t("section.risks")} defaultOpen={false}>
        {cps.risks?.technical?.length || cps.risks?.business?.length ? (
          <div className="py-2 space-y-3">
            {cps.risks?.technical?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-zinc-400 mb-1">{t("field.technicalRisks")}</p>
                <ul className="list-disc list-inside space-y-1">
                  {cps.risks.technical.map((r, i) => <li key={i} className="text-sm text-zinc-700">{r}</li>)}
                </ul>
              </div>
            )}
            {cps.risks?.business?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-zinc-400 mb-1">{t("field.businessRisks")}</p>
                <ul className="list-disc list-inside space-y-1">
                  {cps.risks.business.map((r, i) => <li key={i} className="text-sm text-zinc-700">{r}</li>)}
                </ul>
              </div>
            )}
          </div>
        ) : empty}
      </SectionCard>

      {/* OUT OF SCOPE */}
      <SectionCard sectionKey="OUT OF SCOPE" label={t("section.outOfScope")} defaultOpen={false}>
        {cps.outOfScope?.length ? (
          <ul className="list-disc list-inside space-y-1 py-2">
            {cps.outOfScope.map((item, i) => <li key={i} className="text-sm text-zinc-700">{item}</li>)}
          </ul>
        ) : empty}
      </SectionCard>

      {/* PENDING */}
      <SectionCard sectionKey="PENDING" label={t("section.pending")} defaultOpen>
        {cps.pending?.questions?.length || cps.pending?.insights?.length || cps.pending?.solutionIdeas?.length ? (
          <div className="py-2 space-y-4">
            {(["questions", "insights", "solutionIdeas"] as const).map((type) => {
              const items = cps.pending?.[type] ?? [];
              if (!items.length) return null;
              const typeLabel = t(`field.${type}`);
              const typeColor = type === "questions" ? "bg-red-100 text-red-600" : type === "insights" ? "bg-yellow-100 text-yellow-600" : "bg-blue-100 text-blue-600";
              return (
                <div key={type}>
                  <p className="text-xs font-medium text-zinc-400 mb-2">{typeLabel}</p>
                  <ul className="space-y-1.5">
                    {items.map((item, i) => {
                      const key = `${type}-${i}`;
                      const done = checkedPending.has(key);
                      return (
                        <li key={i} className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={done}
                            onChange={() => togglePending(key)}
                            className="mt-0.5 shrink-0 accent-blue-500"
                          />
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${typeColor}`}>
                              {typeLabel.slice(0, 2)}
                            </span>
                            <span className={`text-sm ${done ? "line-through text-zinc-400" : "text-zinc-700"}`}>
                              {item}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : empty}
      </SectionCard>

      {/* DECISION LOG */}
      <SectionCard sectionKey="DECISION LOG" label={t("section.decisionLog")} defaultOpen={false}>
        {cps.decisionLog?.length ? (
          <ul className="space-y-3 py-2">
            {cps.decisionLog.map((entry, i) => (
              <li key={i} className="text-xs">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono font-medium text-zinc-700">{entry.changed}</span>
                  {entry.meetingId && (
                    <span className="text-zinc-400">{t("edit.meetingRef")}{entry.meetingId.slice(0, 6)}</span>
                  )}
                </div>
                {entry.reason && <p className="text-zinc-500">{entry.reason}</p>}
              </li>
            ))}
          </ul>
        ) : empty}
      </SectionCard>

      {/* 편집 모달 */}
      {editTarget && (
        <EditModal
          fieldPath={editTarget.path}
          currentValue={editTarget.value}
          onSave={handleSave}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}
