"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { doc, updateDoc } from "firebase/firestore";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { db } from "@/lib/firebase/firestore";
import { auth } from "@/lib/firebase/auth";
import { useAuth } from "@/lib/firebase/useAuth";
import { useAppData } from "@/lib/firebase/useAppData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ProfileSection() {
  const t = useTranslations("settings.profile");
  const { user } = useAuth();
  const { displayName } = useAppData();

  const [name, setName] = useState(displayName ?? "");
  const [title, setTitle] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const isGoogleUser = user?.providerData.some((p) => p.providerId === "google.com") ?? false;

  async function handleSaveProfile() {
    if (!user) return;
    setIsSavingProfile(true);
    try {
      await updateDoc(doc(db, "users", user.uid), { display_name: name });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleChangePassword() {
    if (!user || !user.email) return;
    setPasswordError("");

    if (newPassword !== confirmPassword) {
      setPasswordError(t("passwordMismatch"));
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError(t("passwordTooShort"));
      return;
    }

    setIsSavingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2000);
    } catch {
      setPasswordError(t("passwordWrong"));
    } finally {
      setIsSavingPassword(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">{t("title")}</h2>
        <p className="text-sm text-zinc-500 mt-0.5">{t("subtitle")}</p>
      </div>

      {/* 프로필 카드 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{t("basicInfo")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 아바타 + 이메일 */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-xl font-semibold text-blue-600 shrink-0">
              {(displayName ?? user?.email ?? "?")[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-900">{displayName ?? t("noName")}</p>
              <p className="text-xs text-zinc-500">{user?.email}</p>
            </div>
          </div>

          {/* 이름 + 직책 2열 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">{t("name")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jobTitle">{t("jobTitle")}</Label>
              <Input
                id="jobTitle"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("jobTitlePlaceholder")}
              />
            </div>
          </div>

          {/* 이메일 (읽기 전용) */}
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              value={user?.email ?? ""}
              readOnly
              className="bg-zinc-50 text-zinc-500 cursor-not-allowed"
            />
            <p className="text-xs text-zinc-400">{t("emailReadOnly")}</p>
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSaveProfile}
              disabled={isSavingProfile}
            >
              {profileSaved ? t("saved") : isSavingProfile ? t("saving") : t("save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 비밀번호 변경 카드 (Google 로그인 유저는 숨김) */}
      {!isGoogleUser && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t("changePassword")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">{t("currentPassword")}</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="newPassword">{t("newPassword")}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="8자 이상"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>
            {passwordError && (
              <p className="text-sm text-red-500">{passwordError}</p>
            )}
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleChangePassword}
                disabled={isSavingPassword || !currentPassword || !newPassword || !confirmPassword}
              >
                {passwordSaved ? t("saved") : isSavingPassword ? t("saving") : t("changePasswordBtn")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
