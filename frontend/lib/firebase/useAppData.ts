"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";

import { useAuth } from "./useAuth";
import { db } from "./firestore";
import { listenToCredits, listenToSubscription } from "./billing";

export type RecentProject = {
  projectId: string;
  name: string;
  client: string;
};

type AppData = {
  groupName: string | null;
  displayName: string | null;
  recentProjects: RecentProject[];
  sampleProjects: RecentProject[];
  credits: number;
  subscriptionPlan: number;
  isLoading: boolean;
};

export function useAppData(): AppData {
  const { user, groupId, isLoading: authLoading } = useAuth();
  const [groupName, setGroupName] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [sampleProjects, setSampleProjects] = useState<RecentProject[]>([]);
  const [credits, setCredits] = useState(0);
  const [subscriptionPlan, setSubscriptionPlan] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user || !groupId) return;

    let settled = false;

    async function fetchGroupName() {
      const groupDoc = await getDoc(doc(db, "groups", groupId!));
      if (groupDoc.exists()) setGroupName(groupDoc.data().name ?? null);
    }
    fetchGroupName();

    async function fetchSamples() {
      try {
        const { fetchSampleProjects } = await import("../api/projectApi");
        const samples = await fetchSampleProjects();
        setSampleProjects(samples.map(p => ({
          projectId: p.projectId,
          name: p.name,
          client: p.client
        })));
      } catch {
        // samples are optional — silently ignore failures
      }
    }
    fetchSamples();

    const unsubscribeUser = onSnapshot(
      doc(db, "users", user.uid),
      (snap) => {
        if (snap.exists()) {
          const userData = snap.data();
          setDisplayName(userData.display_name ?? null);
        }
      }
    );

    const unsubscribeCredits = listenToCredits(user.uid, (c) => {
      setCredits(c?.totalCredits ?? 0);
    });

    const unsubscribeSubscription = listenToSubscription(user.uid, (s) => {
      const plan = s?.plan;
      if (plan === "monthly" || plan === "annual") setSubscriptionPlan(2);
      else setSubscriptionPlan(0);
    });

    const unsubscribeProjects = onSnapshot(
      query(
        collection(db, "groups", groupId!, "projects"),
        orderBy("created_at", "desc"),
        limit(5)
      ),
      (snap) => {
        setRecentProjects(
          snap.docs.map((d) => ({
            projectId: d.id,
            name: d.data().name,
            client: d.data().client,
          }))
        );
        if (!settled) { settled = true; setIsLoading(false); }
      }
    );

    return () => {
      unsubscribeUser();
      unsubscribeCredits();
      unsubscribeSubscription();
      unsubscribeProjects();
    };
  }, [user, groupId, authLoading]);

  return { 
    groupName, 
    displayName, 
    recentProjects, 
    sampleProjects,
    credits, 
    subscriptionPlan, 
    isLoading: authLoading || isLoading 
  };
}
