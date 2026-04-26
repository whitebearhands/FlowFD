import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  where,
  limit,
  Unsubscribe,
} from "firebase/firestore";
import app from "./firebaseConfig";

const db = getFirestore(app);

export function listenToProjects(
  groupId: string,
  onUpdate: (projects: Record<string, unknown>[]) => void
): Unsubscribe {
  const ref = collection(db, "groups", groupId, "projects");
  const q = query(ref, orderBy("created_at", "desc"));
  return onSnapshot(q, (snapshot) => {
    onUpdate(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Record<string, unknown>[]);
  });
}

export function listenToMeetings(
  groupId: string,
  projectId: string,
  onUpdate: (meetings: Record<string, unknown>[]) => void
): Unsubscribe {
  const isSample = projectId.startsWith("sample-");
  const realId = isSample ? projectId.slice("sample-".length) : projectId;
  
  const ref = isSample
    ? collection(db, "samples", "projects", "data", realId, "meetings")
    : collection(db, "groups", groupId, "projects", realId, "meetings");
    
  const q = query(ref, orderBy("created_at", "desc"));
  return onSnapshot(q, (snapshot) => {
    const meetings = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    onUpdate(meetings as Record<string, unknown>[]);
  });
}

export function listenToMeetingStatus(
  groupId: string,
  projectId: string,
  meetingId: string,
  onUpdate: (status: string) => void
): Unsubscribe {
  const isSample = projectId.startsWith("sample-");
  const realId = isSample ? projectId.slice("sample-".length) : projectId;

  const ref = isSample
    ? doc(db, "samples", "projects", "data", realId, "meetings", meetingId)
    : doc(db, "groups", groupId, "projects", realId, "meetings", meetingId);

  return onSnapshot(ref, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      onUpdate(data.analysis_status ?? "pending");
    }
  });
}

export function listenToLatestPrd(
  groupId: string,
  projectId: string,
  onUpdate: (version: string | null) => void
): Unsubscribe {
  const isSample = projectId.startsWith("sample-");
  const realId = isSample ? projectId.slice("sample-".length) : projectId;

  const ref = isSample
    ? collection(db, "samples", "projects", "data", realId, "prd")
    : collection(db, "groups", groupId, "projects", realId, "prd");

  const q = query(ref, orderBy("created_at", "desc"));
  return onSnapshot(q, (snapshot) => {
    const latest = snapshot.docs[0];
    onUpdate(latest ? (latest.data().version as string) : null);
  });
}

export function listenToActiveJob(
  groupId: string,
  projectId: string,
  jobType: string,
  onUpdate: (isActive: boolean) => void
): Unsubscribe {
  const isSample = projectId.startsWith("sample-");
  const realId = isSample ? projectId.slice("sample-".length) : projectId;

  const ref = isSample
    ? collection(db, "samples", "projects", "data", realId, "jobs")
    : collection(db, "groups", groupId, "projects", realId, "jobs");

  const q = query(ref, where("type", "==", jobType), where("status", "==", "processing"));
  return onSnapshot(q, (snapshot) => {
    onUpdate(!snapshot.empty);
  });
}

export function listenToLatestJobs(
  groupId: string,
  projectId: string,
  limitCount: number = 5,
  onUpdate: (jobs: Record<string, unknown>[]) => void
): Unsubscribe {
  const isSample = projectId.startsWith("sample-");
  const realId = isSample ? projectId.slice("sample-".length) : projectId;

  const ref = isSample
    ? collection(db, "samples", "projects", "data", realId, "jobs")
    : collection(db, "groups", groupId, "projects", realId, "jobs");

  const q = query(ref, orderBy("created_at", "desc"), limit(limitCount));
  return onSnapshot(q, (snapshot) => {
    onUpdate(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export { db };
