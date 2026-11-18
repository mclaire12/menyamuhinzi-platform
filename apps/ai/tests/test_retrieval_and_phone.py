import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.knowledge import published_passages
from app.phone_flow import initial_state, turn
from app.retrieve import answer_from_passages, search


def test_nursery_question_finds_nursery_lesson():
    hits = search("Umuseme w'inyanya umenyura ibyumweru binge mu ruseme?", published_passages())
    assert hits
    assert hits[0]["lessonId"] == "tomato-nursery"


def test_maize_question_is_not_answered_from_tomato():
    result = answer_from_passages("Ni gute niteza ibigori byinshi?", published_passages())
    assert result["grounded"] is False


def test_variety_question_is_grounded():
    result = answer_from_passages("Inyanya ndende itandukaniye gute n'inyanya igufi?", published_passages())
    assert result["grounded"] is True
    assert result["lessonId"] == "tomato-intro"


def test_call_starts_with_a_choice_then_course_then_lesson():
    course_lessons = __import__("app.knowledge", fromlist=["load_json"]).load_json(
        Path(__file__).resolve().parents[3] / "content" / "tomato" / "course.json"
    )["lessons"]
    state = initial_state()
    first = turn(state, "", None, course_lessons)
    assert "kwiga" in first["say"]["rw"]
    second = turn(first["state"], "kwiga", None, course_lessons)
    assert second["state"]["step"] == "course"
    third = turn(second["state"], "amashu", None, course_lessons)
    assert "inyanya" in third["say"]["rw"]
    fourth = turn(third["state"], "inyanya", None, course_lessons)
    assert fourth["state"]["step"] == "lesson"
    fifth = turn(fourth["state"], "uruseme", None, course_lessons)
    assert fifth["state"]["lessonId"] == "tomato-nursery"
    assert fifth["action"] == "play"
    asked = turn(fifth["state"], "", "8", course_lessons)
    assert asked["state"]["step"] == "asking"


def test_gemini_pcm_is_wrapped_as_playable_wav():
    from app.gemini_client import pcm_to_wav

    wav = pcm_to_wav(b"\x00\x00" * 2400, 24000)
    assert wav[:4] == b"RIFF"
    assert wav[8:12] == b"WAVE"


def test_draft_lessons_are_not_in_the_farmer_library():
    ids = {item["lessonId"] for item in published_passages()}
    assert "tomato-draft-pruning-note" not in ids
    assert "tomato-intro" in ids
