"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/firebase/useAuth";
import { useAppData } from "@/lib/firebase/useAppData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, RefreshCw } from "lucide-react";

type Member = {
  userId: string;
  displayName: string | null;
  email: string | null;
  role: "admin" | "member";
};

export default function TeamSection() {
  const t = useTranslations("settings.team");
  const { user, groupId } = useAuth();
  const { groupName } = useAppData();

  const [members, setMembers] = useState<Member[]>([]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<"admin" | "member">("member");
  const [inviteEmail, setInviteEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user || !groupId) return;
    fetchTeamData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, groupId]);

  async function fetchTeamData() {
    if (!user || !groupId) return;
    setIsLoading(true);
    try {
      const [groupDoc, membersSnap] = await Promise.all([
        getDoc(doc(db, "groups", groupId)),
        getDocs(collection(db, "groups", groupId, "members")),
      ]);

      if (groupDoc.exists()) {
        setInviteCode(groupDoc.data().invite_code ?? null);
      }

      const memberList: Member[] = [];
      for (const memberDoc of membersSnap.docs) {
        const role = memberDoc.data().role as "admin" | "member";
        if (memberDoc.id === user.uid) setMyRole(role);

        const userDoc = await getDoc(doc(db, "users", memberDoc.id));
        memberList.push({
          userId: memberDoc.id,
          displayName: userDoc.exists() ? userDoc.data().display_name ?? null : null,
          email: userDoc.exists() ? userDoc.data().email ?? null : null,
          role,
        });
      }
      setMembers(memberList);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRegenerateCode() {
    if (!groupId) return;
    const newCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    await updateDoc(doc(db, "groups", groupId), { invite_code: newCode });
    setInviteCode(newCode);
  }

  async function handleRemoveMember(userId: string) {
    if (!groupId) return;
    await setDoc(
      doc(db, "groups", groupId, "members", userId),
      { removed: true },
      { merge: true }
    );
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
  }

  function handleCopyCode() {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isLoading) {
    return <div className="h-32 flex items-center justify-center text-sm text-zinc-400">{t("loading")}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">{t("title")}</h2>
        <p className="text-sm text-zinc-500 mt-0.5">{t("subtitle")}</p>
      </div>

      {/* 그룹 정보 카드 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{t("groupInfo")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-900">{groupName ?? "—"}</p>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">{groupId}</p>
            </div>
            <Badge variant={myRole === "admin" ? "default" : "secondary"}>
              {myRole === "admin" ? t("roleAdmin") : t("roleMember")}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* 팀원 목록 카드 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{t("members")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.map((member) => (
            <div key={member.userId} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-sm font-medium text-zinc-600">
                  {(member.displayName ?? member.email ?? "?")[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-900">
                    {member.displayName ?? t("unnamed")}
                    {member.userId === user?.uid && (
                      <span className="ml-1.5 text-xs text-zinc-400">({t("me")})</span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {member.role === "admin" ? t("roleAdmin") : t("roleMember")}
                </Badge>
                {myRole === "admin" && member.userId !== user?.uid && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 text-xs"
                    onClick={() => handleRemoveMember(member.userId)}
                  >
                    {t("remove")}
                  </Button>
                )}
              </div>
            </div>
          ))}

          {/* 팀원 초대 */}
          <div className="border-t pt-3 mt-3">
            <p className="text-sm font-medium text-zinc-700 mb-2">{t("inviteByEmail")}</p>
            <div className="flex gap-2">
              <Input
                placeholder={t("inviteEmailPlaceholder")}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1"
              />
              <Button size="sm" variant="outline" disabled={!inviteEmail.trim()}>
                {t("invite")}
              </Button>
            </div>
            <p className="text-xs text-zinc-400 mt-1">{t("inviteNotImplemented")}</p>
          </div>
        </CardContent>
      </Card>

      {/* 초대 코드 카드 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{t("inviteCode")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-zinc-50 border rounded px-3 py-2 text-sm font-mono tracking-widest text-zinc-800">
              {inviteCode ?? "——————"}
            </code>
            <Button variant="outline" size="sm" onClick={handleCopyCode} disabled={!inviteCode}>
              <Copy className="w-3.5 h-3.5 mr-1" />
              {copied ? t("copied") : t("copy")}
            </Button>
            {myRole === "admin" && (
              <Button variant="outline" size="sm" onClick={handleRegenerateCode}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                {t("regenerate")}
              </Button>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-2">{t("inviteCodeHint")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
