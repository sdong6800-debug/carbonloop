using System.Reflection;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Windows.Forms;
using Rhino;
using Rhino.DocObjects;
using Rhino.Geometry;
using Rhino.Runtime.InProcess;

namespace CarbonLoop.Rhino;

internal static class Program
{
    private static int _passed;
    [STAThread]
    private static int Main(string[] args)
    {
        Console.WriteLine("Starting isolated Rhino review checks...");
        var system = @"C:\Program Files\Rhino 8\System";
        System.Environment.SetEnvironmentVariable("PATH", system + ";" + System.Environment.GetEnvironmentVariable("PATH"));
        NativeLibrary.SetDllImportResolver(typeof(RhinoDoc).Assembly, (name, assembly, paths) =>
        {
            var file = Path.Combine(system, name.EndsWith(".dll", StringComparison.OrdinalIgnoreCase) ? name : name + ".dll");
            return File.Exists(file) ? NativeLibrary.Load(file) : IntPtr.Zero;
        });
        try { return Run(args); }
        catch (Exception exception) { Console.Error.WriteLine(exception); return 1; }
    }

    private static void Check(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
        Console.WriteLine("PASS " + message); _passed++;
    }

    private static int Run(string[] args)
    {
        using var core = new RhinoCore(new[] { "/nosplash", "/notemplate" }, WindowStyle.NoWindow);
        using var doc = RhinoDoc.CreateHeadless(null);
        doc.ModelUnitSystem = UnitSystem.Meters;
        var materialIndex = doc.Materials.Add(new Material { Name = "timbre" });
        var layerIndex = doc.Layers.Add(new Layer { Name = "slaab", RenderMaterialIndex = materialIndex });
        var attributes = new ObjectAttributes { LayerIndex = layerIndex, MaterialSource = ObjectMaterialSource.MaterialFromLayer };
        var id = doc.Objects.AddBrep(new BoundingBox(0, 0, 0, 6, 4, .2).ToBrep(), attributes);
        var id2 = doc.Objects.AddBrep(new BoundingBox(8, 0, 0, 14, 4, .2).ToBrep(), attributes);
        RhinoObject Item() => doc.Objects.FindId(id)!;
        var profile = SemanticProfile.Load(args[0]);
        Check(RhinoSemanticReview.NeedsReview(doc, Item(), profile), "新对象必须先核验");
        var groups = RhinoSemanticReview.Groups(doc, new[] { Item(), doc.Objects.FindId(id2)! }, profile);
        Check(groups.Count == 1 && groups[0].Ids.Count == 2, "同来源对象按组核验");
        Check(groups[0].Type == "slab" && groups[0].Material == "timber-solid" && !groups[0].Exact, "拼错图层与继承材质给出待确认建议");
        using (var cancel = new SemanticReviewDialog(doc, new[] { Item() }, profile)) { cancel.Close(); }
        Check(Item().Attributes.GetUserString(RhinoSemanticReview.StampKey) is null, "取消不写入确认属性");
        using (var dialog = new SemanticReviewDialog(doc, new[] { Item(), doc.Objects.FindId(id2)! }, profile))
        {
            var grid = (DataGridView)typeof(SemanticReviewDialog).GetField("_grid", BindingFlags.NonPublic | BindingFlags.Instance)!.GetValue(dialog)!;
            Check(grid.Rows[0].Cells["approved"].Value is false, "拼写建议默认未确认");
            typeof(SemanticReviewDialog).GetMethod("Save", BindingFlags.NonPublic | BindingFlags.Instance)!.Invoke(dialog, null);
            Check(Item().Attributes.GetUserString(RhinoSemanticReview.StampKey) is null, "未勾选不能保存或发送");
            grid.Rows[0].Cells["materialName"].Value = "timber";
            grid.Rows[0].Cells["approved"].Value = true;
            typeof(SemanticReviewDialog).GetMethod("Save", BindingFlags.NonPublic | BindingFlags.Instance)!.Invoke(dialog, null);
            Check(dialog.DialogResult == DialogResult.OK, "用户确认后保存成功");
        }
        Check(RhinoSemanticReview.IsCurrent(doc, Item()) && RhinoSemanticReview.IsCurrent(doc, doc.Objects.FindId(id2)!), "分组全部对象获得独立确认记录");
        Check(doc.Materials[materialIndex].Name == "timbre", "碳分析更名保留原共享渲染材质");
        using (var payload = JsonDocument.Parse(new RhinoModelExporter(doc).Export(new[] { Item() }, "selection", null).Json))
        {
            var item = payload.RootElement.GetProperty("objects")[0];
            Check(item.GetProperty("typeHint").GetString() == "slab", "确认后导出楼板类型");
            var material = item.GetProperty("material");
            Check(material.GetProperty("name").GetString() == "timber" && material.GetProperty("originalName").GetString() == "timbre", "纠正名称与原始依据同时保留");
            Check(material.GetProperty("review").GetProperty("confirmed").GetBoolean(), "导出可验证的确认状态");
            Check(Math.Abs(item.GetProperty("quantity").GetProperty("value").GetDouble() - 4.8) < 1e-8, "净体积保持 4.8 立方米");
        }
        doc.Objects.Replace(id, new BoundingBox(0, 0, 0, 6, 4, .3).ToBrep());
        Check(RhinoSemanticReview.IsCurrent(doc, Item()), "仅几何变化保留语义确认");
        doc.Materials.Modify(new Material { Name = "Glass" }, materialIndex, true);
        Check(RhinoSemanticReview.NeedsReview(doc, Item(), profile), "原始材质变化使确认失效");
        using (var payload = JsonDocument.Parse(new RhinoModelExporter(doc).Export(new[] { Item() }, "selection", null).Json))
            Check(payload.RootElement.GetProperty("objects")[0].GetProperty("material").GetProperty("productType").GetString() == "glass", "失效后不沿用旧 timber 覆盖 Glass");
        using (var dialog = new SemanticReviewDialog(doc, new[] { Item() }, profile))
        {
            var grid = (DataGridView)typeof(SemanticReviewDialog).GetField("_grid", BindingFlags.NonPublic | BindingFlags.Instance)!.GetValue(dialog)!;
            grid.Rows[0].Cells["rename"].Value = "slab";
            grid.Rows[0].Cells["approved"].Value = true;
            typeof(SemanticReviewDialog).GetMethod("Save", BindingFlags.NonPublic | BindingFlags.Instance)!.Invoke(dialog, null);
            Check(doc.Layers[layerIndex].Name == "slaab", "未允许图层全局修改时不改名");
            var allow = (CheckBox)typeof(SemanticReviewDialog).GetField("_allowLayerRename", BindingFlags.NonPublic | BindingFlags.Instance)!.GetValue(dialog)!;
            allow.Checked = true;
            typeof(SemanticReviewDialog).GetMethod("Save", BindingFlags.NonPublic | BindingFlags.Instance)!.Invoke(dialog, null);
            Check(doc.Layers[layerIndex].Name == "slab" && dialog.DialogResult == DialogResult.OK, "明确允许后才修改 Rhino 图层名");
        }
        Check(!RhinoSemanticReview.IsCurrent(doc, doc.Objects.FindId(id2)!), "同层范围外对象来源变化后需重新核验");
        Console.WriteLine($"PASS {_passed} native Rhino review checks. Synthetic headless document only.");
        return 0;
    }
}
