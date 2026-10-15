using System.Reflection;
using System.Text.Json;
using Rhino;
using Rhino.DocObjects;
using Rhino.Geometry;

namespace CarbonLoop.Rhino;

internal sealed class RhinoModelExporter
{
    private const string ContractVersion = "carbonloop.rhino.intake/1.0.0";
    private const string PluginVersion = "carbonloop-rhino-plugin/0.2.1";
    private readonly RhinoDoc _doc;
    private readonly SemanticProfile _profile;
    private readonly string _unitName;
    private readonly double _previewMinimum;

    public RhinoModelExporter(RhinoDoc doc)
    {
        _doc = doc;
        var pluginDirectory = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location) ?? AppContext.BaseDirectory;
        _profile = SemanticProfile.Load(pluginDirectory);
        _unitName = doc.ModelUnitSystem.ToString();
        _previewMinimum = _unitName switch { "Meters" => .02, "Millimeters" => 20, "Centimeters" => 2, _ => 0 };
        if (_previewMinimum == 0)
            throw new InvalidOperationException($"CarbonLoop 当前只支持 m、mm、cm；当前 Rhino 单位为 {_unitName}。");
    }

    public ExportResult Export(IReadOnlyList<RhinoObject> sourceObjects, string mode, string? floor, string syncMode = "manual", string syncReason = "用户发送")
    {
        var objects = new List<Dictionary<string, object?>>();
        var recognized = 0;
        var unknown = 0;
        var excluded = 0;
        foreach (var rhinoObject in sourceObjects)
        {
            var item = ExportObject(rhinoObject, floor);
            if (item is null) continue;
            objects.Add(item.Payload);
            if (!item.Eligible) excluded++;
            else if (item.Recognized) recognized++;
            else unknown++;
        }

        var payload = new Dictionary<string, object?>
        {
            ["schemaVersion"] = ContractVersion,
            ["source"] = new Dictionary<string, object?>
            {
                ["host"] = "Rhino", ["mode"] = "installed-plugin",
                // Unsaved Rhino documents often share the same visible name
                // (for example "Untitled"). Include the runtime serial number
                // so a newly-created model cannot inherit the previous model's
                // review state in the browser.
                ["documentId"] = string.IsNullOrWhiteSpace(_doc.Path)
                    ? $"rhino-session:{_doc.RuntimeSerialNumber}:{_doc.Name ?? "untitled-rhino-model"}"
                    : _doc.Path,
                ["unitSystem"] = _unitName, ["pluginVersion"] = PluginVersion,
                ["semanticProfileVersion"] = _profile.Version, ["transmissionId"] = Guid.NewGuid().ToString(),
                ["sentAt"] = DateTimeOffset.UtcNow.ToString("O"), ["syncMode"] = syncMode, ["syncReason"] = syncReason
            },
            ["selection"] = new Dictionary<string, object?> { ["mode"] = mode, ["floor"] = floor },
            ["objects"] = objects
        };
        return new ExportResult(JsonSerializer.Serialize(payload), objects.Count, recognized, unknown, excluded);
    }

    private ExportedObject? ExportObject(RhinoObject rhinoObject, string? scopeFloor)
    {
        var geometry = rhinoObject.Geometry;
        if (geometry is null) return null;
        var boundingBox = geometry.GetBoundingBox(true);
        if (!boundingBox.IsValid) return null;
        var raw = new[] { boundingBox.Max.X - boundingBox.Min.X, boundingBox.Max.Y - boundingBox.Min.Y, boundingBox.Max.Z - boundingBox.Min.Z };
        if (raw.Max() <= 0) return null;
        var dimensions = raw.Select(value => Math.Max(value, _previewMinimum)).ToArray();
        var previewAdjusted = raw.Any(value => value <= 0);
        var attributes = rhinoObject.Attributes;
        var layer = attributes.LayerIndex >= 0 ? _doc.Layers[attributes.LayerIndex]?.FullPath ?? "" : "";
        var name = string.IsNullOrWhiteSpace(attributes.Name) ? layer.Split(new[] { "::" }, StringSplitOptions.None).LastOrDefault() ?? rhinoObject.Id.ToString()[..8] : attributes.Name;
        var type = _profile.InferType(attributes.GetUserString("CarbonLoop.Type"), name, layer);
        var eligibility = _profile.AnalysisEligibility(layer, name);
        var itemFloor = attributes.GetUserString("CarbonLoop.Floor") ?? scopeFloor ?? layer.Split(new[] { "::" }, StringSplitOptions.None).FirstOrDefault();
        var volume = ReadVolume(geometry);
        var material = ReadMaterial(rhinoObject, layer);

        var payload = new Dictionary<string, object?>
        {
            ["id"] = rhinoObject.Id.ToString(), ["name"] = name, ["typeHint"] = type.Value,
            ["typeInference"] = new { source = type.Source, confidence = type.Confidence, basis = type.Basis },
            ["analysisEligible"] = eligibility.Eligible, ["eligibilityBasis"] = eligibility.Basis,
            ["floor"] = itemFloor, ["layer"] = layer,
            ["geometry"] = new Dictionary<string, object?>
            {
                ["kind"] = "box", ["origin"] = new[] { boundingBox.Min.X, boundingBox.Min.Y, boundingBox.Min.Z },
                ["dimensions"] = dimensions, ["sourceDimensions"] = raw, ["previewAdjusted"] = previewAdjusted,
                ["basis"] = previewAdjusted ? "Rhino 包围盒；零厚度方向仅为网页预览补最小显示尺寸，不作为工程量" : "Rhino 包围盒"
            },
            ["material"] = material,
            ["quantity"] = volume.HasValue ? new { kind = "net-volume", value = volume.Value, basis = "Rhino 封闭几何 VolumeMassProperties 净体积" } : null,
            ["quantityRequired"] = true
        };
        return new ExportedObject(payload, eligibility.Eligible, type.Value != "unknown");
    }

    private object? ReadMaterial(RhinoObject rhinoObject, string layer)
    {
        var attributes = rhinoObject.Attributes;
        var explicitMaterial = attributes.GetUserString("CarbonLoop.Material");
        var grade = attributes.GetUserString("CarbonLoop.Grade") ?? "";
        var materialName = explicitMaterial;
        if (string.IsNullOrWhiteSpace(materialName))
        {
            try { materialName = rhinoObject.GetRenderMaterial(true)?.Name; } catch { }
        }
        if (string.IsNullOrWhiteSpace(materialName) && attributes.MaterialIndex >= 0)
            materialName = _doc.Materials[attributes.MaterialIndex]?.Name;
        var inference = _profile.InferMaterial(materialName ?? "", layer);
        if (string.IsNullOrWhiteSpace(materialName) && string.IsNullOrWhiteSpace(inference.Value)) return null;
        materialName = string.IsNullOrWhiteSpace(materialName) ? $"图层建议：{layer.Split(new[] { "::" }, StringSplitOptions.None).LastOrDefault()}" : materialName;
        return new Dictionary<string, object?>
        {
            ["id"] = attributes.MaterialIndex >= 0 ? attributes.MaterialIndex.ToString() : materialName,
            ["name"] = materialName, ["productType"] = inference.Value, ["grade"] = grade,
            ["origin"] = string.IsNullOrWhiteSpace(explicitMaterial) ? $"Rhino {attributes.MaterialSource} 材质（支持对象或图层继承）" : "CarbonLoop.Material 对象属性",
            ["inference"] = new { source = inference.Source, confidence = inference.Confidence, basis = inference.Basis }
        };
    }

    private static double? ReadVolume(GeometryBase geometry)
    {
        try
        {
            using var properties = geometry switch
            {
                Brep brep => VolumeMassProperties.Compute(brep),
                Mesh mesh => VolumeMassProperties.Compute(mesh),
                Extrusion extrusion => VolumeMassProperties.Compute(extrusion.ToBrep()),
                _ => null
            };
            return properties is not null && properties.Volume > 0 ? properties.Volume : null;
        }
        catch { return null; }
    }

    private sealed record ExportedObject(Dictionary<string, object?> Payload, bool Eligible, bool Recognized);
}

internal sealed record ExportResult(string Json, int IncludedCount, int RecognizedCount, int UnknownCount, int ExcludedCount);
