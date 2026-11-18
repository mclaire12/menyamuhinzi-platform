CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE users (
  id text PRIMARY KEY,
  name text NOT NULL,
  phone text,
  email text UNIQUE NOT NULL,
  location text,
  language text NOT NULL DEFAULT 'rw',
  role text NOT NULL CHECK (role IN ('farmer', 'facilitator', 'administrator')),
  password_hash text NOT NULL,
  salt text NOT NULL
);

CREATE TABLE courses (
  id text PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  vegetable text NOT NULL,
  status text NOT NULL,
  title_rw text NOT NULL,
  title_en text NOT NULL,
  summary_rw text NOT NULL
);

CREATE TABLE lessons (
  id text PRIMARY KEY,
  course_id text REFERENCES courses(id),
  position integer NOT NULL,
  status text NOT NULL,
  title_rw text NOT NULL,
  body_rw text NOT NULL
);

CREATE TABLE passages (
  id text PRIMARY KEY,
  lesson_id text REFERENCES lessons(id),
  status text NOT NULL,
  body_rw text NOT NULL,
  embedding vector(768)
);

CREATE TABLE enrollments (
  user_id text REFERENCES users(id),
  course_id text REFERENCES courses(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, course_id)
);

CREATE TABLE progress (
  user_id text REFERENCES users(id),
  lesson_id text REFERENCES lessons(id),
  beat_id text,
  beat_index integer,
  completed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);

CREATE TABLE quiz_attempts (
  id bigserial PRIMARY KEY,
  user_id text REFERENCES users(id),
  lesson_id text REFERENCES lessons(id),
  score integer NOT NULL,
  total integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  actor_id text,
  action text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
