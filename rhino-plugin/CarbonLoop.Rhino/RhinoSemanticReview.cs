using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Rhino;
using Rhino.DocObjects;

namespace CarbonLoop.Rhino;

internal static class RhinoSemanticReview
{
    public const string StampKey = "CarbonLoop.ReviewSource";
    public const string MaterialCategoryKey = "CarbonLoop.MaterialCategory";

    public static SemanticProfile Profile() => SemanticProfile.Load(
        Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location) ?? AppContext.BaseDirectory);

    public static SourceMaterial ReadNativeMaterial(RhinoDoc doc, RhinoObject item)
    {
        var attributes = item.Attributes;
        var index = attributes.MaterialSource == ObjectMaterialSource.MaterialFromLayer && attributes.LayerIndex >= 0
            ? doc.Layers[attributes.LayerIndex]?.RenderMaterialIndex ?? -1 : attributes.MaterialIndex;
        string? name = null;
        try { name = item.GetRenderMaterial(true)?.Name; } catch { }
        if (string.IsNullOrWhiteSpace(name) && index >= 0) name = doc.Materials[index]?.Name;
        return new SourceMaterial(name ?? "", index, attributes.MaterialSource.ToString());
    }

    public static string LayerPath(RhinoDoc doc, RhinoObject item) => item.Attributes.LayerIndex >= 0
        ? doc.Layers[item.Attributes.LayerIndex]?.FullPath ?? "" : "";

    public static string Stamp(RhinoDoc doc, RhinoObject item)
    {
        var native = ReadNativeMaterial(doc, item);
        var a = item.Attributes;
        var fields = JsonSerializer.Serialize(new { objectName = a.Name ?? "", layer = LayerPath(doc, item),
            a.LayerIndex, material = native.Name, native.Index, native.Origin,
            type = a.GetUserString("CarbonLoop.Type"), materialOverride = a.GetUserString("CarbonLoop.Material"),
            category = a.GetUserString(MaterialCategoryKey), grade = a.GetUserString("CarbonLoop.Grade") });
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(fields)));
    }

    public static bool IsCurrent(RhinoDoc doc, RhinoObject item) =>
        item.Attributes.GetUserString(StampKey) == Stamp(doc, item);

    public static bool NeedsReview(RhinoDoc doc, RhinoObject item, SemanticProfile profile)
    {
        if (item.IsDeleted || item.Geometry is null || !item.Geometry.GetBoundingBox(true).IsValid) return false;
        if (!profile.AnalysisEligibility(LayerPath(doc, item), item.Attributes.Name ?? "").Eligible) return false;
        return !IsCurrent(doc, item);
    }

    public static List<ReviewGroup> Groups(RhinoDoc doc, IReadOnlyList<RhinoObject> objects, SemanticProfile profile)
    {
        var result = new List<ReviewGroup>();
        var byKey = new Dictionary<string, ReviewGroup>();
        foreach (var item in objects.Where(item => !item.IsDeleted && item.Geometry is not null
            && item.Geometry.GetBoundingBox(true).IsValid
            && profile.AnalysisEligibility(LayerPath(doc, item), item.Attributes.Name ?? "").Eligible))
        {
            var layer = LayerPath(doc, item);
            var native = ReadNativeMaterial(doc, item);
            var wasReviewed = !string.IsNullOrEmpty(item.Attributes.GetUserString(StampKey));
            var current = IsCurrent(doc, item);
            // Ignore CarbonLoop overrides after their source changes; a fresh
            // native material must not inherit the last model's confirmation.
            var materialName = wasReviewed && !current ? native.Name : item.Attributes.GetUserString("CarbonLoop.Material") ?? native.Name;
            var explicitType = wasReviewed && !current ? null : item.Attributes.GetUserString("CarbonLoop.Type");
            var confirmedMaterial = current ? item.Attributes.GetUserString(MaterialCategoryKey) : null;
            var name = item.Attributes.Name ?? "";
            var type = profile.InferType(explicitType, name, layer);
            var typeHint = profile.SuggestType(name, layer);
            // Leaf/object exact matches have precedence over parent layers.
            var typeValue = current && explicitType == "unknown" ? "unknown" : type.Source == "CarbonLoop.Type" ? type.Value
                : typeHint.Ambiguous ? "unknown" : type.Value != "unknown" ? type.Value : typeHint.Category;
            var material = profile.SuggestMaterial(materialName);
            var reviewMaterial = profile.SuggestReviewMaterial(materialName, layer);
            var materialValue = reviewMaterial.Category;
            if (confirmedMaterial is not null && profile.IsMaterial(confirmedMaterial)) materialValue = confirmedMaterial;
            var key = JsonSerializer.Serialize(new { layer, typeValue, materialName, explicitType, confirmedMaterial, current,
                native.Index, native.Origin, typeHint.IsTypo, typeHint.Ambiguous,
                typoBasis = typeHint.IsTypo ? typeHint.Basis : "" });
            if (byKey.TryGetValue(key, out var existing)) { existing.Ids.Add(item.Id); continue; }
            var information = string.Join(" ", new[] {
                typeHint.IsTypo || typeHint.Ambiguous || type.Value == "unknown" ? typeHint.Basis : type.Basis,
                material.Basis,
                material.Category == "unknown" && !material.Ambiguous ? reviewMaterial.Basis : "",
                material.Category == "unknown" && materialValue != "unknown" ? "材料类别来自图层提示，必须核对。" : "",
                current ? "Rhino 中已确认，来源未变化。" : wasReviewed ? "来源已变化，上次确认已失效。" : "" }.Where(text => text.Length > 0));
            var correctedMaterial = reviewMaterial.IsTypo && !reviewMaterial.Ambiguous
                ? reviewMaterial.CorrectedText : materialName;
            var group = new ReviewGroup(item.Id, item.Attributes.LayerIndex, layer, name, native.Name, materialName,
                typeValue, materialValue, information,
                typeValue != "unknown" && type.Value != "unknown" && !typeHint.IsTypo && !typeHint.Ambiguous
                    && material.Category != "unknown" && !material.IsTypo && !material.Ambiguous,
                correctedMaterial,
                typeHint.IsTypo && typeHint.OriginalWord.Length > 0
                    ? System.Text.RegularExpressions.Regex.Replace(layer.Split(new[] { "::" }, StringSplitOptions.None).Last(),
                        $"(?i)(?<![a-z]){System.Text.RegularExpressions.Regex.Escape(typeHint.OriginalWord)}(?![a-z])", typeHint.Term) : "", current);
            result.Add(group);
            byKey.Add(key, group);
        }
        return result;
    }
}

internal sealed record SourceMaterial(string Name, int Index, string Origin);

internal sealed class ReviewGroup
{
    public ReviewGroup(Guid id, int layerIndex, string layer, string name, string nativeMaterial, string sourceMaterial,
        string type, string material, string basis, bool exact, string correctedMaterial, string correctedLayer, bool current)
    {
        Ids.Add(id); LayerIndex = layerIndex; Layer = layer; Name = name; NativeMaterial = nativeMaterial;
        SourceMaterial = sourceMaterial; Type = type; Material = material; Basis = basis;
        Exact = exact; CorrectedMaterial = correctedMaterial; CorrectedLayer = correctedLayer; Current = current;
    }
    public List<Guid> Ids { get; } = new();
    public int LayerIndex { get; }
    public string Layer { get; }
    public string Name { get; }
    public string NativeMaterial { get; }
    public string SourceMaterial { get; }
    public string Type { get; }
    public string Material { get; }
    public string Basis { get; }
    public bool Exact { get; }
    public string CorrectedMaterial { get; }
    public string CorrectedLayer { get; }
    public bool Current { get; }
}
