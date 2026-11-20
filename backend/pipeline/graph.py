"""
LangGraph pipeline. Fan-out to three parallel matcher agents, fan-in to the
eligibility checker. `retrieved` uses operator.add so concurrent matcher
writes merge instead of clobbering each other.
"""

import operator
from typing import Annotated, TypedDict

from langgraph.graph import END, START, StateGraph

from pipeline.agents import (
    MATCHERS,
    check_eligibility,
    detect_language,
    extract_profile,
    synthesize,
)


class PipelineState(TypedDict, total=False):
    message: str
    language: str
    profile: dict
    retrieved: Annotated[list, operator.add]   # merged from parallel matchers
    verdicts: list
    answer_text: str
    follow_up_question: str | None
    prior_profile: dict
    prior_language: str
    reply_language: str


def build_graph():
    g = StateGraph(PipelineState)

    g.add_node("detect_language", detect_language)
    g.add_node("extract_profile", extract_profile)
    for name, fn in MATCHERS.items():
        g.add_node(name, fn)
    g.add_node("check_eligibility", check_eligibility)
    g.add_node("synthesize", synthesize)

    g.add_edge(START, "detect_language")
    g.add_edge("detect_language", "extract_profile")
    for name in MATCHERS:                       # fan-out (parallel)
        g.add_edge("extract_profile", name)
        g.add_edge(name, "check_eligibility")   # fan-in
    g.add_edge("check_eligibility", "synthesize")
    g.add_edge("synthesize", END)

    return g.compile()


GRAPH = build_graph()


def run_pipeline(
    message: str,
    prior_profile: dict | None = None,
    prior_language: str | None = None,
    reply_language: str | None = None,
) -> dict:
    """Single entry point used by the CLI, the API, and the eval harness."""
    initial_state: PipelineState = {"message": message, "retrieved": []}
    if prior_profile:
        initial_state["prior_profile"] = prior_profile
    if prior_language:
        initial_state["prior_language"] = prior_language
    if reply_language:
        initial_state["reply_language"] = reply_language
    return GRAPH.invoke(initial_state)
