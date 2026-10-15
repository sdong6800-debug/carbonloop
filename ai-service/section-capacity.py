"""AS 3600:2018 section-only adapter, using concreteproperties 0.8.0.

Not a slab solver: no punching, shear, deflection, fire, anchorage, load
combinations or whole-model stability checks. No project safety verdict.
Requires explicitly supplied reinforcement and design actions, never infers them.
"""
import json
import math
import sys


def positive(value, name, lower, upper):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not lower <= value <= upper:
        raise ValueError(name + " outside supported calculation range")
    return float(value)


def run(data):
    from concreteproperties import ConcreteSection, add_bar
    from concreteproperties.design_codes import AS3600
    from sectionproperties.pre.library import rectangular_section
    import importlib.metadata

    p = data["sectionInput"]
    if p.get("method") != "rectangular-section-pure-bending" or p.get("reinforcement_tracking") != "fixed-bottom-cover":
        raise ValueError("Explicit section method and reinforcement tracking are required")
    source = p.get("source")
    if not isinstance(source, str) or not source.strip() or len(source) > 500:
        raise ValueError("A structural input source is required")
    width = positive(p.get("strip_width_mm"), "width", 100, 3000)
    fc = positive(p.get("concrete_fc_mpa"), "concrete strength", 20, 65)
    fy = positive(p.get("steel_fy_mpa"), "steel strength", 250, 600)
    cover = positive(p.get("bottom_cover_mm"), "cover", 10, 100)
    bars = p.get("bottom_bars")
    if not isinstance(bars, list) or not 1 <= len(bars) <= 40:
        raise ValueError("Explicit bottom reinforcement bars are required")
    results = []
    for label in ["before", "after"]:
        e = data[label]
        if e.get("type") != "slab" or e.get("material") not in ["concrete", "concrete-cast", "concrete-precast"] or e.get("quantity"):
            raise ValueError("Only solid rectangular concrete slab strips are supported")
        depth = positive(e.get("h"), "depth metres", .06, 1) * 1000
        code = AS3600()
        concrete = code.create_concrete_material(compressive_strength=fc)
        steel = code.create_steel_material(yield_strength=fy)
        geom = rectangular_section(d=depth, b=width, material=concrete)
        positions = []
        for bar in bars:
            dia = positive(bar.get("diameter_mm"), "bar diameter", 6, 40)
            x = positive(bar.get("x_mm"), "bar position", 0, width)
            y = cover + dia / 2
            if x - dia / 2 <= 0 or x + dia / 2 >= width or y + dia / 2 >= depth:
                raise ValueError("Reinforcement does not fit inside the section")
            if any(math.hypot(x-a, y-b) < (dia+d)/2 for a, b, d in positions):
                raise ValueError("Overlapping reinforcement bars")
            positions.append((x, y, dia))
            geom = add_bar(geometry=geom, area=math.pi*dia*dia/4, material=steel, x=x, y=y)
        code.assign_concrete_section(ConcreteSection(geom))
        factored, unfactored, phi = code.ultimate_bending_capacity()
        capacity = float(factored.m_xy / 1e6)
        if not math.isfinite(capacity) or capacity <= 0:
            raise ValueError("Invalid capacity result")
        action = p.get("design_actions", {}).get(label)
        demand = None
        # Demand must be associated with the exact geometry. Old loads do not silently
        # follow a new slab thickness. An engineering model must regenerate them.
        signature = {key: p[key] for key in ["strip_width_mm", "concrete_fc_mpa", "steel_fy_mpa", "bottom_cover_mm", "bottom_bars"]}
        if isinstance(action, dict) and action.get("element_id") == e.get("id") and action.get("section_signature") == signature and action.get("geometry_m") == [e[k] for k in ["x", "y", "z", "l", "w", "h"]] and isinstance(action.get("source"), str) and action["source"].strip():
            demand = positive(action.get("moment_knm_for_strip"), "design moment", 0, 100000)
        results.append({"scheme": label, "depth_mm": depth, "strip_width_mm": width,
                        "capacity_knm": capacity, "unfactored_capacity_knm": float(unfactored.m_xy/1e6),
                        "phi": float(phi), "demand_knm": demand,
                        "utilization": demand/capacity if demand is not None else None,
                        "status": "missing_design_action" if demand is None else "capacity_exceeded" if demand > capacity else "within_bending_capacity_only"})
    return {"status": "calculated", "tool": "concreteproperties", "version": importlib.metadata.version("concreteproperties"),
            "code": "AS 3600:2018", "input_source": source, "can_adopt": False,
            "scope": "Rectangular strip, pure positive bending; bottom normal-ductility reinforcement with fixed bottom cover",
            "results": results, "unchecked": ["shear", "punching", "deflection", "cracking", "detailing", "fire", "load combinations", "supporting members", "global stability", "project code applicability"],
            "reference": "https://concrete-properties.readthedocs.io/en/stable/user_guide/design_codes/as3600.html"}


if __name__ == "__main__":
    try:
        request = json.loads(sys.stdin.read(65536))
        print(json.dumps(run(request), ensure_ascii=True, allow_nan=False))
    except Exception as exc:
        print(json.dumps({"status": "invalid_input_or_calculation", "can_adopt": False, "error": str(exc)[:300]}, ensure_ascii=True))
        sys.exit(1)
