using System.Text.Json;
using System.Text.RegularExpressions;

namespace CarbonLoop.Rhino;

internal sealed class SemanticProfile
{
    private readonly Dictionary<string, string[]> _types;
    private readonly Dictionary<string, string[]> _materials;
    private readonly string[] _excluded;

    private SemanticProfile(string version, Dictionary<string, string[]> types, Dictionary<string, string[]> materials, string[] excluded)
    {
        Version = version;
        _types = types;
        _materials = materials;
        _excluded = excluded;
    }

    public string Version { get; }

    public static SemanticProfile Load(string pluginDirectory)
    {
        var path = Path.Combine(pluginDirectory, "rhino-semantic-profile.json");
        if (!File.Exists(path)) return Defaults();
        try
        {
            using var document = JsonDocument.Parse(File.ReadAllText(path));
            var root = document.RootElement;
            return new SemanticProfile(
                root.GetProperty("version").GetString() ?? "carbonloop.rhino.semantic-profile/0.2.0",
                ReadGroups(root.GetProperty("elementTypes")),
                ReadGroups(root.GetProperty("materials")),
                root.GetProperty("excludeFromCarbonAnalysis").EnumerateArray().Select(item => item.GetString() ?? "").Where(item => item.Length > 0).ToArray()
            );
        }
        catch { return Defaults(); }
    }

    public Inference InferType(string? explicitType, string name, string layer)
    {
        if (!string.IsNullOrWhiteSpace(explicitType) && Find(explicitType, _types) is { } explicitMatch)
            return new Inference(explicitMatch.Category, "CarbonLoop.Type", 1.0, $"Rhino 对象已提供 CarbonLoop.Type={explicitType}。");
        var leaf = layer.Split(new[] { "::" }, StringSplitOptions.None).LastOrDefault() ?? "";
        foreach (var candidate in new[] { (name, "object-name", .96), (leaf, "layer-leaf", .94), (layer, "layer-path", .90) })
        {
            if (Find(candidate.Item1, _types) is { } match)
                return new Inference(match.Category, candidate.Item2, candidate.Item3, $"根据 Rhino 名称或图层中的“{match.Term}”识别。");
        }
        return new Inference("unknown", "unmatched", 0, "名称与图层未命中语义词典，保留待核对。");
    }

    public Inference InferMaterial(string name, string layer)
    {
        if (Find(name, _materials) is { } material)
            return new Inference(material.Category, "material-name", .96, $"根据 Rhino 材料名称中的“{material.Term}”匹配。");
        if (Find(layer, _materials) is { } hint)
            return new Inference(hint.Category, "layer-hint", .78, $"模型未提供可识别材料；根据图层中的“{hint.Term}”提出建议，需人工确认。");
        return new Inference("", "unmatched", 0, "材料名称与图层均未命中材料词典，保留待核对。");
    }

    public (bool Eligible, string Basis) AnalysisEligibility(string layer, string name)
    {
        var normalized = Normalize($"{layer} {name}");
        var term = _excluded.OrderByDescending(item => item.Length).FirstOrDefault(item => normalized.Contains(Normalize(item), StringComparison.Ordinal));
        return term is null
            ? (true, "三维对象默认进入分析范围。")
            : (false, $"图层或名称包含“{term}”，默认作为标注/辅助对象排除，可在 Rhino 中改层后重发。");
    }

    private static Dictionary<string, string[]> ReadGroups(JsonElement element) => element.EnumerateObject().ToDictionary(
        property => property.Name,
        property => property.Value.EnumerateArray().Select(item => item.GetString() ?? "").Where(item => item.Length > 0).ToArray()
    );

    private static Match? Find(string? value, Dictionary<string, string[]> groups)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var normalized = Normalize(value);
        return groups.SelectMany(group => group.Value.Select(term => new Match(group.Key, term)))
            .Where(item => normalized.Contains(Normalize(item.Term), StringComparison.Ordinal))
            .OrderByDescending(item => Normalize(item.Term).Length)
            .FirstOrDefault();
    }

    private static string Normalize(string value) => " " + Regex.Replace(value.ToLowerInvariant(), @"[^0-9a-z\u4e00-\u9fff]+", " ").Trim() + " ";

    private static SemanticProfile Defaults() => new(
        "carbonloop.rhino.semantic-profile/embedded-0.2.0",
        new Dictionary<string, string[]>
        {
            ["finish"] = new[] { "ext finish", "int finish", "floor finish", "finish", "finishes", "饰面层", "饰面" },
            ["slab"] = new[] { "slab", "floor", "deck", "plate", "楼板", "板" },
            ["beam"] = new[] { "beam", "girder", "梁" },
            ["column"] = new[] { "column", "post", "pillar", "柱" },
            ["wall"] = new[] { "wall", "partition", "墙" },
            ["foundation"] = new[] { "foundation", "footing", "pile", "基础", "承台", "桩" },
            ["roof"] = new[] { "roof", "roofing", "屋顶", "屋面" },
            ["glazing"] = new[] { "glazing", "glass", "window", "curtain wall", "玻璃", "窗", "幕墙" },
            ["mullion"] = new[] { "mullion", "window frame", "curtain wall frame", "窗框", "幕墙框" },
            ["door"] = new[] { "door", "门" }, ["stair"] = new[] { "stair", "staircase", "楼梯" }
        },
        new Dictionary<string, string[]>
        {
            ["concrete"] = new[] { "concrete", "混凝土" }, ["concrete-cast"] = new[] { "cast in situ concrete", "cast in place concrete", "现浇混凝土" },
            ["concrete-precast"] = new[] { "precast concrete", "预制混凝土" }, ["rebar"] = new[] { "rebar", "reinforcing steel", "钢筋" },
            ["steel-section"] = new[] { "structural steel", "steel section", "型钢", "结构钢" }, ["timber-solid"] = new[] { "solid timber", "sawn timber", "timber", "wood", "lumber", "实木", "锯材", "木材" },
            ["timber-glulam"] = new[] { "glulam timber", "glulam", "glue laminated timber", "glued laminated timber", "胶合木" }, ["timber-clt"] = new[] { "clt timber", "timber clt", "clt", "cross laminated timber", "交叉层压木" },
            ["masonry-clay"] = new[] { "clay brick", "brick", "砖" }, ["glass"] = new[] { "glass", "glazing", "玻璃" },
            ["aluminium"] = new[] { "aluminium", "aluminum", "铝" }, ["insulation"] = new[] { "insulation", "保温" },
            ["gypsum"] = new[] { "gypsum", "gypsum board", "plasterboard", "plaster board", "plaster", "石膏板", "石膏抹灰", "石膏" },
            ["finish"] = new[] { "finish", "paint", "coating", "tile", "ceramic tile", "terrazzo", "flooring", "carpet", "vinyl", "render", "cladding", "plastic", "饰面", "涂料", "瓷砖", "水磨石", "地板", "地毯", "抹灰", "覆层", "塑料" }
        },
        new[] { "annotation", "dimension", "dims", "text", "notes", "grid", "axis", "camera", "light", "标注", "尺寸", "轴网" }
    );

    private sealed record Match(string Category, string Term);
}

internal sealed record Inference(string Value, string Source, double Confidence, string Basis);
