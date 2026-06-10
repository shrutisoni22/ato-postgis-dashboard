CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS dashboard_features (
    id BIGSERIAL PRIMARY KEY,
    asset_type TEXT NOT NULL,
    hazard_type TEXT NOT NULL,
    dataset_name TEXT,
    country_name TEXT,
    road_category TEXT,
    port_name TEXT,
    return_period INTEGER,
    return_periods INTEGER[],
    epoch TEXT,
    year INTEGER,
    years INTEGER[],
    scenario TEXT,
    gcm TEXT,
    sources TEXT[],
    exposure_class TEXT,
    source_file TEXT NOT NULL,
    source_raster TEXT,
    max_value DOUBLE PRECISION,
    mean_value DOUBLE PRECISION,
    length_km DOUBLE PRECISION,
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    geom geometry(Geometry, 4326) NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dashboard_summaries (
    id BIGSERIAL PRIMARY KEY,
    asset_type TEXT NOT NULL,
    hazard_type TEXT NOT NULL,
    dataset_name TEXT,
    country_name TEXT,
    road_category TEXT,
    return_period INTEGER,
    epoch TEXT,
    year INTEGER,
    scenario TEXT,
    gcm TEXT,
    exposure_class TEXT,
    source_file TEXT NOT NULL,
    total_count BIGINT,
    exposed_count BIGINT,
    total_length_km DOUBLE PRECISION,
    exposed_length_km DOUBLE PRECISION,
    exposed_length_percent DOUBLE PRECISION,
    max_value DOUBLE PRECISION,
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS import_log (
    id BIGSERIAL PRIMARY KEY,
    source_file TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    hazard_type TEXT NOT NULL,
    feature_count BIGINT NOT NULL DEFAULT 0,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dashboard_features_geom_gix
    ON dashboard_features
    USING GIST (geom);

CREATE INDEX IF NOT EXISTS dashboard_features_asset_hazard_idx
    ON dashboard_features (asset_type, hazard_type);

CREATE INDEX IF NOT EXISTS dashboard_features_filters_idx
    ON dashboard_features (country_name, road_category, return_period, year);

CREATE INDEX IF NOT EXISTS dashboard_features_properties_gin
    ON dashboard_features
    USING GIN (properties);

CREATE INDEX IF NOT EXISTS dashboard_summaries_filters_idx
    ON dashboard_summaries (asset_type, hazard_type, country_name, road_category, return_period, year);
