import os
from pathlib import Path
from typing import Any

import psycopg
from psycopg.rows import dict_row
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass


DEFAULT_DATABASE_URL = "postgresql://ato:ato@127.0.0.1:55432/ato_dashboard"
DATABASE_URL = os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL)

app = FastAPI(title="ATO Hazard Dashboard PostGIS API", version="1.0.0")
STATIC_DIR = Path(__file__).resolve().parent / "static"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

if STATIC_DIR.exists():
    app.mount("/dashboard", StaticFiles(directory=STATIC_DIR, html=True), name="dashboard")


def get_connection() -> psycopg.Connection:
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


def add_optional_filter(
    where: list[str],
    params: dict[str, Any],
    column: str,
    value: Any,
    key: str,
    case_insensitive: bool = False,
) -> None:
    if value is None or value == "":
        return

    if case_insensitive:
        where.append(f"lower({column}) = lower(%({key})s)")
    else:
        where.append(f"{column} = %({key})s")
    params[key] = value


def add_json_text_filter(
    where: list[str],
    params: dict[str, Any],
    json_key: str,
    value: Any,
    key: str,
) -> None:
    if value is None or value == "" or value == "All":
        return
    where.append(f"lower(properties ->> '{json_key}') = lower(%({key})s)")
    params[key] = value


def build_feature_where(
    asset_type: str | None,
    hazard_type: str | None,
    dataset_name: str | None,
    country_name: str | None,
    road_category: str | None,
    return_period: int | None,
    epoch: str | None,
    year: int | None,
    scenario: str | None,
    gcm: str | None,
    exposure_class: str | None,
    flood_type: str | None,
    deltares_source: str | None,
    model: str | None,
    bbox: str | None,
) -> tuple[str, dict[str, Any]]:
    where: list[str] = []
    params: dict[str, Any] = {}

    add_optional_filter(where, params, "asset_type", asset_type, "asset_type")
    add_optional_filter(where, params, "hazard_type", hazard_type, "hazard_type")
    add_optional_filter(where, params, "dataset_name", dataset_name, "dataset_name", case_insensitive=True)
    add_optional_filter(where, params, "country_name", country_name, "country_name", case_insensitive=True)
    add_optional_filter(where, params, "road_category", road_category, "road_category", case_insensitive=True)
    add_optional_filter(where, params, "epoch", epoch, "epoch", case_insensitive=True)
    add_optional_filter(where, params, "scenario", scenario, "scenario", case_insensitive=True)
    add_optional_filter(where, params, "gcm", gcm, "gcm", case_insensitive=True)
    add_optional_filter(where, params, "exposure_class", exposure_class, "exposure_class", case_insensitive=True)
    add_json_text_filter(where, params, "flood_type", flood_type, "flood_type")
    add_json_text_filter(where, params, "deltares_source", deltares_source, "deltares_source")
    add_json_text_filter(where, params, "model", model, "model")

    if return_period is not None:
        where.append("(return_period = %(return_period)s OR %(return_period)s = ANY(return_periods))")
        params["return_period"] = return_period

    if year is not None:
        where.append("(year = %(year)s OR %(year)s = ANY(years))")
        params["year"] = year

    if bbox:
        parts = [float(value) for value in bbox.split(",")]
        if len(parts) != 4:
            raise ValueError("bbox must be minLon,minLat,maxLon,maxLat")
        params.update({
            "minx": parts[0],
            "miny": parts[1],
            "maxx": parts[2],
            "maxy": parts[3],
        })
        where.append("geom && ST_MakeEnvelope(%(minx)s, %(miny)s, %(maxx)s, %(maxy)s, 4326)")

    if not where:
        return "", params

    return "WHERE " + " AND ".join(where), params


def build_summary_where(
    asset_type: str | None,
    hazard_type: str | None,
    dataset_name: str | None,
    country_name: str | None,
    road_category: str | None,
    return_period: int | None,
    epoch: str | None,
    year: int | None,
    scenario: str | None,
    gcm: str | None,
    exposure_class: str | None,
    flood_type: str | None,
    deltares_source: str | None,
    model: str | None,
) -> tuple[str, dict[str, Any]]:
    where: list[str] = []
    params: dict[str, Any] = {}

    add_optional_filter(where, params, "asset_type", asset_type, "asset_type")
    add_optional_filter(where, params, "hazard_type", hazard_type, "hazard_type")
    add_optional_filter(where, params, "dataset_name", dataset_name, "dataset_name", case_insensitive=True)
    add_optional_filter(where, params, "country_name", country_name, "country_name", case_insensitive=True)
    add_optional_filter(where, params, "road_category", road_category, "road_category", case_insensitive=True)
    add_optional_filter(where, params, "epoch", epoch, "epoch", case_insensitive=True)
    add_optional_filter(where, params, "scenario", scenario, "scenario", case_insensitive=True)
    add_optional_filter(where, params, "gcm", gcm, "gcm", case_insensitive=True)
    add_optional_filter(where, params, "exposure_class", exposure_class, "exposure_class", case_insensitive=True)
    add_json_text_filter(where, params, "flood_type", flood_type, "flood_type")
    add_json_text_filter(where, params, "deltares_source", deltares_source, "deltares_source")
    add_json_text_filter(where, params, "model", model, "model")

    if return_period is not None:
        where.append("return_period = %(return_period)s")
        params["return_period"] = return_period

    if year is not None:
        where.append("year = %(year)s")
        params["year"] = year

    if not where:
        return "", params

    return "WHERE " + " AND ".join(where), params


@app.get("/")
def root() -> Any:
    if STATIC_DIR.exists():
        return RedirectResponse(url="/dashboard/index.html")

    return {
        "name": "ATO Hazard Dashboard PostGIS API",
        "health": "/health",
        "features": "/api/features",
        "summary": "/api/summary",
        "filters": "/api/filters",
    }


@app.get("/health")
def health() -> dict[str, Any]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS feature_count FROM dashboard_features")
            feature_count = cur.fetchone()["feature_count"]
            cur.execute("SELECT COUNT(*) AS summary_count FROM dashboard_summaries")
            summary_count = cur.fetchone()["summary_count"]

    return {
        "ok": True,
        "feature_count": feature_count,
        "summary_count": summary_count,
    }


@app.get("/api/filters")
def filters() -> dict[str, Any]:
    sql = """
        SELECT
            array_remove(array_agg(DISTINCT asset_type ORDER BY asset_type), NULL) AS asset_types,
            array_remove(array_agg(DISTINCT hazard_type ORDER BY hazard_type), NULL) AS hazard_types,
            array_remove(array_agg(DISTINCT dataset_name ORDER BY dataset_name), NULL) AS datasets,
            array_remove(array_agg(DISTINCT country_name ORDER BY country_name), NULL) AS countries,
            array_remove(array_agg(DISTINCT road_category ORDER BY road_category), NULL) AS road_categories,
            array_remove(array_agg(DISTINCT return_period ORDER BY return_period), NULL) AS return_periods,
            array_remove(array_agg(DISTINCT year ORDER BY year), NULL) AS years,
            array_remove(array_agg(DISTINCT gcm ORDER BY gcm), NULL) AS sources,
            array_remove(array_agg(DISTINCT exposure_class ORDER BY exposure_class), NULL) AS exposure_classes
        FROM dashboard_features
    """

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            row = cur.fetchone()

    return {key: row[key] or [] for key in row}


@app.get("/api/features")
def features(
    asset_type: str | None = None,
    hazard_type: str | None = None,
    dataset_name: str | None = None,
    country_name: str | None = None,
    road_category: str | None = None,
    return_period: int | None = None,
    epoch: str | None = None,
    year: int | None = None,
    scenario: str | None = None,
    gcm: str | None = None,
    exposure_class: str | None = None,
    flood_type: str | None = None,
    deltares_source: str | None = None,
    model: str | None = None,
    bbox: str | None = None,
    limit: int = Query(default=5000, ge=1, le=50000),
) -> dict[str, Any]:
    where_sql, params = build_feature_where(
        asset_type=asset_type,
        hazard_type=hazard_type,
        dataset_name=dataset_name,
        country_name=country_name,
        road_category=road_category,
        return_period=return_period,
        epoch=epoch,
        year=year,
        scenario=scenario,
        gcm=gcm,
        exposure_class=exposure_class,
        flood_type=flood_type,
        deltares_source=deltares_source,
        model=model,
        bbox=bbox,
    )
    params["limit"] = limit

    sql = f"""
        SELECT
            id, asset_type, hazard_type, dataset_name, country_name, road_category,
            port_name, return_period, return_periods, epoch, year, years, scenario,
            gcm, sources, exposure_class, source_file, source_raster, max_value,
            mean_value, length_km, properties,
            ST_AsGeoJSON(geom)::json AS geometry
        FROM dashboard_features
        {where_sql}
        ORDER BY id
        LIMIT %(limit)s
    """

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()

    features_out = []
    for row in rows:
        props = dict(row["properties"] or {})
        for key in [
            "id", "asset_type", "hazard_type", "dataset_name", "country_name",
            "road_category", "port_name", "return_period", "return_periods",
            "epoch", "year", "years", "scenario", "gcm", "sources",
            "exposure_class", "source_file", "source_raster", "max_value",
            "mean_value", "length_km",
        ]:
            props[key] = row[key]

        features_out.append({
            "type": "Feature",
            "properties": props,
            "geometry": row["geometry"],
        })

    return {
        "type": "FeatureCollection",
        "features": features_out,
        "metadata": {
            "returned": len(features_out),
            "limit": limit,
        },
    }


@app.get("/api/summary")
def summary(
    asset_type: str | None = None,
    hazard_type: str | None = None,
    dataset_name: str | None = None,
    country_name: str | None = None,
    road_category: str | None = None,
    return_period: int | None = None,
    epoch: str | None = None,
    year: int | None = None,
    scenario: str | None = None,
    gcm: str | None = None,
    exposure_class: str | None = None,
    flood_type: str | None = None,
    deltares_source: str | None = None,
    model: str | None = None,
    bbox: str | None = None,
) -> dict[str, Any]:
    where_sql, params = build_feature_where(
        asset_type=asset_type,
        hazard_type=hazard_type,
        dataset_name=dataset_name,
        country_name=country_name,
        road_category=road_category,
        return_period=return_period,
        epoch=epoch,
        year=year,
        scenario=scenario,
        gcm=gcm,
        exposure_class=exposure_class,
        flood_type=flood_type,
        deltares_source=deltares_source,
        model=model,
        bbox=bbox,
    )

    sql = f"""
        SELECT
            asset_type,
            hazard_type,
            dataset_name,
            road_category,
            COUNT(*)::bigint AS feature_count,
            COALESCE(SUM(length_km), 0)::double precision AS exposed_length_km,
            MAX(max_value)::double precision AS max_value,
            AVG(mean_value)::double precision AS mean_value
        FROM dashboard_features
        {where_sql}
        GROUP BY asset_type, hazard_type, dataset_name, road_category
        ORDER BY asset_type, hazard_type, dataset_name, road_category
    """

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()

    total_features = sum(int(row["feature_count"] or 0) for row in rows)
    total_length_km = sum(float(row["exposed_length_km"] or 0) for row in rows)
    max_values = [row["max_value"] for row in rows if row["max_value"] is not None]

    return {
        "total_features": total_features,
        "total_length_km": total_length_km,
        "max_value": max(max_values) if max_values else None,
        "rows": rows,
    }


@app.get("/api/summary-rows")
def summary_rows(
    asset_type: str | None = None,
    hazard_type: str | None = None,
    dataset_name: str | None = None,
    country_name: str | None = None,
    road_category: str | None = None,
    return_period: int | None = None,
    epoch: str | None = None,
    year: int | None = None,
    scenario: str | None = None,
    gcm: str | None = None,
    exposure_class: str | None = None,
    flood_type: str | None = None,
    deltares_source: str | None = None,
    model: str | None = None,
    limit: int = Query(default=5000, ge=1, le=200000),
) -> dict[str, Any]:
    where_sql, params = build_summary_where(
        asset_type=asset_type,
        hazard_type=hazard_type,
        dataset_name=dataset_name,
        country_name=country_name,
        road_category=road_category,
        return_period=return_period,
        epoch=epoch,
        year=year,
        scenario=scenario,
        gcm=gcm,
        exposure_class=exposure_class,
        flood_type=flood_type,
        deltares_source=deltares_source,
        model=model,
    )
    params["limit"] = limit

    sql = f"""
        SELECT
            id, asset_type, hazard_type, dataset_name, country_name, road_category,
            return_period, epoch, year, scenario, gcm, exposure_class, source_file,
            total_count, exposed_count, total_length_km, exposed_length_km,
            exposed_length_percent, max_value, properties
        FROM dashboard_summaries
        {where_sql}
        ORDER BY asset_type, hazard_type, dataset_name, country_name NULLS FIRST,
                 road_category NULLS FIRST, return_period NULLS FIRST, year NULLS FIRST, id
        LIMIT %(limit)s
    """

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()

    out = []
    for row in rows:
        item = dict(row["properties"] or {})
        for key in [
            "id", "asset_type", "hazard_type", "dataset_name", "country_name",
            "road_category", "return_period", "epoch", "year", "scenario",
            "gcm", "exposure_class", "source_file", "total_count",
            "exposed_count", "total_length_km", "exposed_length_km",
            "exposed_length_percent", "max_value",
        ]:
            if item.get(key) in (None, ""):
                item[key] = row[key]
        out.append(item)

    return {
        "rows": out,
        "metadata": {
            "returned": len(out),
            "limit": limit,
        },
    }
