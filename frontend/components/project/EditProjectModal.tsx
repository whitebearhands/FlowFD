"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Project, ProjectColor, UpdateProjectRequest } from "@/types/project";

type EditData = Omit<UpdateProjectRequest, "status"> & { color?: ProjectColor };

const COLOR_OPTIONS: { value: ProjectColor; bg: string; ring: string }[] = [
  { value: "emerald", bg: "bg-emerald-500", ring: "ring-emerald-500" },
  { value: "blue",    bg: "bg-blue-500",    ring: "ring-blue-500" },
  { value: "violet",  bg: "bg-violet-500",  ring: "ring-violet-500" },
  { value: "orange",  bg: "bg-orange-500",  ring: "ring-orange-500" },
  { value: "rose",    bg: "bg-rose-400",    ring: "ring-rose-400" },
  { value: "pink",    bg: "bg-pink-500",    ring: "ring-pink-500" },
  { value: "zinc",    bg: "bg-zinc-400",    ring: "ring-zinc-400" },
];

type Props = {
  project: Project;
  onSave: (data: EditData) => Promise<void>;
  onClose: () => void;
};

export default function EditProjectModal({ project, onSave, onClose }: Props) {
  const t = useTranslations("project");

  const [name, setName] = useState(project.name);
  const [client, setClient] = useState(project.client);
  const [color, setColor] = useState<ProjectColor>(project.color);
  const [description, setDescription] = useState(project.description ?? "");
  const [tags, setTags] = useState<string[]>(project.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [githubRepo, setGithubRepo] = useState(project.githubRepo ?? "");
  const [githubAutoCommit, setGithubAutoCommit] = useState(project.githubAutoCommit);
  const [isLoading, setIsLoading] = useState(false);

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = tagInput.trim();
      if (trimmed && !tags.includes(trimmed)) setTags([...tags, trimmed]);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onSave({
        name,
        description: description || null,
        tags,
        color,
        githubRepo: githubRepo || null,
        githubAutoCommit,
      });
      onClose();
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-sm font-semibold">{t("home.editModal.title")}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">{t("form.name")}</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-client">{t("form.client")}</Label>
              <Input
                id="edit-client"
                value={client}
                disabled
                className="bg-zinc-50 text-zinc-400"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("form.color")}</Label>
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

          <div className="space-y-1.5">
            <Label htmlFor="edit-desc">
              {t("form.description")}{" "}
              <span className="text-zinc-400 font-normal">{t("form.optional")}</span>
            </Label>
            <Textarea
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              {t("form.tags")}{" "}
              <span className="text-zinc-400 font-normal">{t("form.optional")}</span>
            </Label>
            <div className="flex flex-wrap gap-1.5 min-h-9 px-3 py-2 border rounded-md bg-white focus-within:ring-1 focus-within:ring-zinc-400">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-100 text-zinc-700 text-sm rounded"
                >
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} className="text-zinc-400 hover:text-zinc-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder={tags.length === 0 ? t("form.tagsPlaceholder") : ""}
                className="flex-1 min-w-24 text-sm outline-none bg-transparent placeholder:text-zinc-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 border-t" />
            <span className="text-xs text-zinc-400 shrink-0">{t("form.optionalSettings")}</span>
            <div className="flex-1 border-t" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-repo">
              {t("form.githubRepo")}{" "}
              <span className="text-zinc-400 font-normal">{t("form.optional")}</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="edit-repo"
                placeholder={t("form.githubRepoPlaceholder")}
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
                className="flex-1"
              />
              <Button type="button" variant="outline" onClick={handleAutoGenerateRepo} disabled={!name.trim()}>
                {t("form.githubAutoGenerate")}
              </Button>
            </div>
          </div>

          {githubRepo && (
            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div>
                <p className="text-sm font-medium text-zinc-900">{t("form.githubAutoCommit")}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{t("form.githubAutoCommitDesc")}</p>
              </div>
              <Switch checked={githubAutoCommit} onCheckedChange={setGithubAutoCommit} />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              {t("form.cancel")}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? t("home.editModal.saving") : t("home.editModal.save")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
