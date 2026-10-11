
#!/usr/bin/env python3

"""
Generate a lightweight JSON index for the
RxSmoke Spot Forecast Archive.
"""

import csv
import io
import json
from pathlib import Path
from urllib.request import urlopen


# --------------------------------------------------
# Configuration
# --------------------------------------------------

CSV_URL = (
    "https://raw.githubusercontent.com/"
    "jeremyash/southern-area-forecast-cache/"
    "cache-data/spreadsheet-archive/"
    "spot_forecast_archive.csv"
)

OUTPUT_FILE = Path("data/forecasts.json")

FIELDS = [
    "archive_key",
    "issuance_date",
    "issuance_time_utc",
    "issuance_time_local",
    "forest",
    "project_name",
    "spot_id",
    "archive_file",
]


# --------------------------------------------------
# Download master CSV
# --------------------------------------------------

def download_csv():
    print("Downloading master spot forecast archive...")

    with urlopen(CSV_URL, timeout=120) as response:
        return response.read().decode("utf-8-sig")


# --------------------------------------------------
# Build searchable index
# --------------------------------------------------

def build_index(csv_text):
    reader = csv.DictReader(io.StringIO(csv_text))

    missing = set(FIELDS) - set(reader.fieldnames or [])

    if missing:
        raise ValueError(
            f"Missing required columns: {sorted(missing)}"
        )

    forecasts = []
    seen = set()

    for row in reader:
        archive_file = (row.get("archive_file") or "").strip()
        archive_key = (row.get("archive_key") or "").strip()

        if not archive_file:
            continue

        key = archive_key or archive_file

        if key in seen:
            continue

        seen.add(key)

        forecasts.append({
            field: (row.get(field) or "").strip()
            for field in FIELDS
        })

    forecasts.sort(
        key=lambda item: (
            item["issuance_time_utc"],
            item["issuance_date"]
        ),
        reverse=True
    )

    return forecasts


# --------------------------------------------------
# Save JSON
# --------------------------------------------------

def save_index(forecasts):
    OUTPUT_FILE.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    with OUTPUT_FILE.open("w", encoding="utf-8") as file:
        json.dump(
            forecasts,
            file,
            ensure_ascii=False,
            separators=(",", ":")
        )

    print(f"Saved {len(forecasts):,} forecasts")
    print(f"Output: {OUTPUT_FILE}")


# --------------------------------------------------
# Run
# --------------------------------------------------

def main():
    csv_text = download_csv()
    forecasts = build_index(csv_text)
    save_index(forecasts)


if __name__ == "__main__":
    main()
