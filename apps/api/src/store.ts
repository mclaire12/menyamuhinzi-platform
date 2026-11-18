import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

export const ROOT = join(__dirname, "..", "..", "..");
const STORE_PATH = join(ROOT, "data", "store.json");
const COURSE_PATH = join(ROOT, "content", "tomato", "course.json");
const GLOSSARY_PATH = join(ROOT, "content", "glossary", "kinyarwanda.json");
const SOURCES_PATH = join(ROOT, "content", "sources.json");

export type Role = "farmer" | "facilitator" | "administrator";

export interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
  location: string;
  language: "rw" | "en";
  role: Role;
  passwordHash: string;
  salt: string;
}

export interface Lesson {
  id: string;
  order: number;
  voice: string[];
  illustration: string;
  status: "published" | "draft";
  title: { rw: string; en: string };
  objectives: { rw: string; en: string };
  beats: Array<{
    id: string;
    minutes: number;
    title: { rw: string; en: string };
    text: { rw: string; en: string };
  }>;
  quiz: Array<{
    id: string;
    prompt: { rw: string; en: string };
    choices: Array<{ rw: string; en: string }>;
    answer: number;
    explanation: { rw: string; en: string };
  }>;
}

interface StoreShape {
  users: User[];
  sessions: Record<string, string>;
  lessons: Lesson[];
  course: any;
  plannedCourses: any[];
  glossary: any;
  sources: any;
  enrollments: Array<{ userId: string; courseId: string; at: string }>;
  progress: Array<{ userId: string; lessonId: string; beatId: string; beatIndex: number; completed: boolean; updatedAt: string }>;
  quizzes: Array<{ userId: string; lessonId: string; score: number; total: number; at: string }>;
  groups: Array<{ id: string; name: string; facilitatorId: string; memberIds: string[] }>;
  flags: Array<{ id: string; question: string; answer: string; grounded: boolean; at: string; userId: string }>;
  jobs: Array<{ id: string; name: string; status: string; data: any; at: string }>;
  audit: Array<{ at: string; actorId: string; action: string; detail: string }>;
  settings: { geminiModel: string; retrievalLimit: number; ussdCode: string; ussdStatus: string };
  phoneSessions: Record<string, any>;
  conversations: Array<{ id: string; userId: string; question: string; answer: string; grounded: boolean; via: "voice" | "text"; lessonId: string | null; at: string }>;
}

function hashPassword(password: string, salt: string): string {
  return pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
}

function user(partial: Omit<User, "passwordHash" | "salt"> & { password: string }): User {
  const salt = randomBytes(16).toString("hex");
  return {
    id: partial.id,
    name: partial.name,
    phone: partial.phone,
    email: partial.email,
    location: partial.location,
    language: partial.language,
    role: partial.role,
    salt,
    passwordHash: hashPassword(partial.password, salt),
  };
}

function fresh(): StoreShape {
  const courseFile = JSON.parse(readFileSync(COURSE_PATH, "utf8"));
  return {
    users: [
      user({ id: "user-farmer", name: "Aline Uwase", phone: "0788000001", email: "farmer@menyamuhinzi.rw", location: "Kigali", language: "rw", role: "farmer", password: "Farmer123!" }),
      user({ id: "user-facilitator", name: "Jean Habimana", phone: "0788000002", email: "facilitator@menyamuhinzi.rw", location: "Musanze", language: "rw", role: "facilitator", password: "Facilitator123!" }),
      user({ id: "user-admin", name: "Admin MenyaMuhinzi", phone: "0788000003", email: "admin@menyamuhinzi.rw", location: "Kigali", language: "rw", role: "administrator", password: "Admin123!" }),
    ],
    sessions: {},
    lessons: courseFile.lessons,
    course: courseFile.course,
    plannedCourses: courseFile.plannedCourses,
    glossary: JSON.parse(readFileSync(GLOSSARY_PATH, "utf8")),
    sources: JSON.parse(readFileSync(SOURCES_PATH, "utf8")),
    enrollments: [],
    progress: [],
    quizzes: [],
    groups: [{ id: "group-1", name: "Itsinda ry'inyanya", facilitatorId: "user-facilitator", memberIds: ["user-farmer"] }],
    flags: [],
    jobs: [],
    audit: [],
    settings: {
      geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      retrievalLimit: 3,
      ussdCode: "*675#",
      ussdStatus: "placeholder — confirm with the telecom provider",
    },
    phoneSessions: {},
    conversations: [],
  };
}

let memory: StoreShape | null = null;

export function db(): StoreShape {
  if (memory) return memory;
  if (existsSync(STORE_PATH)) {
    memory = JSON.parse(readFileSync(STORE_PATH, "utf8")) as StoreShape;
    memory.conversations = memory.conversations || [];
    return memory;
  }
  memory = fresh();
  persist();
  return memory;
}

export function persist(): void {
  if (!memory) return;
  mkdirSync(join(ROOT, "data"), { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(memory, null, 2));
}

export function publicUser(found: User) {
  return {
    id: found.id,
    name: found.name,
    phone: found.phone,
    email: found.email,
    location: found.location,
    language: found.language,
    role: found.role,
  };
}

export function checkPassword(found: User, password: string): boolean {
  const actual = Buffer.from(hashPassword(password, found.salt), "hex");
  const expected = Buffer.from(found.passwordHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function issueToken(userId: string): string {
  const token = createHash("sha256").update(randomBytes(32)).digest("hex");
  db().sessions[token] = userId;
  persist();
  return token;
}

export function userFromToken(token: string): User | undefined {
  const userId = db().sessions[token];
  return db().users.find((item) => item.id === userId);
}

export function audit(actorId: string, action: string, detail: string): void {
  db().audit.unshift({ at: new Date().toISOString(), actorId, action, detail });
  persist();
}

export function publishedLessons(): Lesson[] {
  return db().lessons.filter((lesson) => lesson.status === "published").sort((a, b) => a.order - b.order);
}
