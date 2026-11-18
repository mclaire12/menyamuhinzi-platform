"""Basic-phone call flow.

USSD only starts the call. On the call, the farmer speaks every choice.
Keys are only 8 (ask), 0 (continue or repeat), and 9 (start the quiz).
"""

from __future__ import annotations

STUDY = ("kwiga", "isomo", "somo", "study", "learn", "kwigira")
ASK = ("kubaza", "ikibazo", "kibazo", "baza", "ask", "talk", "kuganira")
YES = ("yego", "iye", "komeza", "yes", "inyanya", "tomato", "tomate")
REPEAT = ("subira", "ongera", "repeat")
NUMBERS = {
    "mbere": 1,
    "kabiri": 2,
    "gatatu": 3,
    "kane": 4,
    "gatanu": 5,
    "gatandatu": 6,
    "karindwi": 7,
    "icyenda": 9,
    "umwe": 1,
    "two": 2,
    "one": 1,
    "three": 3,
}


def initial_state(progress: dict | None = None) -> dict:
    progress = progress or {}
    return {
        "step": "intent",
        "courseSlug": None,
        "lessonId": progress.get("lessonId"),
        "beatIndex": progress.get("beatIndex", 0),
        "quizIndex": 0,
        "quizCorrect": 0,
        "quizTotal": 0,
    }


def _say(rw: str, en: str) -> dict:
    return {"rw": rw, "en": en}


def _lesson_by_id(lessons: list[dict], lesson_id: str | None) -> dict | None:
    for lesson in lessons:
        if lesson["id"] == lesson_id:
            return lesson
    return None


def _match_lesson(utterance: str, lessons: list[dict]) -> dict | None:
    text = utterance.lower()
    for lesson in lessons:
        for word in lesson.get("voice", []):
            if word and word.lower() in text:
                return lesson
    for word, order in NUMBERS.items():
        if word in text.split() or f"ya {word}" in text:
            for lesson in lessons:
                if lesson.get("order") == order and lesson.get("status") == "published":
                    return lesson
    return None


def _course_choice(utterance: str) -> str | None:
    text = utterance.lower()
    if any(word in text for word in ("amashu", "cabbage", "chou", "ishu")):
        return "cabbage"
    if any(word in text for word in ("karoti", "carrot", "carotte", "callotte")):
        return "carrot"
    if any(word in text for word in ("inyanya", "tomato", "tomate")):
        return "tomato"
    return None


def _beat(lesson: dict, index: int) -> dict:
    beats = lesson["beats"]
    return beats[max(0, min(index, len(beats) - 1))]


def _play(state: dict, lesson: dict, repeat: bool = False) -> dict:
    beat = _beat(lesson, state["beatIndex"])
    prefix = "Nasubiyemo. " if repeat else ""
    say = _say(
        f"{prefix}{beat['title']['rw']}. {beat['text']['rw']} Kanda 8 niba ufite ikibazo, 0 kugira ngo ukomeze, 9 niba ushaka ikizamini.",
        f"{'Repeating. ' if repeat else ''}{beat['title']['en']}. {beat['text']['en']} Press 8 to ask, 0 to continue, 9 to start the quiz.",
    )
    return {"state": state, "say": say, "action": "play", "lessonId": lesson["id"], "beatId": beat["id"]}


def _start_quiz(state: dict, lesson: dict) -> dict:
    quiz = lesson.get("quiz") or []
    if not quiz:
        return {
            "state": {**state, "step": "playing"},
            "say": _say("Iri somo ntirigira ikizamini. Kanda 0 ukomeze.", "This lesson has no quiz. Press 0 to continue."),
            "action": "play",
            "lessonId": lesson["id"],
        }
    state = {**state, "step": "quiz", "quizIndex": 0, "quizCorrect": 0, "quizTotal": len(quiz)}
    return _ask_quiz(state, lesson)


def _ask_quiz(state: dict, lesson: dict) -> dict:
    item = lesson["quiz"][state["quizIndex"]]
    choices = " ".join(f"{n}. {choice['rw']}" for n, choice in enumerate(item["choices"], start=1))
    return {
        "state": state,
        "say": _say(
            f"Ikibazo: {item['prompt']['rw']} {choices} Vuga umwe, kabiri, cyangwa gatatu. Kanda 0 niba ushaka kongera kumva.",
            f"Question: {item['prompt']['en']}",
        ),
        "action": "quiz",
        "lessonId": lesson["id"],
    }


def _grade(utterance: str, lesson: dict, state: dict) -> dict:
    item = lesson["quiz"][state["quizIndex"]]
    text = utterance.lower()
    picked = None
    for word, number in NUMBERS.items():
        if word in text:
            picked = number - 1
            break
    if picked is None:
        for index, choice in enumerate(item["choices"]):
            if choice["rw"].lower()[:18] in text:
                picked = index
                break
    correct = picked == item["answer"]
    state = {**state, "quizCorrect": state["quizCorrect"] + (1 if correct else 0)}
    comment = item["explanation"]["rw"] if correct else item["explanation"]["rw"]
    if state["quizIndex"] + 1 >= len(lesson["quiz"]):
        score = state["quizCorrect"]
        total = state["quizTotal"]
        state = {**state, "step": "after_quiz"}
        return {
            "state": state,
            "say": _say(
                f"{comment} Amanota yawe ni {score} kuri {total}. Niba utabonye, subira ku isomo. Vuga kwiga cyangwa kubaza.",
                f"Your score is {score} out of {total}.",
            ),
            "action": "score",
            "lessonId": lesson["id"],
            "score": score,
            "total": total,
        }
    state = {**state, "quizIndex": state["quizIndex"] + 1}
    nxt = _ask_quiz(state, lesson)
    nxt["say"] = _say(comment + " " + nxt["say"]["rw"], nxt["say"]["en"])
    return nxt


def turn(state: dict, utterance: str, key: str | None, lessons: list[dict], progress_hint: str | None = None) -> dict:
    state = dict(state)
    text = (utterance or "").strip().lower()
    published = [lesson for lesson in lessons if lesson.get("status") == "published"]
    published.sort(key=lambda lesson: lesson.get("order", 0))

    if key in {"8", "0", "9"} and state["step"] in {"playing", "asking", "quiz"}:
        lesson = _lesson_by_id(published, state.get("lessonId"))
        if lesson is None:
            state["step"] = "course"
            return {
                "state": state,
                "say": _say("Hitamo isomo. Vuga inyanya.", "Choose a course. Say tomato."),
                "action": "prompt",
            }
        if key == "8":
            state["step"] = "asking"
            return {
                "state": state,
                "say": _say("Isomo ryahagarara. Vuga ikibazo cyawe.", "The lesson is paused. Say your question."),
                "action": "listen",
                "lessonId": lesson["id"],
            }
        if key == "0" and state["step"] == "quiz":
            return _ask_quiz(state, lesson)
        if key == "0":
            if state["step"] == "asking":
                state["step"] = "playing"
                return _play(state, lesson, repeat=True)
            if state["beatIndex"] + 1 < len(lesson["beats"]):
                state["beatIndex"] += 1
                state["step"] = "playing"
                return _play(state, lesson)
            state["beatIndex"] = len(lesson["beats"]) - 1
            state["step"] = "playing"
            return _play(state, lesson, repeat=True)
        if key == "9":
            return _start_quiz(state, lesson)

    if state["step"] == "intent":
        if any(word in text for word in ASK):
            state["step"] = "asking"
            state["courseSlug"] = "tomato"
            return {
                "state": state,
                "say": _say("Vuga ikibazo ushaka kubaza ku nyanya.", "Say the tomato question you want to ask."),
                "action": "listen",
            }
        if any(word in text for word in STUDY) or text in YES:
            state["step"] = "course"
            resume = ""
            if progress_hint:
                resume = f"Wari ugeze kuri: {progress_hint}. "
            return {
                "state": state,
                "say": _say(
                    resume + "Hitamo isomo rikuru. Vuga inyanya, amashu, cyangwa karoti.",
                    "Choose a course. Say tomato, cabbage, or carrot.",
                ),
                "action": "prompt",
            }
        return {
            "state": state,
            "say": _say(
                "Murakaza neza kuri MenyaMuhinzi. Ushaka kwiga cyangwa kubaza ikibazo?",
                "Welcome to MenyaMuhinzi. Do you want to study, or ask a question?",
            ),
            "action": "prompt",
        }

    if state["step"] == "course":
        choice = _course_choice(text)
        if choice in {"cabbage", "carrot"}:
            name = "Amashu" if choice == "cabbage" else "Karoti"
            return {
                "state": state,
                "say": _say(
                    f"{name} arazaza. Ubu dusoma inyanya gusa. Vuga inyanya niba ushaka kwiga.",
                    "That course comes later. Right now only tomato is open. Say tomato to study.",
                ),
                "action": "prompt",
            }
        if choice == "tomato" or "yego" in text:
            state["step"] = "lesson"
            state["courseSlug"] = "tomato"
            names = ", ".join(lesson["title"]["rw"] for lesson in published)
            return {
                "state": state,
                "say": _say(
                    f"Inyanya ifunguye. Hitamo isomo uvuga izina cyangwa numero. {names}",
                    "Tomato is open. Say a lesson name or number.",
                ),
                "action": "prompt",
            }
        return {
            "state": state,
            "say": _say("Vuga inyanya, amashu, cyangwa karoti.", "Say tomato, cabbage, or carrot."),
            "action": "prompt",
        }

    if state["step"] == "lesson":
        if "komeza" in text and state.get("lessonId"):
            lesson = _lesson_by_id(published, state["lessonId"])
            if lesson:
                state["step"] = "playing"
                return _play(state, lesson)
        lesson = _match_lesson(text, published)
        if lesson is None:
            return {
                "state": state,
                "say": _say("Sinumvise isomo. Vuga uruseme, ubutaka, gusarura, cyangwa indi somo.", "I missed the lesson. Say nursery, soil, harvest, or another lesson."),
                "action": "prompt",
            }
        state["lessonId"] = lesson["id"]
        state["beatIndex"] = 0
        state["step"] = "playing"
        return _play(state, lesson)

    if state["step"] == "asking":
        if any(word in text for word in STUDY):
            state["step"] = "course"
            return {
                "state": state,
                "say": _say("Hitamo isomo rikuru. Vuga inyanya.", "Choose a course. Say tomato."),
                "action": "prompt",
            }
        return {
            "state": state,
            "say": _say("", ""),
            "action": "answer",
            "question": utterance,
            "lessonId": state.get("lessonId"),
        }

    if state["step"] == "playing":
        lesson = _lesson_by_id(published, state.get("lessonId"))
        if lesson is None:
            state["step"] = "lesson"
            return {"state": state, "say": _say("Hitamo isomo.", "Choose a lesson."), "action": "prompt"}
        if any(word in text for word in REPEAT):
            return _play(state, lesson, repeat=True)
        if any(word in text for word in ASK):
            state["step"] = "asking"
            return {
                "state": state,
                "say": _say("Vuga ikibazo cyawe.", "Say your question."),
                "action": "listen",
                "lessonId": lesson["id"],
            }
        return _play(state, lesson, repeat=True)

    if state["step"] == "quiz":
        lesson = _lesson_by_id(published, state.get("lessonId"))
        if any(word in text for word in REPEAT):
            return _ask_quiz(state, lesson)
        return _grade(text, lesson, state)

    if state["step"] == "after_quiz":
        state["step"] = "intent"
        return turn(state, text, None, lessons)

    state["step"] = "intent"
    return {
        "state": state,
        "say": _say("Ushaka kwiga cyangwa kubaza ikibazo?", "Do you want to study, or ask a question?"),
        "action": "prompt",
    }
