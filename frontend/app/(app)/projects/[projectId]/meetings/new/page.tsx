"use client";

import { useState, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createMeeting } from "@/lib/api/meetingApi";

type Props = {
  params: Promise<{ projectId: string }>;
};

type InputMode = "write" | "upload";
type EditorTab = "edit" | "preview";

export default function NewMeetingPage({ params }: Props) {
  const { projectId } = use(params);
  const router = useRouter();
  const t = useTranslations("meeting.form");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [title, setTitle] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [participantInput, setParticipantInput] = useState("");
  const [content, setContent] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("write");
  const [editorTab, setEditorTab] = useState<EditorTab>("edit");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // 참석자 태그 추가
  function addParticipant() {
    const name = participantInput.trim();
    if (name && !participants.includes(name)) {
      setParticipants([...participants, name]);
    }
    setParticipantInput("");
  }

  function removeParticipant(name: string) {
    setParticipants(participants.filter((p) => p !== name));
  }

  function handleParticipantKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); addParticipant(); }
    if (e.key === "Backspace" && !participantInput && participants.length) {
      setParticipants(participants.slice(0, -1));
    }
  }

  // 마크다운 툴바 액션
  const textarea = useRef<HTMLTextAreaElement>(null);
  function insertMarkdown(before: string, after = "") {
    const el = textarea.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.slice(start, end);
    const newContent =
      content.slice(0, start) + before + selected + after + content.slice(end);
    setContent(newContent);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(
        start + before.length,
        start + before.length + selected.length
      );
    }, 0);
  }

  const toolbarButtons = [
    { label: "B", action: () => insertMarkdown("**", "**"), title: "Bold" },
    { label: "I", action: () => insertMarkdown("*", "*"), title: "Italic" },
    { label: "H2", action: () => insertMarkdown("## "), title: "Heading 2" },
    { label: "H3", action: () => insertMarkdown("### "), title: "Heading 3" },
    { label: "•", action: () => insertMarkdown("- "), title: "List" },
    { label: "1.", action: () => insertMarkdown("1. "), title: "Ordered List" },
    { label: "❝", action: () => insertMarkdown("> "), title: "Quote" },
  ];

  // 파일 업로드
  function handleFile(file: File) {
    if (!file.name.match(/\.(txt|md)$/i)) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setContent(e.target?.result as string ?? "");
      setInputMode("write");
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function handleSubmit(analyze: boolean) {
    if (!content.trim() || participants.length === 0) return;
    setIsSubmitting(true);
    try {
      await createMeeting(projectId, {
        title: title || null,
        date,
        participants,
        content,
        analyze,
      });
      router.push(`/projects/${projectId}/meetings`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* 폼 헤더 */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold">{t("pageTitle")}</h1>
        <p className="text-sm text-zinc-500 mt-1">{t("analyzeHint")}</p>
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
        {/* 날짜 + 제목 (2열) */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="date">{t("date")}</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="title">
              {t("title")}{" "}
              <span className="text-zinc-400 font-normal text-xs">{t("optional")}</span>
            </Label>
            <Input
              id="title"
              placeholder={t("titlePlaceholder")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        </div>

        {/* 참석자 태그 입력 */}
        <div className="space-y-1.5">
          <Label>{t("participants")}</Label>
          <div className="flex flex-wrap items-center gap-1.5 min-h-10 px-3 py-1.5 rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
            {participants.map((p) => (
              <span
                key={p}
                className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full"
              >
                {p}
                <button
                  type="button"
                  onClick={() => removeParticipant(p)}
                  className="hover:text-blue-900"
                >×</button>
              </span>
            ))}
            <input
              className="flex-1 min-w-20 text-sm outline-none bg-transparent"
              placeholder={participants.length === 0 ? t("participantsPlaceholder") : ""}
              value={participantInput}
              onChange={(e) => setParticipantInput(e.target.value)}
              onKeyDown={handleParticipantKeyDown}
              onBlur={addParticipant}
            />
          </div>
          <p className="text-xs text-zinc-400">{t("participantsHint")}</p>
        </div>

        {/* 미팅 내용 에디터 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>{t("content")}</Label>
            {/* 입력 방식 탭 */}
            <div className="flex text-xs border rounded overflow-hidden">
              <button
                type="button"
                onClick={() => setInputMode("write")}
                className={`px-3 py-1 ${inputMode === "write" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50"}`}
              >
                {t("inputMode.write")}
              </button>
              <button
                type="button"
                onClick={() => setInputMode("upload")}
                className={`px-3 py-1 border-l ${inputMode === "upload" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50"}`}
              >
                {t("inputMode.upload")}
              </button>
            </div>
          </div>

          {inputMode === "write" && (
            <div className="border rounded-md overflow-hidden">
              {/* 툴바 + 편집/미리보기 탭 */}
              <div className="flex items-center justify-between border-b bg-zinc-50 px-2 py-1">
                {editorTab === "edit" && (
                  <div className="flex gap-0.5">
                    {toolbarButtons.map((btn) => (
                      <button
                        key={btn.label}
                        type="button"
                        title={btn.title}
                        onClick={btn.action}
                        className="px-2 py-0.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200 rounded"
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                )}
                {editorTab === "preview" && <div />}
                <div className="flex text-xs border rounded overflow-hidden ml-auto">
                  <button
                    type="button"
                    onClick={() => setEditorTab("edit")}
                    className={`px-3 py-0.5 ${editorTab === "edit" ? "bg-white text-zinc-900 font-medium" : "text-zinc-500"}`}
                  >
                    {t("editorTab.edit")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorTab("preview")}
                    className={`px-3 py-0.5 border-l ${editorTab === "preview" ? "bg-white text-zinc-900 font-medium" : "text-zinc-500"}`}
                  >
                    {t("editorTab.preview")}
                  </button>
                </div>
              </div>

              {editorTab === "edit" ? (
                <textarea
                  ref={textarea}
                  className="w-full px-4 py-3 text-sm font-mono resize-y outline-none min-h-[260px]"
                  placeholder={t("contentPlaceholder")}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                />
              ) : (
                <div className="px-4 py-3 min-h-[260px] text-sm text-zinc-800 leading-relaxed [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-4 [&_ul]:list-disc [&_ul]:ml-5 [&_ol]:list-decimal [&_ol]:ml-5 [&_li]:text-zinc-700 [&_p]:text-zinc-700 [&_blockquote]:border-l-4 [&_blockquote]:border-zinc-300 [&_blockquote]:pl-4 [&_blockquote]:text-zinc-500">
                  {content ? (
                    <ReactMarkdown>{content}</ReactMarkdown>
                  ) : (
                    <p className="text-zinc-400 italic">{t("previewEmpty")}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {inputMode === "upload" && (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`min-h-[260px] flex flex-col items-center justify-center rounded-md border-2 border-dashed cursor-pointer transition-colors ${
                isDragging ? "border-blue-400 bg-blue-50" : "border-zinc-200 hover:border-zinc-400"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
              <p className="text-sm text-zinc-500 font-medium">{t("upload.dropHere")}</p>
              <p className="text-xs text-zinc-400 mt-1">{t("upload.formats")}</p>
              {content && (
                <p className="text-xs text-green-600 mt-2">{t("upload.loaded")}</p>
              )}
            </div>
          )}
          <p className="text-xs text-zinc-400">{t("contentHint")}</p>
        </div>

        {/* 폼 푸터 */}
        <div className="flex items-center justify-between pt-2 border-t">
          <p className="text-xs text-zinc-500">{t("submitHint")}</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting || !content.trim() || participants.length === 0}
            >
              {t("submitSaveOnly")}
            </Button>
            <Button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting || !content.trim() || participants.length === 0}
            >
              {isSubmitting ? t("submitting") : t("submit")}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
