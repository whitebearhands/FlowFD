"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { logReferralVisit } from "../../../lib/firebase/analytics";

function TrackerContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      logReferralVisit(ref);
    }
  }, [searchParams]);

  return null;
}

export default function AnalyticsTracker() {
  return (
    <Suspense fallback={null}>
      <TrackerContent />
    </Suspense>
  );
}
