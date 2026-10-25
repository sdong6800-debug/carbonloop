using CarbonLoop.Rhino;

var directory = args.Length > 0 ? args[0] : Path.GetFullPath("integration/rhino");
var profile = SemanticProfile.Load(directory);
var passed = 0;
void Check(bool condition, string description)
{
    if (!condition) throw new InvalidOperationException(description);
    passed++; Console.WriteLine("PASS " + description);
}
foreach (var alias in new[] { "wood", "WOOD", "timber", "lumber", "实木" })
    Check(profile.SuggestMaterial(alias) is { Category: "timber-solid", IsTypo: false, Ambiguous: false }, "木材别名 " + alias);
foreach (var text in new[] { "CLT timber panel", "Glulam timber GL28" })
    Check(profile.SuggestMaterial(text).Category != "timber-solid", "具体木产品不降级 " + text);
Check(profile.SuggestMaterial("timbre") is { Category: "timber-solid", IsTypo: true }, "相邻字母颠倒只提出建议");
Check(profile.SuggestMaterial("timer") is { Category: "timber-solid", Term: "timber", IsTypo: true }, "图层名 timer 可建议 timber");
Check(profile.SuggestMaterial("wod") is { Category: "timber-solid", IsTypo: true }, "缺字拼写建议");
Check(profile.SuggestMaterial("conrete") is { Category: "concrete", IsTypo: true }, "混凝土拼写建议");
Check(profile.SuggestType("", "Building::slaab") is { Category: "slab", IsTypo: true }, "图层 slab 拼写建议");
Check(profile.SuggestType("", "Building::colum") is { Category: "column", IsTypo: true }, "图层 column 拼写建议");
Check(profile.InferType(null, "", "Building::slaab").Value == "unknown", "导出识别不自动采用拼写建议");
Check(profile.InferMaterial("timbre", "").Value == "", "材料识别不自动采用拼写建议");
Check(profile.SuggestMaterial("wood effect tile") is { Category: "unknown", Ambiguous: true }, "仿木瓷砖不静默识别为实木");
Check(profile.SuggestMaterial("Material 007").Category == "unknown", "任意材质名保持未知");
Check(profile.SuggestMaterial("glass concrete").Ambiguous, "两种材料冲突");
Check(profile.SuggestMaterial("steel").Category == "unknown", "不同钢产品不凭短词自动决定");
Check(profile.SuggestMaterial("precast concrete").Category == "concrete-precast", "混凝土具体品类保留");
Check(profile.SuggestType("", "楼板").Category == "slab", "中文图层");
Check(!profile.AnalysisEligibility("notes", "").Eligible, "辅助图层排除");
Check(SemanticProfile.EditDistance("timbre", "timber") == 1, "换位距离");
Check(profile.SuggestReviewMaterial("Default Material", "timer") is
    { Category: "timber-solid", CorrectedText: "timber", IsTypo: true, Ambiguous: false },
    "默认材质从图层获得可填入的 timber 候选");
Check(profile.SuggestReviewMaterial("Glass", "timer") is
    { Category: "glass", CorrectedText: "", IsTypo: false },
    "图层错拼不得覆盖已识别的玻璃材质");
Check(profile.SuggestReviewMaterial("wood effect tile", "timer") is
    { Category: "unknown", CorrectedText: "", Ambiguous: true },
    "图层候选不得替原材质的歧义做决定");
Check(profile.SuggestReviewMaterial("timbre", "Glass") is
    { Category: "timber-solid", CorrectedText: "timber", IsTypo: true },
    "材料自身的纠错优先于图层提示");
Check(profile.SuggestReviewMaterial("*2 [imported]", "Layer0") is
    { Category: "unknown", CorrectedText: "" },
    "无语义的导入名称保持未确定");
Console.WriteLine($"PASS {passed} semantic checks; profile {profile.Version}; no API calls.");
