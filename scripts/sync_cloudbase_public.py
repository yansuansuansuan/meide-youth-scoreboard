#!/usr/bin/env python3
"""Read the public CloudBase score API and mirror only its allowlisted public fields.
This is a read-only mirror, NOT a second writable database.
No credentials are used, and no score data is altered.
"""
import json
import pathlib
import urllib.parse
import urllib.request

BASE = "https://meidejifenbang-d4gk1txdi4a1d2342.service.tcloudbase.com/public-api"
OUTPUT = pathlib.Path("data/cloudbase-public.json")

def request(path):
    origin = "https://yansuansuansuan.github.io"
    req = urllib.request.Request(
        BASE + path,
        headers={"Accept": "application/json", "User-Agent": "MeidePublicDataSync/1.0",
                 "Origin": origin})
    with urllib.request.urlopen(req, timeout=25) as response:
        allowed = response.headers.get("Access-Control-Allow-Origin", "")
        if path == "":
            print("CloudBase CORS allowed origin:", repr(allowed))
        if allowed not in (origin, "*"):
            raise RuntimeError("CloudBase CORS does not permit the public GitHub Pages origin")
        obj = json.load(response)
    if not isinstance(obj, dict) or obj.get("code") != 0:
        raise RuntimeError("Public API returned invalid or failed response at " + path)
    return obj

def fetch_all(resource):
    result = []
    page = 1
    while page <= 1000:
        payload = request("/" + resource + "?" + urllib.parse.urlencode({
            "page": page, "pageSize": 200
        }))
        data = payload.get("data")
        if not isinstance(data, list):
            raise RuntimeError("Missing public page data for " + resource)
        result.extend(data)
        total = payload.get("total")
        if not isinstance(total, int):
            raise RuntimeError("Missing total for " + resource)
        if not payload.get("hasMore"):
            if len(result) != total:
                raise RuntimeError("Inconsistent pagination for " + resource)
            return result
        if not data or len(result) >= total:
            raise RuntimeError("Inconsistent hasMore for " + resource)
        page += 1
    raise RuntimeError("Too many pages for " + resource)

def allowlist(rows, allowed):
    return [{k:r[k] for k in allowed if k in r} for r in rows]

def main():
    overview = request("")
    children = allowlist(fetch_all("children"),
       ("id","childId","legacyId","name","displayName","totalPoints"))
    activities = allowlist(fetch_all("activities"),
       ("id","activityId","legacyId","name","date","status"))
    records = allowlist(fetch_all("records"),
       ("recordId","legacyId","childId","childName","activityId","activityName",
        "activityDate","delta","createdAt"))
    # Inspect schema-only field names for compatibility; never log children's names.
    for label, rows in (("children", children), ("activities", activities), ("records", records)):
        if rows:
            print("CloudBase public field names (" + label + "):", sorted(rows[0].keys()))
    if any(not (c.get("legacyId") or c.get("childId") or c.get("id")) for c in children):
        raise RuntimeError("Public child identifiers missing; refusing unsafe mirror")
    if any(not (a.get("legacyId") or a.get("activityId") or a.get("id")) for a in activities):
        raise RuntimeError("Public activity identifiers missing; refusing unsafe mirror")
    totals = overview.get("totals", {})
    # The public API is required to agree with its own pagination.
    for key, rows in (("children", children), ("activities", activities),
                      ("records", records)):
        expected = totals.get(key)
        if expected is not None and int(expected) != len(rows):
            raise RuntimeError("Overview count differs from " + key)
    payload = {
        "source": "cloudbase-public-api",
        "lastUpdatedAt": overview.get("lastUpdatedAt", 0),
        "totals": {"children":len(children),"activities":len(activities),
                   "records":len(records)},
        "children":children,
        "activities":activities,
        "records":records
    }
    # Refuse to silently overwrite previously populated public data with
    # empty results. A deliberate migration/reset needs human confirmation.
    if OUTPUT.exists():
        prev=json.loads(OUTPUT.read_text("utf-8"))
        if prev.get("records") and not records:
            raise RuntimeError("CloudBase suddenly returned no records; refusing data loss")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    content=json.dumps(payload,ensure_ascii=False,indent=2)+"\n"
    if OUTPUT.exists() and OUTPUT.read_text("utf-8")==content:
        print("No CloudBase data change")
    else:
        OUTPUT.write_text(content,"utf-8")
        print("Public CloudBase data updated")
    print("Counts:",payload["totals"],"lastUpdatedAt:",payload["lastUpdatedAt"])

if __name__ == "__main__":
    main()
