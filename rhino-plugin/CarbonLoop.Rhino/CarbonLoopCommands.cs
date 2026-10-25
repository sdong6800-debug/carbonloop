using System.Runtime.InteropServices;
using Rhino;
using Rhino.Commands;
using Rhino.DocObjects;
using Rhino.Input;
using Rhino.Input.Custom;

namespace CarbonLoop.Rhino;

[Guid("fe01af28-5843-4ef3-8e58-bbd9863136ec")]
public sealed class CarbonLoopCommand : Command
{
    public override string EnglishName => "CarbonLoop";

    protected override Result RunCommand(RhinoDoc doc, RunMode mode)
    {
        var plugin = CarbonLoopPlugin.Instance;
        var message = "CarbonLoop 插件尚未加载。";
        if (plugin is null || !plugin.OpenWorkbench(out message))
        {
            RhinoApp.WriteLine($"CarbonLoop：{message}");
            return Result.Failure;
        }
        RhinoApp.WriteLine(message);
        return Result.Success;
    }
}

[Guid("ddf18370-1a76-40fa-b73d-d9b5be3f141f")]
public sealed class CarbonLoopSendCommand : Command
{
    public override string EnglishName => "CarbonLoopSend";

    protected override Result RunCommand(RhinoDoc doc, RunMode mode)
    {
        var plugin = CarbonLoopPlugin.Instance;
        if (plugin is null) return Result.Failure;
        using var syncPause = plugin.SuspendSynchronizationForReview();
        var picked = PickObjects(doc);
        if (picked.Cancelled)
            return Result.Cancel;
        if (picked.Objects.Count == 0)
        {
            RhinoApp.WriteLine("CarbonLoop：所选范围内没有可发送的对象。");
            return Result.Nothing;
        }

        try
        {
            if (!SemanticReviewDialog.Confirm(doc, picked.Objects))
            {
                RhinoApp.WriteLine("CarbonLoop：已关闭核验，本次没有发送模型。");
                return Result.Cancel;
            }
            var objects = picked.Objects.Select(item => doc.Objects.FindId(item.Id))
                .Where(item => item is not null && !item.IsDeleted).Cast<RhinoObject>().ToList();
            var floor = picked.Mode == "floor" && objects.Count > 0 ? RhinoSemanticReview.LayerPath(doc, objects[0]) : picked.Floor;
            var exporter = new RhinoModelExporter(doc);
            var export = exporter.Export(objects, picked.Mode, floor);
            if (export.IncludedCount == 0)
            {
                RhinoApp.WriteLine("CarbonLoop：没有读取到可分析或可核对的模型对象。");
                return Result.Nothing;
            }

            var published = plugin.Publish(export.Json);
            if (!published.Success)
            {
                RhinoApp.WriteLine($"CarbonLoop 核验已保存到 Rhino，但发送失败：{published.Message} 请重新运行 CarbonLoopSend。");
                return Result.Failure;
            }

            plugin.RememberSyncScope(doc, picked.Mode, floor, objects);

            RhinoApp.WriteLine(
                $"CarbonLoop：{published.Message} 构件类型明确 {export.RecognizedCount} 个，待核对 {export.UnknownCount} 个，辅助对象 {export.ExcludedCount} 个。几何变化自动同步；图层、名称或材料变化后需在 Rhino 重新确认。"
            );
            plugin.OpenWorkbench(out _, published.Revision);
            return Result.Success;
        }
        catch (Exception exception)
        {
            RhinoApp.WriteLine($"CarbonLoop 发送失败：{exception.Message}");
            return Result.Failure;
        }
    }

    private static PickResult PickObjects(RhinoDoc doc)
    {
        var selected = doc.Objects.GetSelectedObjects(false, false).ToList();
        if (selected.Count > 0)
            return new PickResult(false, "selection", null, selected);

        using var option = new GetOption();
        option.SetCommandPrompt("未预选构件：选择本次 CarbonLoop 分析范围");
        option.AddOption("SelectObjects");
        option.AddOption("CurrentLayer");
        option.AddOption("EntireModel");
        option.AcceptNothing(true);
        var result = option.Get();
        if (result == GetResult.Cancel)
            return PickResult.Cancel();

        var selectedOption = result == GetResult.Nothing ? "SelectObjects" : option.Option().EnglishName;
        if (selectedOption == "SelectObjects")
        {
            var getObjects = new GetObject();
            getObjects.SetCommandPrompt("选择要发送到 CarbonLoop 的构件");
            getObjects.GeometryFilter = ObjectType.AnyObject;
            getObjects.EnablePreSelect(true, true);
            getObjects.GetMultiple(1, 0);
            if (getObjects.CommandResult() != Result.Success)
                return PickResult.Cancel();
            return new PickResult(false, "selection", null, getObjects.Objects().Select(reference => reference.Object()).Where(item => item is not null).Cast<RhinoObject>().ToList());
        }

        if (selectedOption == "CurrentLayer")
        {
            var layerIndex = doc.Layers.CurrentLayerIndex;
            var layer = doc.Layers[layerIndex];
            var objects = doc.Objects.GetObjectList(ObjectType.AnyObject).Where(item => item.Attributes.LayerIndex == layerIndex).ToList();
            return new PickResult(false, "floor", layer?.FullPath, objects);
        }

        return new PickResult(false, "all", null, doc.Objects.GetObjectList(ObjectType.AnyObject).ToList());
    }

    private sealed record PickResult(bool Cancelled, string Mode, string? Floor, IReadOnlyList<RhinoObject> Objects)
    {
        public static PickResult Cancel() => new(true, "cancel", null, Array.Empty<RhinoObject>());
    }
}
