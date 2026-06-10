var configuredApiBase = (window.ATO_POSTGIS_API_BASE || "").trim();
var API_BASE = configuredApiBase.replace(/\/+$/, "");

if (!API_BASE) {
    if (window.location.port && window.location.port !== "8000") {
        API_BASE = window.location.protocol + "//" + window.location.hostname + ":8000";
    } else {
        API_BASE = window.location.origin;
    }
}
var FEATURE_LIMIT = 50000;
var map = L.map("map", { zoomControl: false }).setView([20.5, 85.0], 7);
var featureLayer = null;
var activeDashboardMode = "roads";
var activeTab = "flood";
var filtersLoaded = false;

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);


var HAZARD_LABELS = {
    flood: "Flood",
    flood_ii: "Flood-II",
    landslide: "Landslide",
    cyclone: "Cyclone",
    seismic: "Seismic"
};

var ROAD_CATEGORY_COLORS = {
    Primary: "#e53935",
    Secondary: "#fb8c00",
    Tertiary: "#1565c0"
};

var PORT_CONFIG = {
    flood: {
        label: "Port Area Flood Exposure",
        shortLabel: "Flood",
        countLabel: "Flood Rasters",
        valueLabel: "Maximum Flood Value",
        meanLabel: "Mean Flood Value",
        pixelLabel: "Flooded Pixels",
        chartHeader: "Max flood value",
        thresholdText: "Flood value > 0",
        countFields: ["FLOOD_COUNT", "flood_count"],
        maxFields: ["MAX_FLOOD", "MAX_FLOOD_VALUE", "max_flood", "max_value"],
        meanFields: ["MEAN_FLOOD", "MEAN_FLOOD_VALUE", "mean_flood", "mean_value"],
        pixelFields: ["FLOOD_PIX", "FLOODED_PIXEL_COUNT", "flood_pix"],
        classFields: ["EXPOSURE_CLASS", "exposure_class"],
        unit: ""
    },
    flood_ii: {
        label: "Port Area Flood-II Exposure",
        shortLabel: "Flood-II",
        countLabel: "Flood Rasters",
        valueLabel: "Maximum Flood Value",
        meanLabel: "Mean Flood Value",
        pixelLabel: "Flooded Pixels",
        chartHeader: "Max flood value",
        thresholdText: "Flood-II value > 0",
        countFields: ["FLOOD_COUNT", "flood_count"],
        maxFields: ["MAX_FLOOD", "MAX_FLOOD_VALUE", "max_flood", "max_value"],
        meanFields: ["MEAN_FLOOD", "MEAN_FLOOD_VALUE", "mean_flood", "mean_value"],
        pixelFields: ["FLOOD_PIX", "FLOODED_PIXEL_COUNT", "flood_pix"],
        classFields: ["EXPOSURE_CLASS", "exposure_class"],
        unit: ""
    },
    landslide: {
        label: "Port Area Landslide Exposure",
        shortLabel: "Landslide",
        countLabel: "Landslide Rasters",
        valueLabel: "Maximum Landslide Class",
        meanLabel: "Mean Landslide Class",
        pixelLabel: "Landslide Pixels",
        chartHeader: "Max landslide class",
        thresholdText: "High >= 3; Very High >= 4",
        countFields: ["LANDSLIDE_COUNT", "LANDSLIDE_RASTER_COUNT", "landslide_count"],
        maxFields: ["MAX_LANDSLIDE", "MAX_LANDSLIDE_VALUE", "MAX_LS_VALUE", "max_landslide", "max_value"],
        meanFields: ["MEAN_LANDSLIDE", "MEAN_LANDSLIDE_VALUE", "MEAN_LS_VALUE", "mean_landslide", "mean_value"],
        pixelFields: ["LANDSLIDE_PIX", "LANDSLIDE_PIXELS", "LANDSLIDE_PIXEL_COUNT", "landslide_pix"],
        classFields: ["EXPOSURE_CLASS", "exposure_class", "LANDSLIDE_CLASS"],
        unit: ""
    },
    cyclone: {
        label: "Port Area Cyclone Exposure",
        shortLabel: "Cyclone",
        countLabel: "Cyclone Rasters",
        valueLabel: "Max Wind Speed",
        meanLabel: "Mean Wind Speed",
        pixelLabel: "Cyclone Pixels",
        chartHeader: "Max wind speed",
        thresholdText: "High >= 24.7 m/s; Very High >= 32.9 m/s; Extreme >= 49.4 m/s",
        countFields: ["CYCLONE_COUNT", "cyclone_count"],
        maxFields: ["MAX_WIND_MPS", "MAX_CYCLONE_WIND_MPS", "max_wind_mps", "max_value"],
        meanFields: ["MEAN_WIND_MPS", "MEAN_CYCLONE_WIND_MPS", "mean_wind_mps", "mean_value"],
        pixelFields: ["CYCLONE_PIX", "CYCLONE_PIXELS", "cyclone_pix"],
        classFields: ["EXPOSURE_CLASS", "exposure_class"],
        unit: "m/s"
    },
    seismic: {
        label: "Port Area Seismic Exposure",
        shortLabel: "Seismic",
        countLabel: "Seismic Rasters",
        valueLabel: "Max PGA",
        meanLabel: "Mean PGA",
        pixelLabel: "Seismic Pixels",
        chartHeader: "Max PGA",
        thresholdText: "High >= 0.20 g; Very High >= 0.40 g; Extreme >= 0.60 g",
        countFields: ["SEISMIC_COUNT", "PGA_COUNT", "seismic_count"],
        maxFields: ["MAX_PGA_G", "MAX_SEISMIC_PGA", "MAX_PGA", "max_pga_g", "max_value"],
        meanFields: ["MEAN_PGA_G", "MEAN_SEISMIC_PGA", "MEAN_PGA", "mean_pga_g", "mean_value"],
        pixelFields: ["SEISMIC_PIX", "PGA_PIX", "SEISMIC_PIXELS", "seismic_pix"],
        classFields: ["EXPOSURE_CLASS", "exposure_class"],
        unit: "g"
    }
};


function byId(id) {
    return document.getElementById(id);
}

function setText(id, text) {
    var element = byId(id);
    if (element) element.textContent = text;
}

function setHtml(id, html) {
    var element = byId(id);
    if (element) element.innerHTML = html;
}

function getValue(id) {
    var element = byId(id);
    return element ? element.value : "";
}

function valueOrNA(text) {
    if (text === null || text === undefined || String(text).trim() === "") return "NA";
    return String(text);
}

function numberValue(value) {
    var parsed = Number(value);
    return isFinite(parsed) ? parsed : 0;
}

function formatDashNumber(number, decimals) {
    var parsed = Number(number);
    if (!isFinite(parsed)) parsed = 0;
    return parsed.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function formatPercent(value) {
    return formatDashNumber(value, 2) + "%";
}

function getProp(props, fields, fallback) {
    props = props || {};
    for (var i = 0; i < fields.length; i++) {
        var key = fields[i];
        if (props[key] !== null && props[key] !== undefined && String(props[key]).trim() !== "") {
            return props[key];
        }
    }
    return fallback;
}

function tableCell(text) {
    return "<td>" + valueOrNA(text) + "</td>";
}

function apiUrl(path, params) {
    var url = new URL(API_BASE + path);
    Object.keys(params || {}).forEach(function (key) {
        var val = params[key];
        if (val !== null && val !== undefined && String(val) !== "" && String(val) !== "All") {
            url.searchParams.set(key, val);
        }
    });
    return url.toString();
}

function getHazardLabel(hazardType) {
    return HAZARD_LABELS[hazardType] || valueOrNA(hazardType);
}

function getFloodTypeLabel(floodType) {
    if (floodType === "inuncoast") return "Coastal Flooding";
    if (floodType === "inunriver") return "River Flooding";
    if (floodType === "flood_ii") return "Flood-II";
    return valueOrNA(floodType);
}

function getPortName(props) {
    return getProp(props, ["port_name", "PORT_NAME_OUT", "PORT_NAME", "name", "Name", "NAME", "port", "PORT"], "Unnamed port area");
}

function getCountryName(props) {
    return getProp(props, ["country_name", "COUNTRY_NAME", "country", "Country", "COUNTRY", "NAME_0", "admin"], "NA");
}

function getRoadCategory(props) {
    var raw = getProp(props, ["road_category", "ROAD_CATEGORY", "final_category"], "Road");
    raw = String(raw).replace("_roads", "");
    return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function getRoadCategoryColor(category) {
    return ROAD_CATEGORY_COLORS[category] || "#334155";
}

function getRoadWeight(category) {
    if (category === "Primary") return 4;
    if (category === "Secondary") return 3;
    return 2;
}

function getStatusBoxId() {
    if (activeDashboardMode === "ports") {
        if (activeTab === "flood") return "portStatusBox";
        if (activeTab === "landslide") return "portLandslideStatusBox";
        if (activeTab === "cyclone") return "portCycloneStatusBox";
        if (activeTab === "seismic") return "portSeismicStatusBox";
    }
    if (activeTab === "flood") return "statusBox";
    if (activeTab === "landslide") return "lsStatusBox";
    if (activeTab === "cyclone") return "cyStatusBox";
    if (activeTab === "seismic") return "seStatusBox";
    return "statusBox";
}

function status(message) {
    setHtml(getStatusBoxId(), message);
}

function getSummaryBoxId() {
    if (activeDashboardMode === "ports") {
        if (activeTab === "flood") return "portSummaryBox";
        if (activeTab === "landslide") return "portLandslideSummaryBox";
        if (activeTab === "cyclone") return "portCycloneSummaryBox";
        if (activeTab === "seismic") return "portSeismicSummaryBox";
    }
    if (activeTab === "flood") return "summaryBox";
    if (activeTab === "landslide") return "lsSummaryBox";
    if (activeTab === "cyclone") return "cySummaryBox";
    if (activeTab === "seismic") return "seSummaryBox";
    return "summaryBox";
}

function getChartIds() {
    if (activeDashboardMode === "ports") {
        if (activeTab === "flood") return { box: "portChartBox", canvas: "portChart" };
        if (activeTab === "landslide") return { box: "portLandslideChartBox", canvas: "portLandslideChart" };
        if (activeTab === "cyclone") return { box: "portCycloneChartBox", canvas: "portCycloneChart" };
        if (activeTab === "seismic") return { box: "portSeismicChartBox", canvas: "portSeismicChart" };
    }
    if (activeTab === "flood") return { box: "floodChartBox", canvas: "floodChart" };
    if (activeTab === "landslide") return { box: "lsChartBox", canvas: "lsChart" };
    if (activeTab === "cyclone") return { box: "cyChartBox", canvas: "cyChart" };
    if (activeTab === "seismic") return { box: "seChartBox", canvas: "seChart" };
    return { box: "floodChartBox", canvas: "floodChart" };
}

function hideActiveChart() {
    var ids = getChartIds();
    var box = byId(ids.box);
    if (box) box.classList.add("hidden");
}

function getPanelIdForMode(mode, tabName) {
    return mode === "ports" ? "port-panel-" + tabName : "panel-" + tabName;
}

function clearLoadedLayer() {
    if (featureLayer) {
        map.removeLayer(featureLayer);
        featureLayer = null;
    }
}

function setDetailedTableEmpty(message) {
    var table = byId("detailedExposureTable");
    if (!table) return;
    table.innerHTML =
        "<thead><tr>" +
        "<th>Hazard</th><th>Road Category</th><th>Scenario</th><th>Exposed Length</th><th>Exposed Count</th><th>Maximum Hazard Value</th>" +
        "</tr></thead>" +
        "<tbody><tr><td colspan='6' class='empty-table-cell'>" + message + "</td></tr></tbody>";
    setText("bottomTableMeta", "0 records");
}

function resetPanelOutput() {
    clearLoadedLayer();
    setDetailedTableEmpty("Click the load button to view PostGIS records.");
    hideActiveChart();
}

function updateBottomTabLabelsForMode(mode) {
    var labels = mode === "ports"
        ? {
            flood: "Port Flood Exposure",
            landslide: "Port Landslide Exposure",
            cyclone: "Port Cyclone Exposure",
            seismic: "Port Seismic Exposure"
        }
        : {
            flood: "Detailed Flood Exposure",
            landslide: "Landslide Exposure",
            cyclone: "Cyclone Exposure",
            seismic: "Seismic Exposure"
        };

    document.querySelectorAll(".bottom-tab").forEach(function (button) {
        var key = button.getAttribute("data-bottom-tab");
        if (labels[key]) button.textContent = labels[key];
    });
}

function updateDashboardHeaderForMode(mode) {
    var isPort = mode === "ports";
    document.body.classList.toggle("port-dashboard-active", isPort);
    document.body.classList.toggle("road-dashboard-active", !isPort);

    setText("dashboardMainTitle", isPort ? "The Port Area Hazard Dashboard" : "The Road Infrastructure Hazard Dashboard");
    setText("dashboardMainSubtitle", isPort ? "Multi-hazard exposure analysis for port areas" : "Multi-hazard exposure analysis for roads");
    setText("railContextTitle", isPort ? "Port Area Exposure" : "Road Exposure");
    setText(
        "railContextDescription",
        isPort
            ? "View flood, landslide, cyclone and seismic port exposure outputs generated from the Python workflow."
            : "View flood, landslide, cyclone and seismic exposure outputs generated from the Python workflow."
    );
}

function updateModeButtons(mode) {
    var isPort = mode === "ports";
    byId("roadDashboardButton").classList.toggle("active", !isPort);
    byId("portDashboardButton").classList.toggle("active", isPort);
}

function updateActiveLayerLabel() {
    var modeLabel = activeDashboardMode === "ports" ? "Port Area" : "Road";
    var hazardType = getSelectedHazardType();
    setText("activeLayerLabel", modeLabel + " " + getHazardLabel(hazardType) + " Exposure");
}

function switchTab(tabName, autoLoad) {
    activeTab = tabName || "flood";
    clearLoadedLayer();

    document.querySelectorAll(".hazard-panel").forEach(function (panel) {
        panel.classList.add("hidden");
    });

    var targetPanel = byId(getPanelIdForMode(activeDashboardMode, activeTab));
    if (targetPanel) targetPanel.classList.remove("hidden");

    document.querySelectorAll(".bottom-tab").forEach(function (button) {
        button.classList.toggle("active", button.getAttribute("data-bottom-tab") === activeTab);
    });

    updateActiveLayerLabel();
    setDetailedTableEmpty("Click the load button to view PostGIS records.");
    hideActiveChart();

    setTimeout(function () { map.invalidateSize(); }, 80);
    if (autoLoad) loadFromCurrentControls();
}

function switchDashboardMode(mode, autoLoad) {
    activeDashboardMode = mode === "ports" ? "ports" : "roads";
    clearLoadedLayer();
    updateModeButtons(activeDashboardMode);
    updateDashboardHeaderForMode(activeDashboardMode);
    updateBottomTabLabelsForMode(activeDashboardMode);
    switchTab(activeTab || "flood", false);
    if (autoLoad) loadFromCurrentControls();
}

function updateFloodDatasetControls() {
    var isFloodII = getValue("floodDataset") === "flood_ii";
    document.querySelectorAll(".flood-original-control").forEach(function (el) {
        el.classList.toggle("hidden", isFloodII);
    });
    document.querySelectorAll(".flood-ii-control").forEach(function (el) {
        el.classList.toggle("hidden", !isFloodII);
    });
    updateActiveLayerLabel();
}

function updatePortFloodDatasetControls() {
    var isFloodII = getValue("portFloodDataset") === "flood_ii";
    document.querySelectorAll(".port-flood-original-control").forEach(function (el) {
        el.classList.toggle("hidden", isFloodII);
    });
    updateActiveLayerLabel();
}

function getSelectedHazardType() {
    if (activeTab === "flood") {
        return activeDashboardMode === "ports"
            ? (getValue("portFloodDataset") || "flood")
            : (getValue("floodDataset") || "flood");
    }
    return activeTab;
}

function getRoadCategoryFromControls() {
    if (activeTab === "flood") return getValue("roadCategory") || "Primary";
    if (activeTab === "landslide") return getValue("lsRoadCategory") === "All" ? "" : getValue("lsRoadCategory");
    if (activeTab === "cyclone") return getValue("cyRoadCategory") === "All" ? "" : getValue("cyRoadCategory");
    if (activeTab === "seismic") return getValue("seRoadCategory") === "All" ? "" : getValue("seRoadCategory");
    return "";
}

function getPortCountryFromControls() {
    if (activeTab === "flood") return getValue("portCountryFilter");
    if (activeTab === "landslide") return getValue("portLandslideCountryFilter");
    if (activeTab === "cyclone") return getValue("portCycloneCountryFilter");
    if (activeTab === "seismic") return getValue("portSeismicCountryFilter");
    return "";
}

function getRoadCountryFromControls() {
    if (activeTab === "flood") return getValue("countryFilter");
    if (activeTab === "cyclone") return getValue("cyCountryFilter");
    if (activeTab === "seismic") return getValue("seCountryFilter");
    return "";
}

function buildPostGISParams() {
    var hazardType = getSelectedHazardType();
    var params = {
        asset_type: activeDashboardMode === "ports" ? "port" : "road",
        hazard_type: hazardType,
        limit: FEATURE_LIMIT
    };

    if (activeDashboardMode === "ports") {
        params.country_name = getPortCountryFromControls();
        if (activeTab === "flood") {
            var portRp = getValue("portReturnPeriod");
            if (portRp && portRp !== "All") params.return_period = portRp;
            if (hazardType === "flood") params.flood_type = getValue("portFloodType") === "All" ? "" : getValue("portFloodType");
        } else {
            var classId = activeTab === "landslide" ? "portLandslideClassFilter" : activeTab === "cyclone" ? "portCycloneClassFilter" : "portSeismicClassFilter";
            var selectedClass = getValue(classId);
            if (selectedClass && selectedClass !== "All") params.exposure_class = selectedClass;
        }
        return params;
    }

    params.road_category = getRoadCategoryFromControls();

    if (activeTab === "flood") {
        params.return_period = getValue("returnPeriod");
        if (hazardType === "flood_ii") {
            params.year = getValue("floodIIYear");
            params.gcm = getValue("floodIIDataset");
            params.deltares_source = getValue("floodIIDataset");
        } else {
            params.epoch = getValue("epoch");
            params.scenario = getValue("scenario");
            params.gcm = getValue("gcm");
            params.flood_type = getValue("floodType");
        }
    } else if (activeTab === "cyclone") {
        params.return_period = getValue("cyReturnPeriod");
        if (getValue("cyModel") !== "All") params.model = getValue("cyModel");
        if (getValue("cyExposureClass") !== "All") params.exposure_class = getValue("cyExposureClass");
    } else if (activeTab === "seismic") {
        params.return_period = getValue("seReturnPeriod");
        if (getValue("seExposureClass") !== "All") params.exposure_class = getValue("seExposureClass");
    }

    return params;
}

function buildSummaryParams(params) {
    var summaryParams = Object.assign({}, params);
    delete summaryParams.limit;
    summaryParams.limit = 200000;
    return summaryParams;
}

function featureColor(feature) {
    var props = feature.properties || {};
    if (props.asset_type === "road") {
        return getRoadCategoryColor(getRoadCategory(props));
    }

    var hazardType = String(props.hazard_type || getSelectedHazardType()).toLowerCase();
    if (hazardType === "flood" || hazardType === "flood_ii") return "#0b3d91";
    if (hazardType === "landslide") return "#8a4b10";
    if (hazardType === "cyclone") return "#9a3412";
    if (hazardType === "seismic") return "#5b21b6";
    return "#334155";
}

function featureStyle(feature) {
    var props = feature.properties || {};
    var isPort = props.asset_type === "port";
    var maxValue = numberValue(props.max_value || props.MAX_FLOOD || props.MAX_WIND_MPS || props.MAX_PGA_G);
    return {
        color: featureColor(feature),
        weight: isPort ? 1.4 : getRoadWeight(getRoadCategory(props)),
        opacity: 0.92,
        fillColor: featureColor(feature),
        fillOpacity: isPort ? Math.min(0.72, 0.35 + maxValue * 0.04) : 0.18
    };
}

function getPortHazardNumber(hazardType, props, fields) {
    var cfg = PORT_CONFIG[hazardType] || PORT_CONFIG.flood;
    return numberValue(getProp(props || {}, fields || cfg.maxFields, 0));
}

function getPortHazardClass(hazardType, props) {
    var cfg = PORT_CONFIG[hazardType] || PORT_CONFIG.flood;
    var explicitClass = getProp(props, cfg.classFields, "");
    if (explicitClass) return explicitClass;
    var value = getPortHazardNumber(hazardType, props, cfg.maxFields);
    if (hazardType === "landslide") {
        if (value >= 4) return "Very High";
        if (value >= 3) return "High";
    }
    if (hazardType === "cyclone") {
        if (value >= 49.4) return "Extreme";
        if (value >= 32.9) return "Very High";
        if (value >= 24.7) return "High";
    }
    if (hazardType === "seismic") {
        if (value >= 0.6) return "Extreme";
        if (value >= 0.4) return "Very High";
        if (value >= 0.2) return "High";
    }
    return value > 0 ? "Exposed" : "NA";
}

function popupHtml(props) {
    var isPort = props.asset_type === "port";
    var hazardType = props.hazard_type || getSelectedHazardType();
    var cfg = PORT_CONFIG[hazardType] || PORT_CONFIG.flood;
    var title = isPort ? getPortName(props) : getRoadCategory(props) + " road";
    var maxValue = isPort
        ? getPortHazardNumber(hazardType, props, cfg.maxFields)
        : numberValue(props.max_value || props.flood_depth_m || props.MAX_WIND_MPS || props.MAX_PGA_G);

    return [
        "<b>" + title + "</b>",
        isPort ? "<b>Country:</b> " + getCountryName(props) : "",
        "<b>Hazard:</b> " + getHazardLabel(hazardType),
        props.exposure_class ? "<b>Exposure class:</b> " + props.exposure_class : "",
        props.return_period ? "<b>Return period:</b> RP" + props.return_period : "",
        props.year ? "<b>Year:</b> " + props.year : "",
        isPort
            ? "<b>" + cfg.valueLabel + ":</b> " + formatDashNumber(maxValue, hazardType === "landslide" ? 0 : 2) + (cfg.unit ? " " + cfg.unit : "")
            : "<b>Length:</b> " + formatDashNumber(props.length_km, 2) + " km"
    ].filter(Boolean).join("<br>");
}

function aggregateSummaryRows(rows) {
    var totalCount = 0;
    var exposedCount = 0;
    var totalLength = 0;
    var exposedLength = 0;
    var maxValue = 0;
    (rows || []).forEach(function (row) {
        totalCount += numberValue(row.total_road_count || row.total_count);
        exposedCount += numberValue(row.exposed_road_count || row.exposed_count);
        totalLength += numberValue(row.total_road_length_km || row.total_length_km);
        exposedLength += numberValue(row.exposed_road_length_km || row.exposed_length_km);
        maxValue = Math.max(maxValue, numberValue(row.max_flood_depth_on_roads_m || row.max_landslide_value_on_roads || row.max_cyclone_wind_speed_on_roads_mps || row.max_seismic_pga_on_roads_g || row.max_value));
    });
    return {
        totalCount: totalCount,
        exposedCount: exposedCount,
        totalLength: totalLength,
        exposedLength: exposedLength,
        countPercent: totalCount ? exposedCount / totalCount * 100 : 0,
        lengthPercent: totalLength ? exposedLength / totalLength * 100 : 0,
        maxValue: maxValue
    };
}

function groupRoadRowsByCategory(rows) {
    var grouped = {};
    (rows || []).forEach(function (row) {
        var category = row.road_category || "Road";
        if (!grouped[category]) grouped[category] = [];
        grouped[category].push(row);
    });
    return ["Primary", "Secondary", "Tertiary"].map(function (category) {
        var agg = aggregateSummaryRows(grouped[category] || []);
        return { key: category, pct: agg.lengthPercent };
    });
}

function drawCategoryChart(title, caption, rows, color, lightColor) {
    var ids = getChartIds();
    var chartBox = byId(ids.box);
    var canvas = byId(ids.canvas);
    if (!chartBox || !canvas) return;
    chartBox.classList.remove("hidden");
    var header = chartBox.querySelector("h3");
    var captionEl = chartBox.querySelector(".chart-caption");
    if (header) header.textContent = title;
    if (captionEl) captionEl.textContent = caption;

    var W = 320;
    var H = 190;
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);

    var labelW = 76;
    var valueW = 58;
    var chartW = W - labelW - valueW - 12;
    var barH = 28;
    var gap = 16;
    var topPad = 34;

    ctx.fillStyle = "#475569";
    ctx.font = "12px DM Sans, Arial";
    ctx.textAlign = "center";
    ctx.fillText("Exposed road length (%)", W / 2, 16);

    [0, 25, 50, 75, 100].forEach(function (tick) {
        var x = labelW + (tick / 100) * chartW;
        ctx.beginPath();
        ctx.strokeStyle = "#d1d5db";
        ctx.lineWidth = 0.6;
        ctx.moveTo(x, topPad - 5);
        ctx.lineTo(x, topPad + 3 * (barH + gap) - gap);
        ctx.stroke();
        ctx.fillStyle = "#6b7280";
        ctx.font = "10px DM Sans, Arial";
        ctx.textAlign = "center";
        ctx.fillText(tick + "%", x, topPad - 9);
    });

    rows.forEach(function (row, index) {
        var y = topPad + index * (barH + gap);
        var pct = Math.max(0, Math.min(100, numberValue(row.pct)));
        var barFill = pct / 100 * chartW;
        ctx.fillStyle = lightColor;
        ctx.fillRect(labelW, y, chartW, barH);
        ctx.fillStyle = ROAD_CATEGORY_COLORS[row.key] || color;
        ctx.fillRect(labelW, y, barFill, barH);
        ctx.fillStyle = "#1f2937";
        ctx.font = "600 12px DM Sans, Arial";
        ctx.textAlign = "right";
        ctx.fillText(row.key, labelW - 8, y + barH / 2 + 4);
        ctx.fillStyle = "#111827";
        ctx.font = "12px DM Sans, Arial";
        ctx.textAlign = "left";
        ctx.fillText(pct.toFixed(1) + "%", labelW + barFill + 6, y + barH / 2 + 4);
    });
}

function drawTopPortChart(hazardType, features) {
    var cfg = PORT_CONFIG[hazardType] || PORT_CONFIG.flood;
    var ids = getChartIds();
    var chartBox = byId(ids.box);
    var canvas = byId(ids.canvas);
    if (!chartBox || !canvas) return;
    if (!features.length) {
        chartBox.classList.add("hidden");
        return;
    }
    chartBox.classList.remove("hidden");
    var header = chartBox.querySelector("h3");
    if (header) header.textContent = "Top Exposed Port Areas";

    var rows = features.map(function (feature) {
        var p = feature.properties || {};
        return {
            name: String(getPortName(p)).slice(0, 20),
            value: getPortHazardNumber(hazardType, p, cfg.maxFields)
        };
    }).sort(function (a, b) { return b.value - a.value; }).slice(0, 6);

    var W = 320;
    var H = 210;
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);
    var maxValue = Math.max.apply(null, rows.map(function (row) { return row.value; }).concat([1]));
    var labelW = 112;
    var valueW = 52;
    var chartW = W - labelW - valueW - 16;
    var barH = 18;
    var gap = 10;
    var topPad = 24;

    ctx.font = "11px DM Sans, Arial";
    ctx.fillStyle = "#5f6b84";
    ctx.fillText(cfg.chartHeader, labelW, 13);

    rows.forEach(function (row, index) {
        var y = topPad + index * (barH + gap);
        var width = Math.max(4, row.value / maxValue * chartW);
        ctx.fillStyle = "#1c2536";
        ctx.textAlign = "right";
        ctx.fillText(row.name, labelW - 8, y + 13);
        ctx.fillStyle = "rgba(47, 128, 237, 0.18)";
        ctx.fillRect(labelW, y, chartW, barH);
        ctx.fillStyle = featureColor({ properties: { asset_type: "port", hazard_type: hazardType } });
        ctx.fillRect(labelW, y, width, barH);
        ctx.fillStyle = "#1c2536";
        ctx.textAlign = "left";
        ctx.fillText(formatDashNumber(row.value, hazardType === "landslide" ? 0 : 2), labelW + chartW + 8, y + 13);
    });
}

function displayRoadFloodSummary(hazardType, rows) {
    var agg = aggregateSummaryRows(rows);
    var first = rows[0] || {};
    var maxDepth = Math.max.apply(null, rows.map(function (row) {
        return numberValue(row.max_flood_depth_on_roads_m || row.max_value);
    }).concat([0]));
    var categoryLabel = getRoadCategoryFromControls() || "All road categories";

    setHtml(getSummaryBoxId(),
        "<h3>Road " + getHazardLabel(hazardType) + " Exposure Summary</h3>" +
        "<div class='scenario-pill'>" +
        "<span>" + (hazardType === "flood_ii" ? "Flood-II" : getFloodTypeLabel(first.flood_type)) + "</span>" +
        "<span>" + (first.return_period ? "RP" + first.return_period : "All RPs") + "</span>" +
        "<span>" + valueOrNA(first.epoch || first.year) + "</span>" +
        "<span>" + valueOrNA(first.climate_scenario || first.scenario || first.deltares_source || first.gcm) + "</span>" +
        "</div>" +
        "<div class='metric-grid'>" +
        "<div class='metric-card metric-card-primary'><div class='metric-label'>Exposed Length</div><div class='metric-value'>" + formatDashNumber(agg.exposedLength, 2) + " km</div><div class='metric-subtext'>" + formatPercent(agg.lengthPercent) + " of " + formatDashNumber(agg.totalLength, 2) + " km</div><div class='metric-progress'><span style='width:" + Math.max(0, Math.min(100, agg.lengthPercent)) + "%'></span></div></div>" +
        "<div class='metric-card'><div class='metric-label'>Exposed Roads</div><div class='metric-value'>" + Number(agg.exposedCount || 0).toLocaleString() + "</div><div class='metric-subtext'>" + formatPercent(agg.countPercent) + " of " + Number(agg.totalCount || 0).toLocaleString() + " roads</div><div class='metric-progress'><span style='width:" + Math.max(0, Math.min(100, agg.countPercent)) + "%'></span></div></div>" +
        "<div class='metric-card'><div class='metric-label'>Max Flood Depth</div><div class='metric-value'>" + formatDashNumber(maxDepth, 2) + " m</div><div class='metric-subtext'>Maximum raster value on exposed road pixels</div></div>" +
        "<div class='metric-card'><div class='metric-label'>Selected Road Category</div><div class='metric-value'>" + categoryLabel + "</div><div class='metric-subtext'>Source: " + valueOrNA(first.deltares_source || first.gcm || "Multiple") + "</div></div>" +
        "</div>" +
        "<div class='summary-detail-list'><div><b>Exposure threshold:</b> &gt; " + formatDashNumber(first.exposure_threshold_m || 0, 2) + " m</div><div><b>Source raster:</b> " + valueOrNA(rows.length === 1 ? first.source_raster : "Multiple summary rows") + "</div></div>"
    );

    drawCategoryChart(
        getHazardLabel(hazardType) + " Exposure Graph",
        "Percentage of total road length exposed by road category for the selected flood scenario.",
        groupRoadRowsByCategory(rows),
        "#0079c1",
        "#e5eef8"
    );
}

function displayLandslideSummary(rows) {
    if (!rows.length) {
        setHtml(getSummaryBoxId(), "<h3>Landslide Exposure Summary</h3><p>No summary rows found for the selected filters.</p>");
        hideActiveChart();
        return;
    }

    var html = "<h3>Landslide Exposure Summary</h3>";
    rows.forEach(function (row) {
        var countPct = numberValue(row.exposed_road_count_percent);
        var lenPct = numberValue(row.exposed_road_length_percent);
        var maxVal = numberValue(row.max_landslide_value_on_roads || row.max_value);
        var maxClass = maxVal >= 4 ? "Very High" : (maxVal >= 3 ? "High" : "NA");

        html +=
            "<div class='ls-category-card'>" +
            "<div class='ls-category-title'>" + valueOrNA(row.road_category) + " Roads</div>" +
            "<div class='ls-stat-row'><span class='ls-stat-label'>Raster source:</span><span class='ls-stat-value'>" + valueOrNA(row.source_raster || "LS_TH_COG") + "</span></div>" +
            "<div class='ls-stat-row'><span class='ls-stat-label'>Threshold rule:</span><span class='ls-stat-value'>" + valueOrNA(row.threshold_rule || "Hazard value >= 3") + "</span></div>" +
            "<div class='ls-stat-row'><span class='ls-stat-label'>Exposed / Total roads:</span><span class='ls-stat-value'>" + Number(row.exposed_road_count || 0).toLocaleString() + " / " + Number(row.total_road_count || 0).toLocaleString() + " (" + formatPercent(countPct) + ")</span></div>" +
            "<div class='ls-stat-row'><span class='ls-stat-label'>Exposed length:</span><span class='ls-stat-value'>" + formatDashNumber(row.exposed_road_length_km, 2) + " / " + formatDashNumber(row.total_road_length_km, 2) + " km</span></div>" +
            "<div class='ls-stat-row'><span class='ls-stat-label'>Exposed length %:</span><span class='ls-stat-value'>" + formatPercent(lenPct) + "</span></div>" +
            "<div class='pct-bar-wrap'><div class='pct-bar-fill' style='width:" + Math.max(0, Math.min(100, lenPct)) + "%;'></div></div>" +
            "<div class='ls-stat-row' style='margin-top:5px;'><span class='ls-stat-label'>Max hazard class:</span><span class='ls-stat-value'>" + maxClass + " (value " + formatDashNumber(maxVal, 0) + ")</span></div>" +
            "</div>";
    });
    setHtml(getSummaryBoxId(), html);

    drawCategoryChart(
        "Exposed Road Length by Category",
        "Percentage of total road length exposed to high/very high landslide hazard.",
        groupRoadRowsByCategory(rows),
        "#bf360c",
        "#f0c4b6"
    );
}

function displayRoadClassHazardSummary(hazardType, rows) {
    var isCyclone = hazardType === "cyclone";
    var agg = aggregateSummaryRows(rows);
    var maxValue = Math.max.apply(null, rows.map(function (row) {
        return numberValue(isCyclone ? row.max_cyclone_wind_speed_on_roads_mps : row.max_seismic_pga_on_roads_g);
    }).concat([0]));
    var unit = isCyclone ? "m/s" : "g";
    var valueLabel = isCyclone ? "Max Wind Speed" : "Max PGA";
    var first = rows[0] || {};

    setHtml(getSummaryBoxId(),
        "<h3>" + getHazardLabel(hazardType) + " Exposure Summary</h3>" +
        "<div class='scenario-pill'><span>" + getHazardLabel(hazardType) + "</span><span>" + valueOrNA(first.model || first.hazard_variable || "PGA") + "</span><span>" + (first.return_period ? "RP" + first.return_period : "All RPs") + "</span></div>" +
        "<div class='metric-grid'>" +
        "<div class='metric-card metric-card-primary'><div class='metric-label'>Exposed Length</div><div class='metric-value'>" + formatDashNumber(agg.exposedLength, 2) + " km</div><div class='metric-subtext'>" + formatPercent(agg.lengthPercent) + " of " + formatDashNumber(agg.totalLength, 2) + " km</div><div class='metric-progress'><span style='width:" + Math.max(0, Math.min(100, agg.lengthPercent)) + "%'></span></div></div>" +
        "<div class='metric-card'><div class='metric-label'>Exposed Roads</div><div class='metric-value'>" + Number(agg.exposedCount || 0).toLocaleString() + "</div><div class='metric-subtext'>" + formatPercent(agg.countPercent) + " of " + Number(agg.totalCount || 0).toLocaleString() + " roads</div><div class='metric-progress'><span style='width:" + Math.max(0, Math.min(100, agg.countPercent)) + "%'></span></div></div>" +
        "<div class='metric-card'><div class='metric-label'>" + valueLabel + "</div><div class='metric-value'>" + formatDashNumber(maxValue, isCyclone ? 2 : 3) + " " + unit + "</div><div class='metric-subtext'>Maximum raster value on exposed road pixels</div></div>" +
        "<div class='metric-card'><div class='metric-label'>Selected Road Category</div><div class='metric-value'>" + (getRoadCategoryFromControls() || "All categories") + "</div><div class='metric-subtext'>Summary from imported Python output</div></div>" +
        "</div>" +
        "<div class='summary-detail-list'><div><b>Threshold:</b> " + (isCyclone ? "High >= 24.7 m/s; Very High >= 32.9 m/s; Extreme >= 49.4 m/s" : "High >= 0.20 g; Very High >= 0.40 g; Extreme >= 0.60 g") + "</div><div><b>Source raster:</b> " + valueOrNA(rows.length === 1 ? first.source_raster : "Multiple summary rows") + "</div></div>"
    );

    drawCategoryChart(
        "Exposed Road Length by Category",
        "Percentage of total road length exposed to selected " + getHazardLabel(hazardType).toLowerCase() + " hazard.",
        groupRoadRowsByCategory(rows),
        featureColor({ properties: { asset_type: "road", road_category: "Primary" } }),
        "#e5eef8"
    );
}

function displayRoadFeatureSummary(hazardType, features, aggregateSummary) {
    var rowsByCategory = {};
    var totalLength = 0;
    features.forEach(function (feature) {
        var p = feature.properties || {};
        var category = getRoadCategory(p);
        var length = numberValue(p.length_km);
        totalLength += length;
        rowsByCategory[category] = numberValue(rowsByCategory[category]) + length;
    });

    var chartRows = ["Primary", "Secondary", "Tertiary"].map(function (category) {
        return { key: category, pct: totalLength ? numberValue(rowsByCategory[category]) / totalLength * 100 : 0 };
    });

    setHtml(getSummaryBoxId(),
        "<h3>Road " + getHazardLabel(hazardType) + " Exposure Summary</h3>" +
        "<div class='metric-grid'>" +
        "<div class='metric-card metric-card-primary'><div class='metric-label'>Exposed Roads</div><div class='metric-value'>" + Number(aggregateSummary.total_features || features.length || 0).toLocaleString() + "</div><div class='metric-subtext'>PostGIS feature records matching filters</div></div>" +
        "<div class='metric-card'><div class='metric-label'>Returned Length</div><div class='metric-value'>" + formatDashNumber(totalLength, 2) + " km</div><div class='metric-subtext'>Length from returned map records</div></div>" +
        "<div class='metric-card'><div class='metric-label'>Maximum Hazard Value</div><div class='metric-value'>" + formatDashNumber(aggregateSummary.max_value, hazardType === "seismic" ? 3 : 2) + "</div><div class='metric-subtext'>Maximum value from matching PostGIS records</div></div>" +
        "<div class='metric-card'><div class='metric-label'>Selected Road Category</div><div class='metric-value'>" + (getRoadCategoryFromControls() || "All categories") + "</div><div class='metric-subtext'>Feature-derived summary</div></div>" +
        "</div>"
    );

    drawCategoryChart(
        "Exposed Road Length by Category",
        "Percentage by road category among the records returned from PostGIS.",
        chartRows,
        "#1565c0",
        "#e5eef8"
    );
}

function summarizePortFeatures(hazardType, features, aggregateSummary) {
    var cfg = PORT_CONFIG[hazardType] || PORT_CONFIG.flood;
    var maxValue = numberValue(aggregateSummary.max_value);
    var meanValues = [];
    var totalPixels = 0;
    var totalRasters = 0;
    var classCounts = {};

    features.forEach(function (feature) {
        var p = feature.properties || {};
        maxValue = Math.max(maxValue, getPortHazardNumber(hazardType, p, cfg.maxFields));
        meanValues.push(getPortHazardNumber(hazardType, p, cfg.meanFields));
        totalPixels += getPortHazardNumber(hazardType, p, cfg.pixelFields);
        totalRasters += getPortHazardNumber(hazardType, p, cfg.countFields);
        var className = getPortHazardClass(hazardType, p);
        classCounts[className] = (classCounts[className] || 0) + 1;
    });

    return {
        count: Number(aggregateSummary.total_features || features.length || 0),
        returnedCount: features.length,
        maxValue: maxValue,
        meanValue: meanValues.length ? meanValues.reduce(function (sum, item) { return sum + item; }, 0) / meanValues.length : 0,
        totalPixels: totalPixels,
        totalRasters: totalRasters,
        classCounts: classCounts
    };
}

function displayPortSummary(hazardType, features, aggregateSummary) {
    var cfg = PORT_CONFIG[hazardType] || PORT_CONFIG.flood;
    var summary = summarizePortFeatures(hazardType, features, aggregateSummary);
    var countryLabel = getPortCountryFromControls() || "All countries";
    var classText = Object.keys(summary.classCounts).map(function (key) {
        return key + ": " + Number(summary.classCounts[key] || 0).toLocaleString();
    }).join(" | ");

    setHtml(getSummaryBoxId(),
        "<h3>" + cfg.label + " Summary</h3>" +
        "<div class='scenario-pill port-scenario-pill'><span>" + countryLabel + "</span><span>" + getHazardLabel(hazardType) + "</span></div>" +
        "<div class='metric-grid'>" +
        "<div class='metric-card metric-card-primary'><div class='metric-label'>Exposed Port Areas</div><div class='metric-value'>" + Number(summary.count || 0).toLocaleString() + "</div><div class='metric-subtext'>Only exposed polygons are displayed</div></div>" +
        "<div class='metric-card'><div class='metric-label'>" + cfg.valueLabel + "</div><div class='metric-value'>" + formatDashNumber(summary.maxValue, hazardType === "landslide" ? 0 : 2) + (cfg.unit ? " " + cfg.unit : "") + "</div><div class='metric-subtext'>Highest polygon-level value</div></div>" +
        "<div class='metric-card'><div class='metric-label'>" + cfg.meanLabel + "</div><div class='metric-value'>" + formatDashNumber(summary.meanValue, hazardType === "landslide" ? 1 : 2) + (cfg.unit ? " " + cfg.unit : "") + "</div><div class='metric-subtext'>Average of returned polygon-level mean values</div></div>" +
        "<div class='metric-card'><div class='metric-label'>" + cfg.pixelLabel + "</div><div class='metric-value'>" + Number(summary.totalPixels || 0).toLocaleString() + "</div><div class='metric-subtext'>Total exposed raster pixels in returned port areas</div></div>" +
        "</div>" +
        "<div class='summary-detail-list'><div><b>Returned map records:</b> " + Number(summary.returnedCount || 0).toLocaleString() + "</div><div><b>Total raster hits:</b> " + Number(summary.totalRasters || 0).toLocaleString() + "</div><div><b>Class counts:</b> " + valueOrNA(classText) + "</div><div><b>Threshold:</b> " + cfg.thresholdText + "</div></div>"
    );

    drawTopPortChart(hazardType, features);
}

function buildFloodTable(rows) {
    var head = "<thead><tr><th>Road Category</th><th>Flood Type</th><th>Return Period</th><th>Epoch</th><th>Scenario</th><th>GCM</th><th>Exposed Length</th><th>Exposed Roads</th><th>Max Depth</th></tr></thead>";
    var body = "<tbody>" + rows.map(function (row) {
        return "<tr>" +
            tableCell(row.road_category) +
            tableCell(row.hazard_type === "flood_ii" ? "Flood-II" : getFloodTypeLabel(row.flood_type)) +
            tableCell(row.return_period ? "RP" + row.return_period : "All RPs") +
            tableCell(row.epoch || row.year) +
            tableCell(row.climate_scenario || row.scenario || row.deltares_source || row.gcm) +
            tableCell(row.gcm || row.deltares_source) +
            tableCell(formatDashNumber(row.exposed_road_length_km || row.exposed_length_km, 2) + " km (" + formatDashNumber(row.exposed_road_length_percent || row.exposed_length_percent, 2) + "%)") +
            tableCell(Number(row.exposed_road_count || row.exposed_count || 0).toLocaleString() + " / " + Number(row.total_road_count || row.total_count || 0).toLocaleString()) +
            tableCell(formatDashNumber(row.max_flood_depth_on_roads_m || row.max_value, 2) + " m") +
            "</tr>";
    }).join("") + "</tbody>";
    return head + body;
}

function buildLandslideTable(rows) {
    var head = "<thead><tr><th>Road Category</th><th>Threshold</th><th>Exposed Length</th><th>Exposed Roads</th><th>Max Hazard Value</th><th>Source Raster</th></tr></thead>";
    var body = "<tbody>" + rows.map(function (row) {
        return "<tr>" +
            tableCell(row.road_category) +
            tableCell(row.threshold_rule || "Hazard value >= 3") +
            tableCell(formatDashNumber(row.exposed_road_length_km || row.exposed_length_km, 2) + " km (" + formatDashNumber(row.exposed_road_length_percent || row.exposed_length_percent, 2) + "%)") +
            tableCell(Number(row.exposed_road_count || row.exposed_count || 0).toLocaleString() + " / " + Number(row.total_road_count || row.total_count || 0).toLocaleString()) +
            tableCell(formatDashNumber(row.max_landslide_value_on_roads || row.max_value, 2)) +
            tableCell(row.source_raster) +
            "</tr>";
    }).join("") + "</tbody>";
    return head + body;
}

function buildCycloneSeismicSummaryTable(rows, hazardType) {
    var isCyclone = hazardType === "cyclone";
    var head = "<thead><tr><th>Hazard</th><th>Road Category</th><th>Scenario</th><th>Exposure Class</th><th>Exposed Length</th><th>Exposed Roads</th><th>Maximum Value</th></tr></thead>";
    var body = "<tbody>" + rows.map(function (row) {
        var scenario = isCyclone ? "Model " + valueOrNA(row.model) + " | RP" + valueOrNA(row.return_period) : "PGA | RP" + valueOrNA(row.return_period) + " | " + valueOrNA(row.site_condition);
        var maxValue = isCyclone ? formatDashNumber(row.max_cyclone_wind_speed_on_roads_mps, 2) + " m/s" : formatDashNumber(row.max_seismic_pga_on_roads_g, 3) + " g";
        return "<tr>" +
            tableCell(getHazardLabel(hazardType)) +
            tableCell(row.road_category) +
            tableCell(scenario) +
            tableCell(row.minimum_exposure_class || "All Classes") +
            tableCell(formatDashNumber(row.exposed_road_length_km || row.exposed_length_km, 2) + " km (" + formatDashNumber(row.exposed_road_length_percent || row.exposed_length_percent, 2) + "%)") +
            tableCell(Number(row.exposed_road_count || row.exposed_count || 0).toLocaleString() + " / " + Number(row.total_road_count || row.total_count || 0).toLocaleString()) +
            tableCell(maxValue) +
            "</tr>";
    }).join("") + "</tbody>";
    return head + body;
}

function buildRoadFeatureTable(hazardType, features) {
    var head = "<thead><tr><th>Hazard</th><th>Road Category</th><th>Exposure Class</th><th>Return Period</th><th>Year</th><th>Length</th><th>Maximum Hazard Value</th></tr></thead>";
    var body = "<tbody>" + features.map(function (feature) {
        var p = feature.properties || {};
        return "<tr>" +
            tableCell(getHazardLabel(hazardType)) +
            tableCell(getRoadCategory(p)) +
            tableCell(p.exposure_class || p.EXPOSURE_CLASS || "Exposed") +
            tableCell(p.return_period ? "RP" + p.return_period : "NA") +
            tableCell(p.year || p.epoch) +
            tableCell(formatDashNumber(p.length_km, 2) + " km") +
            tableCell(formatDashNumber(p.max_value || p.flood_depth_m || p.MAX_WIND_MPS || p.MAX_PGA_G, hazardType === "seismic" ? 3 : 2)) +
            "</tr>";
    }).join("") + "</tbody>";
    return head + body;
}

function buildPortTable(hazardType, features) {
    var cfg = PORT_CONFIG[hazardType] || PORT_CONFIG.flood;
    var isFlood = hazardType === "flood" || hazardType === "flood_ii";
    var decimals = hazardType === "landslide" ? 0 : 2;
    var head = isFlood
        ? "<thead><tr><th>Country</th><th>Port Area</th><th>" + cfg.countLabel + "</th><th>" + cfg.valueLabel + "</th><th>" + cfg.meanLabel + "</th><th>" + cfg.pixelLabel + "</th></tr></thead>"
        : "<thead><tr><th>Country</th><th>Port Area</th><th>Exposure Class</th><th>" + cfg.countLabel + "</th><th>" + cfg.valueLabel + "</th><th>" + cfg.meanLabel + "</th><th>" + cfg.pixelLabel + "</th></tr></thead>";

    var body = "<tbody>" + features.map(function (feature) {
        var p = feature.properties || {};
        if (isFlood) {
            return "<tr>" +
                tableCell(getCountryName(p)) +
                tableCell(getPortName(p)) +
                tableCell(Number(getPortHazardNumber(hazardType, p, cfg.countFields)).toLocaleString()) +
                tableCell(formatDashNumber(getPortHazardNumber(hazardType, p, cfg.maxFields), 2)) +
                tableCell(formatDashNumber(getPortHazardNumber(hazardType, p, cfg.meanFields), 2)) +
                tableCell(Number(getPortHazardNumber(hazardType, p, cfg.pixelFields)).toLocaleString()) +
                "</tr>";
        }
        return "<tr>" +
            tableCell(getCountryName(p)) +
            tableCell(getPortName(p)) +
            tableCell(getPortHazardClass(hazardType, p)) +
            tableCell(Number(getPortHazardNumber(hazardType, p, cfg.countFields)).toLocaleString()) +
            tableCell(formatDashNumber(getPortHazardNumber(hazardType, p, cfg.maxFields), decimals) + (cfg.unit ? " " + cfg.unit : "")) +
            tableCell(formatDashNumber(getPortHazardNumber(hazardType, p, cfg.meanFields), hazardType === "landslide" ? 1 : 2) + (cfg.unit ? " " + cfg.unit : "")) +
            tableCell(Number(getPortHazardNumber(hazardType, p, cfg.pixelFields)).toLocaleString()) +
            "</tr>";
    }).join("") + "</tbody>";

    return head + body;
}

function updateDetailedTable(assetType, hazardType, features, summaryRows) {
    var table = byId("detailedExposureTable");
    if (!table) return;

    if (assetType === "port") {
        var cfg = PORT_CONFIG[hazardType] || PORT_CONFIG.flood;
        setText("bottomTableTitle", "Detailed " + cfg.label + " Table");
        setText("bottomTableSubtitle", "Exposed port polygons for " + (getPortCountryFromControls() || "All countries") + ".");
        setText("bottomTableMeta", features.length.toLocaleString() + " record" + (features.length === 1 ? "" : "s"));
        table.innerHTML = features.length ? buildPortTable(hazardType, features) : "<tbody><tr><td class='empty-table-cell'>No exposed port polygons match the selected filters.</td></tr></tbody>";
        return;
    }

    setText("bottomTableTitle", "Detailed Road " + getHazardLabel(hazardType) + " Exposure Table");
    setText("bottomTableSubtitle", "Summary rows and records served from the PostGIS database.");

    if (summaryRows.length) {
        setText("bottomTableMeta", summaryRows.length.toLocaleString() + " record" + (summaryRows.length === 1 ? "" : "s"));
        if (hazardType === "flood" || hazardType === "flood_ii") table.innerHTML = buildFloodTable(summaryRows);
        else if (hazardType === "landslide") table.innerHTML = buildLandslideTable(summaryRows);
        else table.innerHTML = buildCycloneSeismicSummaryTable(summaryRows, hazardType);
    } else {
        setText("bottomTableMeta", features.length.toLocaleString() + " record" + (features.length === 1 ? "" : "s"));
        table.innerHTML = features.length ? buildRoadFeatureTable(hazardType, features) : "<tbody><tr><td class='empty-table-cell'>No matching records found.</td></tr></tbody>";
    }
}

function renderDashboardOutput(features, aggregateSummary, summaryRows) {
    var assetType = activeDashboardMode === "ports" ? "port" : "road";
    var hazardType = getSelectedHazardType();

    if (assetType === "port") {
        displayPortSummary(hazardType, features, aggregateSummary);
    } else if ((hazardType === "flood" || hazardType === "flood_ii") && summaryRows.length) {
        displayRoadFloodSummary(hazardType, summaryRows);
    } else if (hazardType === "landslide" && summaryRows.length) {
        displayLandslideSummary(summaryRows);
    } else if ((hazardType === "cyclone" || hazardType === "seismic") && summaryRows.length) {
        displayRoadClassHazardSummary(hazardType, summaryRows);
    } else {
        displayRoadFeatureSummary(hazardType, features, aggregateSummary);
    }

    updateDetailedTable(assetType, hazardType, features, summaryRows);
}

function loadFromCurrentControls() {
    if (!filtersLoaded) return;

    var params = buildPostGISParams();
    var summaryParams = buildSummaryParams(params);
    var assetType = activeDashboardMode === "ports" ? "port" : "road";
    var hazardType = getSelectedHazardType();
    status("Loading " + getHazardLabel(hazardType).toLowerCase() + " output from PostGIS...");

    Promise.all([
        fetch(apiUrl("/api/features", params)).then(function (response) {
            if (!response.ok) throw new Error("Feature request failed");
            return response.json();
        }),
        fetch(apiUrl("/api/summary", params)).then(function (response) {
            if (!response.ok) throw new Error("Summary request failed");
            return response.json();
        }),
        assetType === "road"
            ? fetch(apiUrl("/api/summary-rows", summaryParams)).then(function (response) {
                if (!response.ok) throw new Error("Summary row request failed");
                return response.json();
            })
            : Promise.resolve({ rows: [] })
    ])
        .then(function (results) {
            var data = results[0];
            var aggregateSummary = results[1] || {};
            var summaryRows = (results[2] && results[2].rows) || [];
            var features = data.features || [];

            clearLoadedLayer();
            featureLayer = L.geoJSON(data, {
                style: featureStyle,
                onEachFeature: function (feature, layer) {
                    layer.bindPopup(popupHtml(feature.properties || {}));
                }
            }).addTo(map);

            if (features.length) {
                try {
                    var bounds = featureLayer.getBounds();
                    if (bounds && bounds.isValid()) {
                        map.invalidateSize();
                        map.fitBounds(bounds, { padding: [28, 28], maxZoom: 11 });
                    }
                } catch (error) {
                    console.log("Could not fit bounds", error);
                }
            }

            renderDashboardOutput(features, aggregateSummary, summaryRows);
            status(
                "Loaded from PostGIS.<br>" +
                "<b>Matching records:</b> " + Number(aggregateSummary.total_features || features.length || 0).toLocaleString() + "<br>" +
                "<b>Map/table records returned:</b> " + Number(features.length || 0).toLocaleString()
            );
        })
        .catch(function (error) {
            console.error(error);
            status("ERROR: " + error.message);
        });
}

function option(select, label, value) {
    var opt = document.createElement("option");
    opt.textContent = label;
    opt.value = value;
    select.appendChild(opt);
}

function populateCountrySelect(id, countries, emptyLabel) {
    var select = byId(id);
    if (!select) return;
    var current = select.value;
    select.innerHTML = "";
    option(select, emptyLabel, "");
    (countries || []).forEach(function (country) {
        if (!country) return;
        option(select, country, country);
    });
    if (current && Array.prototype.some.call(select.options, function (opt) { return opt.value === current; })) {
        select.value = current;
    }
}

function loadFilters() {
    fetch(API_BASE + "/health")
        .then(function (response) {
            if (!response.ok) throw new Error("API health check failed");
            return response.json();
        })
        .then(function (health) {
            console.log("PostGIS API connected:", health);
            return fetch(API_BASE + "/api/filters");
        })
        .then(function (response) {
            if (!response.ok) throw new Error("Could not load API filters");
            return response.json();
        })
        .then(function (filters) {
            var countries = filters.countries || [];
            populateCountrySelect("countryFilter", countries, "Select a country");
            populateCountrySelect("cyCountryFilter", countries, "Select a country");
            populateCountrySelect("seCountryFilter", countries, "Select a country");
            populateCountrySelect("portCountryFilter", countries, "All countries");
            populateCountrySelect("portLandslideCountryFilter", countries, "All countries");
            populateCountrySelect("portCycloneCountryFilter", countries, "All countries");
            populateCountrySelect("portSeismicCountryFilter", countries, "All countries");

            setHtml("countryBoundaryStatus", "Country list loaded from PostGIS. Select a country to zoom/filter where applicable.");
            setHtml("cyCountryBoundaryStatus", "Country list loaded from PostGIS. Select a country to zoom/filter where applicable.");
            setHtml("seCountryBoundaryStatus", "Country list loaded from PostGIS. Select a country to zoom/filter where applicable.");
            setHtml("portCountryBoundaryStatus", "Country list loaded from PostGIS exposed-port records.");
            setHtml("portLandslideCountryStatus", "Country list loaded from PostGIS exposed-port records.");
            setHtml("portCycloneCountryStatus", "Country list loaded from PostGIS exposed-port records.");
            setHtml("portSeismicCountryStatus", "Country list loaded from PostGIS exposed-port records.");

            filtersLoaded = true;
            updateFloodDatasetControls();
            updatePortFloodDatasetControls();
            switchDashboardMode("roads", false);
            status("Filters loaded. Loading default PostGIS output...");
            loadFromCurrentControls();
        })
        .catch(function (error) {
            console.error(error);
            status("Could not reach the PostGIS API at <code>" + API_BASE + "</code>.<br>Start it with <code>backend_postgis\\run_api.bat</code>.");
        });
}

function attachEvents() {
    byId("roadDashboardButton").addEventListener("click", function () { switchDashboardMode("roads", true); });
    byId("portDashboardButton").addEventListener("click", function () { switchDashboardMode("ports", true); });
    byId("resetViewButton").addEventListener("click", function () {
        map.setView([20.5, 85.0], 7);
        loadFromCurrentControls();
    });
    byId("mapZoomInButton").addEventListener("click", function () { map.zoomIn(); });
    byId("mapZoomOutButton").addEventListener("click", function () { map.zoomOut(); });

    document.querySelectorAll(".bottom-tab").forEach(function (button) {
        button.addEventListener("click", function () {
            switchTab(button.getAttribute("data-bottom-tab"), true);
        });
    });

    byId("floodDataset").addEventListener("change", function () {
        updateFloodDatasetControls();
        loadFromCurrentControls();
    });
    byId("portFloodDataset").addEventListener("change", function () {
        updatePortFloodDatasetControls();
        loadFromCurrentControls();
    });

    [
        "loadButton", "lsLoadButton", "cyLoadButton", "seLoadButton",
        "portLoadButton", "portLandslideLoadButton", "portCycloneLoadButton", "portSeismicLoadButton"
    ].forEach(function (id) {
        var button = byId(id);
        if (button) button.addEventListener("click", loadFromCurrentControls);
    });
}

attachEvents();
loadFilters();
