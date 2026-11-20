from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

import schemes_store as store
from services.eligibility import match_all

router = APIRouter(prefix="/api")


class EligibilityRequest(BaseModel):
    profile: dict = Field(default_factory=dict, max_length=40)
    include_not_eligible: bool = False
    lang: str = "en"
    limit: int = 150


@router.post("/eligibility")
def eligibility(req: EligibilityRequest):
    if any(isinstance(v, (dict, list)) for v in req.profile.values()):
        raise HTTPException(422, "profile values must be scalars")
    res = match_all(req.profile, req.include_not_eligible)
    for r in res:  # localized display name
        r["name"] = store.localized(store.SCHEMES[r["scheme_id"]], req.lang)["name"]
    counts = {v: sum(1 for r in res if r["verdict"] == v) for v in ("ELIGIBLE", "POSSIBLE_MATCH", "NEEDS_VERIFICATION", "NOT_ELIGIBLE")}
    return {"counts": counts, "results": res[: req.limit]}
