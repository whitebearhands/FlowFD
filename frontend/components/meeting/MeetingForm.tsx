"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreateMeetingRequest } from "@/types/meeting";

type Props = {
  onSubmit: (data: CreateMeetingRequest) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
};

export default function MeetingForm({
  onSubmit,
  onCancel,
  isLoading = false,
}: Props) {
  const t = useTranslations("meeting.form");

  const today = new Date().toISOString().split("T")[0];
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today);
  const [participantsInput, setParticipantsInput] = useState("");
  const [content, setContent] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const participants = participantsInput
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    await onSubmit({
      title: title || null,
      date,
      participants,
      content,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">
          {t("title")}{" "}
          <span className="text-zinc-400 font-normal">{t("optional")}</span>
        </Label>
        <Input
          id="title"
          placeholder={t("titlePlaceholder")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="date">{t("date")}</Label>
        <Input
          id="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="participants">{t("participants")}</Label>
        <Input
          id="participants"
          placeholder={t("participantsPlaceholder")}
          value={participantsInput}
          onChange={(e) => setParticipantsInput(e.target.value)}
          required
        />
        <p className="text-xs text-zinc-400">{t("participantsHint")}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="content">{t("content")}</Label>
        <textarea
          id="content"
          className="w-full min-h-40 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
          placeholder={t("contentPlaceholder")}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
        />
      </div>
      <div className="flex gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onCancel}
            disabled={isLoading}
          >
            {t("cancel")}
          </Button>
        )}
        <Button type="submit" className="flex-1" disabled={isLoading}>
          {isLoading ? t("submitting") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
