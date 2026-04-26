"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser, signInWithGoogle } from "@/lib/firebase/auth";
import app from "@/lib/firebase/firebaseConfig";
import { register, joinGroup } from "@/lib/api/authApi";

type GroupAction = "create" | "join";

export default function RegisterPage() {
  const t = useTranslations("auth.register");
  const tErr = useTranslations("auth.errors");
  const router = useRouter();

  // 이미 로그인된 사용자 (Firestore 문서만 없는 경우)
  const [existingUser, setExistingUser] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [groupAction, setGroupAction] = useState<GroupAction>("create");
  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [githubPat, setGithubPat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    if (user) setExistingUser(user.email ?? user.uid);
  }, []);

  async function completeBackendRegistration() {
    const pat = githubPat.trim() || undefined;
    if (groupAction === "create") {
      await register({ groupName, displayName, githubPat: pat });
    } else {
      await joinGroup({ inviteCode, displayName, githubPat: pat });
    }
  }

  // 케이스 1: 이미 로그인된 사용자 → 백엔드 등록만
  async function handleExistingUserRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await completeBackendRegistration();
      router.push("/dashboard");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        .response?.data?.detail;
      if (detail === "Invalid invite code") {
        setError(tErr("invalidInviteCode"));
      } else {
        setError(tErr("unknown"));
      }
    } finally {
      setIsLoading(false);
    }
  }

  // 케이스 2: 구글 회원가입 → 인증 후 그룹 설정 단계로 전환
  async function handleGoogleRegister() {
    setError(null);
    setIsLoading(true);
    try {
      const user = await signInWithGoogle();
      setDisplayName(user.displayName ?? "");
      setExistingUser(user.email ?? user.uid);
    } catch {
      setError(tErr("unknown"));
    } finally {
      setIsLoading(false);
    }
  }

  // 케이스 3: 신규 이메일 회원가입
  async function handleEmailRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const auth = getAuth(app);
      await createUserWithEmailAndPassword(auth, email, password);
      await completeBackendRegistration();
      router.push("/dashboard");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "auth/email-already-in-use") {
        setError(tErr("emailAlreadyInUse"));
      } else if (code === "auth/weak-password") {
        setError(tErr("weakPassword"));
      } else {
        setError(tErr("unknown"));
      }
    } finally {
      setIsLoading(false);
    }
  }

  const groupFields = (
    <>
      <div className="space-y-2">
        <Label htmlFor="displayName">{t("displayName")}</Label>
        <Input
          id="displayName"
          placeholder={t("displayNamePlaceholder")}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label>{t("groupAction")}</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={groupAction === "create" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setGroupAction("create")}
          >
            {t("createGroup")}
          </Button>
          <Button
            type="button"
            variant={groupAction === "join" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setGroupAction("join")}
          >
            {t("joinGroup")}
          </Button>
        </div>
      </div>
      {groupAction === "create" ? (
        <div className="space-y-2">
          <Label htmlFor="groupName">{t("groupName")}</Label>
          <Input
            id="groupName"
            placeholder={t("groupNamePlaceholder")}
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            required
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="inviteCode">{t("inviteCode")}</Label>
          <Input
            id="inviteCode"
            placeholder={t("inviteCodePlaceholder")}
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            required
          />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="githubPat">{t("githubPat")}</Label>
        <Input
          id="githubPat"
          placeholder={t("githubPatPlaceholder")}
          value={githubPat}
          onChange={(e) => setGithubPat(e.target.value)}
          autoComplete="off"
        />
        <p className="text-xs text-zinc-500">{t("githubPatHint")}</p>
      </div>
    </>
  );

  // 이미 로그인된 사용자: 그룹 설정만 보여줌
  if (existingUser) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>
            {existingUser} {t("subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleExistingUserRegister} className="space-y-4">
            {groupFields}
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t("loading") : t("submitButton")}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* <form onSubmit={handleEmailRegister} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              type="password"
              placeholder={t("passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {groupFields}
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? t("loading") : t("submitButton")}
          </Button>
        </form>
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs text-zinc-400">
            <span className="bg-white px-2">OR</span>
          </div>
        </div> */}
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGoogleRegister}
          disabled={isLoading}
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {t("googleButton")}
        </Button>
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <span className="text-zinc-500">{t("hasAccount")}&nbsp;</span>
        <Link href="/login" className="font-medium hover:underline">
          {t("loginLink")}
        </Link>
      </CardFooter>
    </Card>
  );
}
