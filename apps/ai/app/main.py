from __future__ import annotations

import base64

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from . import gemini_client
from .knowledge import draft_passages, load_json, published_passages, COURSE_PATH
from .phone_flow import initial_state, turn
from .retrieve import answer_from_passages, search

app = FastAPI(title="MenyaMuhinzi AI", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SYSTEM = (
    "You are the MenyaMuhinzi tomato tutor. Answer in simple Kinyarwanda first, "
    "then a short English line. Use only the approved passages. "
    "If the passages do not contain the answer, say the course does not cover it "
    "and that the farmer should ask a facilitator. Do not invent fertilizer rates, "
    "spray doses, or disease treatments."
)


class Question(BaseModel):
    question: str
    lessonId: str | None = None
    includeDrafts: bool = False


class PhoneTurn(BaseModel):
    state: dict | None = None
    utterance: str = ""
    key: str | None = None
    progressHint: str | None = None


class AudioIn(BaseModel):
    audio: str
    mimeType: str = "audio/wav"
    lessonId: str | None = None


class SpeakIn(BaseModel):
    text: str


class DraftRequest(BaseModel):
    vegetable: str
    level: str = "beginner"
    objectives: str


@app.get("/v1/health")
def health():
    return {
        "ok": True,
        "gemini": gemini_client.configured(),
        "publishedPassages": len(published_passages()),
        "draftPassages": len(draft_passages()),
        "model": "pretrained-gemini-plus-retrieval",
        "training": "This phase does not train a new language model.",
    }


@app.post("/v1/retrieve")
def retrieve(body: Question):
    pool = published_passages()
    if body.lessonId:
        pool = [item for item in pool if item["lessonId"] == body.lessonId] or pool
    if body.includeDrafts:
        pool = pool + draft_passages()
    return {"hits": search(body.question, pool)}


@app.post("/v1/answer")
async def answer(body: Question):
    published = published_passages()
    pool = published
    if body.lessonId:
        narrowed = [item for item in published if item["lessonId"] == body.lessonId]
        pool = narrowed or published
    if body.includeDrafts:
        pool = pool + draft_passages()
    grounded = answer_from_passages(body.question, pool)
    if body.lessonId and not grounded["grounded"]:
        grounded = answer_from_passages(body.question, published)
    if not grounded["grounded"]:
        return grounded
    if gemini_client.configured():
        context = "\n\n".join(item["text"]["rw"] for item in search(body.question, pool))
        try:
            phrased = await gemini_client.generate(
                f"Question: {body.question}\n\nApproved passages:\n{context}",
                SYSTEM,
            )
        except Exception as exc:  # network or model error; keep the passage
            grounded["geminiError"] = str(exc)
            phrased = None
        if phrased:
            grounded["rw"] = phrased
            grounded["phrasedBy"] = "gemini"
    else:
        grounded["phrasedBy"] = "passage"
    return grounded


@app.post("/v1/phone/turn")
async def phone_turn(body: PhoneTurn):
    course = load_json(COURSE_PATH)
    state = body.state or initial_state()
    result = turn(state, body.utterance, body.key, course["lessons"], body.progressHint)
    if result.get("action") == "answer":
        grounded = await answer(Question(question=result["question"], lessonId=result.get("lessonId")))
        follow = " Ushaka kongera kubaza, cyangwa vuga kwiga."
        result["say"] = {
            "rw": grounded["rw"] + follow,
            "en": grounded.get("en", ""),
        }
        result["grounded"] = grounded["grounded"]
        result["lessonId"] = grounded.get("lessonId")
        result["state"] = {**result["state"], "step": "asking"}
    return result


@app.post("/v1/draft-lesson")
async def draft_lesson(body: DraftRequest):
    if body.vegetable.lower() not in {"tomato", "inyanya"}:
        return {
            "status": "draft",
            "vegetable": body.vegetable,
            "title": {"rw": body.vegetable, "en": body.vegetable},
            "text": {
                "rw": "Amashu na karoti biraza nyuma. Ubu andika inyandiko z'inyanya gusa.",
                "en": "Cabbage and carrot come later. Draft tomato notes in this phase.",
            },
        }
    seed = (
        f"Andika inyandiko ngufi y'isomo ry'inyanya. Intumbero: {body.objectives}. "
        "Urwego: " + body.level + ". Koresha interuro ngufi. Ntukavange ingano y'imiti."
    )
    text = None
    if gemini_client.configured():
        try:
            text = await gemini_client.generate(seed, SYSTEM + " Write a draft the facilitator must edit.")
        except Exception:
            text = None
    if not text:
        text = (
            "Inyandiko y'icyitegererezo: " + body.objectives +
            " Sobanura mu nteruro eshatu, ugaragaze urugero rw'umuhinzi, hanyuma uhe incamake. "
            "Baza umutoza mbere yo kuvuga ingano y'ifumbire cyangwa umuti."
        )
    return {
        "status": "draft",
        "vegetable": "tomato",
        "level": body.level,
        "title": {"rw": "Inyandiko nshya y'inyanya", "en": "New tomato draft"},
        "text": {"rw": text, "en": body.objectives},
    }


def _need_gemini() -> None:
    if not gemini_client.configured():
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY is not set.")


@app.post("/v1/voice/transcribe")
async def voice_transcribe(body: AudioIn):
    _need_gemini()
    try:
        text = await gemini_client.transcribe(base64.b64decode(body.audio), body.mimeType)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"text": (text or "").strip()}


@app.post("/v1/voice/ask")
async def voice_ask(body: AudioIn):
    heard = await voice_transcribe(body)
    if not heard["text"]:
        return {"transcript": "", "rw": "Sinumvise neza. Ongera uvuge buhoro.", "grounded": False, "passages": []}
    result = await answer(Question(question=heard["text"], lessonId=body.lessonId))
    return {"transcript": heard["text"], **result}


@app.post("/v1/voice/speak")
async def voice_speak(body: SpeakIn):
    _need_gemini()
    try:
        audio = await gemini_client.synthesize(body.text[:1500])
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    if not audio:
        raise HTTPException(status_code=502, detail="Gemini returned no audio.")
    return {"audio": base64.b64encode(audio).decode(), "mimeType": "audio/wav"}


@app.post("/v1/speech/transcribe")
async def transcribe(file: UploadFile = File(...)):
    if not gemini_client.configured():
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY is not set. Use the typed voice stand-in.")
    audio = await file.read()
    try:
        text = await gemini_client.transcribe(audio, file.content_type or "audio/webm")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"text": text or ""}


@app.post("/v1/speech/synthesize", include_in_schema=False)
async def synthesize(body: Question):
    if not gemini_client.configured():
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY is not set. The browser can speak the lesson.")
    try:
        audio = await gemini_client.synthesize(body.question)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    if not audio:
        raise HTTPException(status_code=502, detail="Gemini returned no audio.")
    return Response(content=audio, media_type="audio/wav")
