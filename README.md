# MenyaMuhinzi

Kinyarwanda e-learning for vegetable farmers. The first course is tomato. Cabbage and carrot stay in the catalogue until tomato is stable.

This phase teaches. It does not issue certificates, identify diseases from photos, give open farm advice, read the weather, or run a marketplace.

## Accounts

| Role | Email | Password |
| --- | --- | --- |
| Farmer | farmer@menyamuhinzi.rw | Farmer123! |
| Facilitator | facilitator@menyamuhinzi.rw | Facilitator123! |
| Administrator | admin@menyamuhinzi.rw | Admin123! |

## Run it here

Docker is optional. These three commands start the local stack. The API stores accounts, progress, and lessons in `data/store.json`. PostgreSQL with pgvector is described in `docker-compose.yml` and `infra/postgres/init.sql` for a machine that has Docker.

```bash
python -m pip install -r apps/ai/requirements.txt
python -m uvicorn app.main:app --app-dir apps/ai --port 8000
```

```bash
npm --prefix apps/api install
npm --prefix apps/api run start
```

```bash
npm --prefix apps/web install
npm --prefix apps/web run dev
```

Open http://localhost:3000.

Copy `.env.example` to `.env` and set `GEMINI_API_KEY` when you want Gemini to phrase answers, transcribe speech, and read lessons aloud. Without the key, answers are the approved lesson passage itself, and the browser speaks the Kinyarwanda text.

## Talking with the AI in Kinyarwanda

Farmers open **Vugana na AI** (`/talk`), press the microphone, and speak.

1. The browser records the voice and converts it to 16 kHz WAV.
2. Gemini transcribes the Kinyarwanda speech.
3. The answer comes only from approved tomato lessons. Questions outside the lessons are flagged for a facilitator.
4. Gemini speaks the answer. Without Gemini, the browser voice reads it aloud.

Set `GEMINI_API_KEY` in `.env` and restart the AI service to turn on listening and the Gemini voice. Without a key, farmers can still type questions. Each farmer sees only their own conversations. The basic-phone simulator also has a microphone button that uses the same transcription.

## How a basic phone call works

USSD, shown as `*675#`, only starts the call. That code is a placeholder until a telecom provider approves a shortcode.

On the call the farmer speaks. They choose **kwiga** (study) or **kubaza** (ask). Study then asks for the course. Only **inyanya** is open. Cabbage (**amashu**) and carrot (**karoti**) are named so the farmer hears that those courses come later. They then say the lesson, for example **uruseme**.

During the lesson the keypad is only:

- `8` ask a question
- `0` continue, or repeat the last part at the end
- `9` start the spoken quiz

## Knowledge

Farmer answers come from the original Kinyarwanda lessons in `content/tomato/course.json`. A draft lesson stays hidden until a facilitator approves it.

The PDF guides supplied with the project are listed in `content/sources.json`. They are reference material. The course does not copy them. Run this to make unverified draft chunks a facilitator can search locally:

```bash
python tools/ingest_pdf.py path\to\guide.pdf
```

Chunks land in `content/drafts/`, which is not committed. Farmer answers ignore them.

This phase does not train a new language model. Gemini, when configured, only phrases an answer from retrieved lesson text. If the lesson does not contain the answer, the system says so.

`content/evaluation/tomato_questions.json` is the fixed tomato check. `apps/ai/tests` runs retrieval and the phone flow.

## What is left for later

A live telecom connection, a pilot with farmer groups, cabbage and carrot lessons, certificates, photo diagnosis, weather, input plans, and a marketplace.
