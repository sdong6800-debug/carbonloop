#! python 3
# CarbonLoop Rhino 8 sender prototype
# Sends selected objects, one layer/floor, or the whole model to the local CarbonLoop bridge.
import json
import os
import re
import socket
import uuid
from datetime import datetime, timezone
import urllib.request
import urllib.error
import Rhino
import rhinoscriptsyntax as rs
import scriptcontext as sc

BRIDGE_URL = "http://127.0.0.1:8515/rhino-intake"
CONTRACT_VERSION = "carbonloop.rhino.intake/1.0.0"
SCRIPT_VERSION = "carbonloop-rhino-script/0.2.0"
SUPPORTED_UNITS = {"Meters", "Millimeters", "Centimeters"}
PREVIEW_MINIMUM = {"Meters": 0.02, "Millimeters": 20.0, "Centimeters": 2.0}


_native_idle_handler = None


def _run_native_plugin():
    """Route legacy toolbar macros to the installed native Rhino plug-in.

    Early CarbonLoop builds asked users to create a toolbar macro that runs
    this Python file.  Keeping that button working is important, but the
    Python sender must no longer serialize and POST a whole building model.
    The native command publishes inside Rhino, avoids the HTTP timeout, and
    owns the current semantic/sync pipeline.
    """
    global _native_idle_handler
    try:
        # ScriptEditor is itself a running Rhino command.  Starting another
        # command synchronously from here is rejected by Rhino and used to
        # make the legacy HTTP sender run again (and time out on large files).
        # Queue the native command for the next idle tick, after ScriptEditor
        # has returned control to Rhino.
        def start_native_on_idle(sender, event):
            global _native_idle_handler
            Rhino.RhinoApp.Idle -= _native_idle_handler
            _native_idle_handler = None
            Rhino.RhinoApp.RunScript("_CarbonLoopSend", False)

        _native_idle_handler = start_native_on_idle
        Rhino.RhinoApp.Idle += _native_idle_handler
        Rhino.RhinoApp.WriteLine(
            "CarbonLoop：工具栏已转接到原生插件；正在打开分析范围选择。"
        )
        return True
    except Exception as error:
        Rhino.RhinoApp.WriteLine(
            "CarbonLoop：原生插件转接失败，改用兼容发送：{}".format(error)
        )
        return False


def _load_semantic_profile():
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rhino-semantic-profile.json")
    with open(path, "r", encoding="utf-8") as source:
        return json.load(source)


SEMANTIC_PROFILE = _load_semantic_profile()
SEMANTIC_PROFILE_VERSION = SEMANTIC_PROFILE.get("version", "unknown")


def _unit_name():
    name = str(sc.doc.ModelUnitSystem)
    if name not in SUPPORTED_UNITS:
        raise ValueError("CarbonLoop 当前只支持 m、mm、cm；当前 Rhino 单位为 {}。".format(name))
    return name


def _pick_scope():
    labels = ["当前已选 / 重新框选构件", "指定图层（作为楼层范围）", "整个模型"]
    choice = rs.ListBox(labels, "选择发送范围", "发送到 CarbonLoop")
    if not choice:
        return None, None, None
    if choice == labels[0]:
        ids = rs.SelectedObjects() or rs.GetObjects("选择要发送到 CarbonLoop 的构件", preselect=True, select=False)
        return "selection", ids or [], None
    if choice == labels[1]:
        layers = sorted(rs.LayerNames() or [])
        layer = rs.ListBox(layers, "选择作为本次分析范围的图层", "发送指定图层")
        return ("floor", rs.ObjectsByLayer(layer) or [], layer) if layer else (None, None, None)
    return "all", rs.AllObjects(select=False, include_lights=False, include_grips=False) or [], None


def _user_text(attributes, key):
    try:
        value = attributes.GetUserString(key)
        return value.strip() if value else None
    except Exception:
        return None


def _normalized_words(value):
    return " " + re.sub(r"[^0-9a-zA-Z\u4e00-\u9fff]+", " ", value or "").strip().lower() + " "


def _find_profile_match(value, groups):
    text = _normalized_words(value)
    matches = []
    for category, terms in groups.items():
        for term in terms:
            needle = _normalized_words(term)
            if needle.strip() and needle in text:
                matches.append((len(needle.strip()), category, term))
    if matches:
        _, category, term = sorted(matches, reverse=True)[0]
        return category, term
    return None, None


def _infer_type(explicit_type, name, layer):
    if explicit_type:
        explicit_match, term = _find_profile_match(explicit_type, SEMANTIC_PROFILE["elementTypes"])
        if explicit_match:
            return explicit_match, {"source": "CarbonLoop.Type", "confidence": 1.0,
                                    "basis": "Rhino 对象已提供 CarbonLoop.Type={}。".format(explicit_type)}
    layer_leaf = layer.split("::")[-1] if layer else ""
    for source, value, confidence in [("object-name", name, 0.96), ("layer-leaf", layer_leaf, 0.94), ("layer-path", layer, 0.90)]:
        match, term = _find_profile_match(value, SEMANTIC_PROFILE["elementTypes"])
        if match:
            return match, {"source": source, "confidence": confidence,
                           "basis": "根据 {} 中的‘{}’识别。".format("对象名称" if source == "object-name" else "Rhino 图层", term)}
    return "unknown", {"source": "unmatched", "confidence": 0.0, "basis": "名称与图层未命中语义词典，保留待核对。"}


def _infer_material_product(name, layer):
    match, term = _find_profile_match(name, SEMANTIC_PROFILE["materials"])
    if match:
        return match, {"source": "material-name", "confidence": 0.96, "basis": "根据 Rhino 材料名称中的‘{}’匹配。".format(term)}
    match, term = _find_profile_match(layer, SEMANTIC_PROFILE["materials"])
    if match:
        return match, {"source": "layer-hint", "confidence": 0.78, "basis": "模型未提供可识别材料；根据图层中的‘{}’提出建议，需人工确认。".format(term)}
    return "", {"source": "unmatched", "confidence": 0.0, "basis": "材料名称与图层均未命中材料词典，保留待核对。"}


def _material(rhino_object, layer):
    attributes = rhino_object.Attributes
    explicit = _user_text(attributes, "CarbonLoop.Material")
    grade = _user_text(attributes, "CarbonLoop.Grade") or ""
    name = explicit
    if not name:
        try:
            render_material = rhino_object.GetRenderMaterial(True)
            if render_material and render_material.Name:
                name = render_material.Name
        except Exception:
            pass
    if not name and attributes.MaterialIndex >= 0:
        try:
            name = sc.doc.Materials[attributes.MaterialIndex].Name
        except Exception:
            pass
    product_type, inference = _infer_material_product(name or "", layer)
    if not name and not product_type:
        return None
    if not name:
        name = "图层建议：{}".format(layer.split("::")[-1])
    return {"id": str(attributes.MaterialIndex) if attributes.MaterialIndex >= 0 else name,
            "name": name, "productType": product_type, "grade": grade, "inference": inference}


def _analysis_eligibility(layer, name):
    match, term = _find_profile_match("{} {}".format(layer, name), {"excluded": SEMANTIC_PROFILE["excludeFromCarbonAnalysis"]})
    if match:
        return False, "图层或名称包含‘{}’，默认作为标注/辅助对象排除，可在 Rhino 中改层后重发。".format(term)
    return True, "三维对象默认进入分析范围。"


def _volume(geometry):
    try:
        target = geometry.ToBrep() if isinstance(geometry, Rhino.Geometry.Extrusion) else geometry
        props = Rhino.Geometry.VolumeMassProperties.Compute(target)
        if props and props.Volume > 0:
            return float(props.Volume)
    except Exception:
        return None
    return None


def _object_payload(object_id, scope_floor):
    rhino_object = sc.doc.Objects.FindId(object_id)
    if not rhino_object or not rhino_object.Geometry:
        return None
    geometry = rhino_object.Geometry
    bbox = geometry.GetBoundingBox(True)
    if not bbox.IsValid:
        return None
    raw_dims = [bbox.Max.X - bbox.Min.X, bbox.Max.Y - bbox.Min.Y, bbox.Max.Z - bbox.Min.Z]
    if max(raw_dims) <= 0:
        return None
    preview_minimum = PREVIEW_MINIMUM[_unit_name()]
    dims = [max(value, preview_minimum) for value in raw_dims]
    preview_adjusted = any(value <= 0 for value in raw_dims)
    attributes = rhino_object.Attributes
    layer = sc.doc.Layers[attributes.LayerIndex].FullPath if attributes.LayerIndex >= 0 else ""
    name = attributes.Name or layer.split("::")[-1] or str(object_id)[:8]
    explicit_type = _user_text(attributes, "CarbonLoop.Type")
    type_hint, type_inference = _infer_type(explicit_type, name, layer)
    analysis_eligible, eligibility_basis = _analysis_eligibility(layer, name)
    floor = _user_text(attributes, "CarbonLoop.Floor") or scope_floor or (layer.split("::")[0] if layer else None)
    volume = _volume(geometry)
    quantity = None if volume is None else {"kind": "net-volume", "value": volume,
        "basis": "Rhino 封闭几何 VolumeMassProperties 净体积"}
    return {
        "id": str(object_id), "name": name,
        "typeHint": type_hint, "typeInference": type_inference,
        "analysisEligible": analysis_eligible, "eligibilityBasis": eligibility_basis,
        "floor": floor, "layer": layer,
        "geometry": {"kind": "box", "origin": [bbox.Min.X, bbox.Min.Y, bbox.Min.Z], "dimensions": dims,
                     "sourceDimensions": raw_dims, "previewAdjusted": preview_adjusted,
                     "basis": "Rhino 包围盒；零厚度方向仅为网页预览补最小显示尺寸，不作为工程量" if preview_adjusted else "Rhino 包围盒"},
        "material": _material(rhino_object, layer), "quantity": quantity, "quantityRequired": True
    }


def _latest_contains(transmission_id):
    """Confirm whether the bridge accepted this exact transmission.

    Large Rhino models can finish uploading just before the local HTTP response
    reaches the script.  In that case urlopen may report a timeout even though
    the bridge already stored the model.  This check prevents a false failure.
    """
    latest_url = BRIDGE_URL + "/latest"
    try:
        request = urllib.request.Request(latest_url, method="GET")
        with urllib.request.urlopen(request, timeout=15) as response:
            latest = json.loads(response.read().decode("utf-8"))
        source = (latest.get("payload") or {}).get("source") or {}
        return bool(latest.get("available") and source.get("transmissionId") == transmission_id)
    except Exception:
        return False


def _send(payload):
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(BRIDGE_URL, data=data, headers={"Content-Type": "application/json"}, method="POST")
    try:
        # Whole-building models can contain hundreds or thousands of objects.
        # Keep the UI synchronous for this prototype, but allow enough time for
        # the local bridge to read and validate the complete JSON payload.
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except (socket.timeout, TimeoutError):
        transmission_id = (payload.get("source") or {}).get("transmissionId")
        if transmission_id and _latest_contains(transmission_id):
            return {"accepted": True, "objectCount": len(payload.get("objects") or []),
                    "confirmedAfterTimeout": True}
        raise


def run():
    try:
        mode, object_ids, floor = _pick_scope()
        if mode is None:
            return
        if not object_ids:
            rs.MessageBox("这个范围没有可发送的对象。", 48, "发送到 CarbonLoop")
            return
        objects = []
        skipped = 0
        for object_id in object_ids:
            item = _object_payload(object_id, floor)
            if item:
                objects.append(item)
            else:
                skipped += 1
        if not objects:
            rs.MessageBox("没有读取到具有有效三维包围盒的构件。", 48, "发送到 CarbonLoop")
            return
        payload = {
            "schemaVersion": CONTRACT_VERSION,
            "source": {"host": "Rhino", "mode": "live-script", "documentId": sc.doc.Path or sc.doc.Name or "untitled-rhino-model",
                       "unitSystem": _unit_name(), "pluginVersion": SCRIPT_VERSION,
                       "semanticProfileVersion": SEMANTIC_PROFILE_VERSION,
                       "transmissionId": str(uuid.uuid4()),
                       "sentAt": datetime.now(timezone.utc).isoformat()},
            "selection": {"mode": mode, "floor": floor},
            "objects": objects
        }
        result = _send(payload)
        eligible = [item for item in objects if item["analysisEligible"]]
        recognized = len([item for item in eligible if item["typeHint"] != "unknown"])
        excluded = len(objects) - len(eligible)
        message = "已发送 {} 个对象到 CarbonLoop。\n自动识别构件 {} 个；待核对 {} 个；辅助对象 {} 个。".format(
            result.get("objectCount", len(objects)), recognized, len(eligible) - recognized, excluded)
        if skipped:
            message += "\n另有 {} 个对象因无有效三维尺寸而跳过。".format(skipped)
        message += "\n请回到网页核对构件分类和材料。"
        rs.MessageBox(message, 64, "发送成功")
    except urllib.error.URLError:
        rs.MessageBox("无法连接 CarbonLoop 本地接收器。\n请先双击“启动 Rhino 连接.cmd”，再重试。", 16, "连接失败")
    except Exception as error:
        rs.MessageBox("发送失败：{}".format(error), 16, "CarbonLoop")


Rhino.RhinoApp.WriteLine("CarbonLoop：发送入口已启动")
if not _run_native_plugin():
    run()

