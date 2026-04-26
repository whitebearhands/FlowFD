"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { CreateProjectRequest, ProjectColor } from "@/types/project";
import { X } from "lucide-react";

type Props = {
  onSubmit: (data: CreateProjectRequest, addFirstMeeting: boolean) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  formId?: string;
};

const COLOR_OPTIONS: { value: ProjectColor; bg: string; ring: string }[] = [
  { value: "emerald", bg: "bg-emerald-500", ring: "ring-emerald-500" },
  { value: "blue",    bg: "bg-blue-500",    ring: "ring-blue-500" },
  { value: "violet",  bg: "bg-violet-500",  ring: "ring-violet-500" },
  { value: "orange",  bg: "bg-orange-500",  ring: "ring-orange-500" },
  { value: "rose",    bg: "bg-rose-400",    ring: "ring-rose-400" },
  { value: "pink",    bg: "bg-pink-500",    ring: "ring-pink-500" },
  { value: "zinc",    bg: "bg-zinc-400",    ring: "ring-zinc-400" },
];

export default function ProjectForm({ onSubmit, onCancel, isLoading = false, formId }: Props) {
  const t = useTranslations("project.form");

  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [color, setColor] = useState<ProjectColor>("blue");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [githubAutoCommit, setGithubAutoCommit] = useState(false);
  const [addFirstMeeting, setAddFirstMeeting] = useState(false);

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = tagInput.trim();
      if (trimmed && !tags.includes(trimmed)) {
        setTags([...tags, trimmed]);
      }
      setTagInput("");
    }
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  function handleAutoGenerateRepo() {
    const slug = name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (slug) setGithubRepo(slug);
  }

  async function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    await onSubmit(
      {
        name,
        client,
        color,
        description: description || null,
        tags,
        githubRepo: githubRepo || null,
        githubAutoCommit,
      },
      addFirstMeeting
    );
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-6">
      {/* 프로젝트명 + 고객사명 2열 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">{t("name")}</Label>
          <Input
            id="name"
            placeholder={t("namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="client">{t("client")}</Label>
          <Input
            id="client"
            placeholder={t("clientPlaceholder")}
            value={client}
            onChange={(e) => setClient(e.target.value)}
            required
          />
        </div>
      </div>

      {/* 프로젝트 색상 */}
      <div className="space-y-2">
        <Label>{t("color")}</Label>
        <div className="flex gap-2">
          {COLOR_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setColor(opt.value)}
              className={`w-6 h-6 rounded-full ${opt.bg} transition-all ${
                color === opt.value
                  ? `ring-2 ring-offset-2 ${opt.ring}`
                  : "hover:scale-110"
              }`}
            />
          ))}
        </div>
      </div>

      {/* 설명 */}
      <div className="space-y-2">
        <Label htmlFor="description">
          {t("description")}{" "}
          <span className="text-zinc-400 font-normal">{t("optional")}</span>
        </Label>
        <Textarea
          id="description"
          placeholder={t("descriptionPlaceholder")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="resize-none"
        />
      </div>

      {/* 태그 */}
      <div className="space-y-2">
        <Label htmlFor="tags">
          {t("tags")}{" "}
          <span className="text-zinc-400 font-normal">{t("optional")}</span>
        </Label>
        <div className="flex flex-wrap gap-1.5 min-h-9 px-3 py-2 border rounded-md bg-white focus-within:ring-1 focus-within:ring-zinc-400">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-100 text-zinc-700 text-sm rounded"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <input
            id="tags"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder={tags.length === 0 ? t("tagsPlaceholder") : ""}
            className="flex-1 min-w-24 text-sm outline-none bg-transparent placeholder:text-zinc-400"
          />
        </div>
      </div>

      {/* 구분선 */}
      <div className="flex items-center gap-3">
        <div className="flex-1 border-t" />
        <span className="text-xs text-zinc-400 shrink-0">{t("optionalSettings")}</span>
        <div className="flex-1 border-t" />
      </div>

      {/* GitHub 레포 연결 */}
      <div className="space-y-2">
        <Label htmlFor="githubRepo">
          {t("githubRepo")}{" "}
          <span className="text-zinc-400 font-normal">{t("optional")}</span>
        </Label>
        <div className="flex gap-2">
          <Input
            id="githubRepo"
            placeholder={t("githubRepoPlaceholder")}
            value={githubRepo}
            onChange={(e) => setGithubRepo(e.target.value)}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleAutoGenerateRepo}
            disabled={!name.trim()}
          >
            {t("githubAutoGenerate")}
          </Button>
        </div>
      </div>

      {/* GitHub Auto Commit 토글 */}
      {githubRepo && (
        <div className="flex items-center justify-between rounded-lg border px-4 py-3">
          <div>
            <p className="text-sm font-medium text-zinc-900">{t("githubAutoCommit")}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{t("githubAutoCommitDesc")}</p>
          </div>
          <Switch
            checked={githubAutoCommit}
            onCheckedChange={setGithubAutoCommit}
          />
        </div>
      )}

      {/* 첫 미팅 추가 토글 */}
      <div className="flex items-center justify-between rounded-lg border px-4 py-3">
        <div>
          <p className="text-sm font-medium text-zinc-900">{t("addFirstMeeting")}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{t("addFirstMeetingDesc")}</p>
        </div>
        <Switch
          checked={addFirstMeeting}
          onCheckedChange={setAddFirstMeeting}
        />
      </div>

      {/* 폼 푸터 */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? t("submitting") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
