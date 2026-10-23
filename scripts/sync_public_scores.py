#!/usr/bin/env python3
"""Update the public GitHub Pages fallback from the public Supabase REST API.

Use only fields already displayed on the public scoreboard. Do not include
administrator details, recruitment phone numbers or pending review entries.
"""
import json
import os
import pathlib
import urllib.parse
import urllib.request
from datetime import datetime, timezone

BASE = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_PUBLISHABLE_KEY"]
TARGET = pathlib.Path("data/public-scoreboard.json")


def fetch_table(table, columns):
    output = []
    page_size = 1000
    for offset in range(0, 100000, page_size):
        parameters = urllib.parse.urlencode({
            "select": columns,
            "order": "id.asc",
            "limit": str(page_size),
            "offset": str(offset),
        })
        url = f"{BASE}/rest/v1/{table}?{parameters}"
        req = urllib.request.Request(
            url,
            headers={"apikey": KEY, "Accept": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=25) as response:
            rows = json.load(response)
        if not isinstance(rows, list):
            raise ValueError(f"Unexpected public REST response for {table}")
        output.extend(rows)
        if len(rows) < page_size:
            break
    return output


def main():
    children = fetch_table("meide_children", "id,name,avatar,active,participant_type")
    activities = fetch_table("meide_activities", "id,title,date,status")
    scores = fetch_table("meide_public_scores", "id,child_id,activity_id,points,date")
    # Apply the same eligibility checks as the public site and Supabase RLS.
    children = [c for c in children
                if c.get("active") is True and
                c.get("participant_type", "child") == "child"]
    eligible = {c["id"] for c in children}
    ledger = [
        {"id":s["id"], "childId":s["child_id"],
         "activityId":s["activity_id"], "points":s["points"],
         "date":s.get("date")}
        for s in scores if s["child_id"] in eligible
    ]
    activities.sort(key=lambda a: (a.get("date") or "", a["id"]), reverse=True)
    children.sort(key=lambda c: c["id"])
    ledger.sort(key=lambda l: l["id"])

    fresh = {"children":children, "activities":activities, "ledger":ledger}
    previous = json.loads(TARGET.read_text("utf-8")) if TARGET.exists() else None
    if previous:
        # Never replace a populated public ranking with a transient empty
        # response, even when API itself returned HTTP 200.
        if (previous.get("ledger") and not ledger) or (
            previous.get("children") and not children
        ):
            raise RuntimeError("Refusing to overwrite live ranking with empty data")
        previous_content = {k:previous.get(k,[]) for k in fresh}
        if previous_content == fresh:
            print("No score changes. Existing published backup remains current.")
            return

    fresh["generatedAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(json.dumps(fresh,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"Saved {len(children)} public children, {len(activities)} activities, "
          f"{len(ledger)} score records.")


if __name__ == "__main__":
    main()
