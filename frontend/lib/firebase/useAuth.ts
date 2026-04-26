"use client";

import { useEffect, useState } from "react";
import { User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { onUserStateChange } from "./auth";
import { db } from "./firestore";

type AuthState = {
  user: User | null;
  groupId: string | null;
  isLoading: boolean;
};

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onUserStateChange(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists()) {
          setGroupId(userDoc.data().group_id ?? null);
        }
      } else {
        setGroupId(null);
      }
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  return { user, groupId, isLoading };
}
