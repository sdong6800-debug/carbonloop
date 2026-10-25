using Rhino;
using Rhino.DocObjects;
using Rhino.DocObjects.Tables;

namespace CarbonLoop.Rhino;

/// <summary>
/// Keeps the last intentionally-sent Rhino scope synchronized with CarbonLoop.
/// A manual CarbonLoopSend establishes consent and scope; later object, layer and
/// material edits are re-exported after a short debounce without reopening the browser.
/// </summary>
internal sealed class RhinoModelSyncCoordinator : IDisposable
{
    private readonly CarbonLoopPlugin _plugin;
    private readonly object _gate = new();
    private readonly System.Threading.Timer _timer;
    private SyncScope? _scope;
    private string _pendingReason = "模型已修改";
    private bool _publishing;
    private bool _disposed;
    private int _reviewDepth;
    private long _generation;

    public RhinoModelSyncCoordinator(CarbonLoopPlugin plugin)
    {
        _plugin = plugin;
        _timer = new System.Threading.Timer(_ => Flush(), null, Timeout.Infinite, Timeout.Infinite);
    }

    public void Start()
    {
        RhinoDoc.AddRhinoObject += OnObjectChanged;
        RhinoDoc.DeleteRhinoObject += OnObjectChanged;
        RhinoDoc.UndeleteRhinoObject += OnObjectChanged;
        RhinoDoc.ReplaceRhinoObject += OnObjectReplaced;
        RhinoDoc.ModifyObjectAttributes += OnAttributesChanged;
        RhinoDoc.LayerTableEvent += OnLayerChanged;
        RhinoDoc.MaterialTableEvent += OnMaterialChanged;
        RhinoDoc.RenderMaterialsTableEvent += OnRenderMaterialChanged;
    }

    public void Remember(RhinoDoc doc, string mode, string? floor, IReadOnlyList<RhinoObject> objects)
    {
        lock (_gate)
        {
            _generation++;
            _scope = new SyncScope(
                doc.RuntimeSerialNumber,
                mode,
                floor,
                objects.Select(item => item.Id).ToArray(),
                mode == "floor" && objects.Count > 0 ? doc.Layers[objects[0].Attributes.LayerIndex]?.Id : null
            );
        }
    }

    public IDisposable PauseForReview()
    {
        lock (_gate) { _reviewDepth++; _generation++; _timer.Change(Timeout.Infinite, Timeout.Infinite); }
        return new ReviewPause(this);
    }

    private sealed class ReviewPause : IDisposable
    {
        private RhinoModelSyncCoordinator? _owner;
        public ReviewPause(RhinoModelSyncCoordinator owner) => _owner = owner;
        public void Dispose()
        {
            var owner = Interlocked.Exchange(ref _owner, null);
            if (owner is null) return;
            lock (owner._gate) { owner._reviewDepth--; }
        }
    }

    private void OnObjectChanged(object? sender, RhinoObjectEventArgs e) => Schedule(e.TheObject?.Document, "构件已新增、删除或恢复");
    private void OnObjectReplaced(object? sender, RhinoReplaceObjectEventArgs e) => Schedule(e.Document, "构件几何已修改");
    private void OnAttributesChanged(object? sender, RhinoModifyObjectAttributesEventArgs e) => Schedule(e.Document, "构件图层、名称或材质已修改");
    private void OnLayerChanged(object? sender, LayerTableEventArgs e) => Schedule(e.Document, "图层结构或名称已修改");
    private void OnMaterialChanged(object? sender, MaterialTableEventArgs e) => Schedule(e.Document, "Rhino 材质已修改");
    private void OnRenderMaterialChanged(object? sender, RhinoDoc.RenderContentTableEventArgs e) => Schedule(e.Document, "渲染材质已修改");

    private void Schedule(RhinoDoc? doc, string reason)
    {
        if (doc is null) return;
        lock (_gate)
        {
            if (_disposed || _publishing || _reviewDepth > 0 || _scope is null || _scope.DocumentSerialNumber != doc.RuntimeSerialNumber)
                return;
            _pendingReason = reason;
            _timer.Change(1200, Timeout.Infinite);
        }
    }

    private void Flush()
    {
        SyncScope? scope;
        string reason;
        long generation;
        lock (_gate)
        {
            if (_disposed || _publishing || _reviewDepth > 0 || _scope is null) return;
            _publishing = true;
            scope = _scope;
            reason = _pendingReason;
            generation = _generation;
        }

        try
        {
            RhinoApp.InvokeAndWait(() => Publish(scope, reason, generation));
        }
        catch (Exception exception)
        {
            RhinoApp.WriteLine($"CarbonLoop 自动同步失败：{exception.Message}");
        }
        finally
        {
            lock (_gate) _publishing = false;
        }
    }

    private void Publish(SyncScope scope, string reason, long generation)
    {
        lock (_gate) if (_disposed || _reviewDepth > 0 || generation != _generation) return;
        var doc = RhinoDoc.FromRuntimeSerialNumber(scope.DocumentSerialNumber);
        if (doc is null) return;
        var objects = ResolveObjects(doc, scope);
        var profile = RhinoSemanticReview.Profile();
        var pending = objects.Count(item => RhinoSemanticReview.NeedsReview(doc, item, profile));
        if (pending > 0)
        {
            RhinoApp.WriteLine($"CarbonLoop：{pending} 个对象的图层、名称或材料待核验，已暂停发送。请运行 CarbonLoopSend，在 Rhino 确认后继续。");
            return;
        }
        if (objects.Count == 0)
        {
            RhinoApp.WriteLine("CarbonLoop：当前同步范围已没有可读取对象；网页保留上一次结果。");
            return;
        }

        var export = new RhinoModelExporter(doc).Export(objects, scope.Mode, scope.Floor, "automatic", reason);
        var result = _plugin.Publish(export.Json);
        if (result.Success)
            RhinoApp.WriteLine($"CarbonLoop：{reason}，已自动同步 {export.IncludedCount} 个对象；网页将在 2 秒内更新。");
        else
            RhinoApp.WriteLine($"CarbonLoop 自动同步失败：{result.Message}");
    }

    private static IReadOnlyList<RhinoObject> ResolveObjects(RhinoDoc doc, SyncScope scope)
    {
        var all = doc.Objects.GetObjectList(ObjectType.AnyObject).Where(item => !item.IsDeleted).ToList();
        if (scope.Mode == "all") return all;
        if (scope.Mode == "floor" && !string.IsNullOrWhiteSpace(scope.Floor))
        {
            var currentLayerPath = scope.LayerId.HasValue
                ? doc.Layers.FirstOrDefault(layer => !layer.IsDeleted && layer.Id == scope.LayerId.Value)?.FullPath ?? scope.Floor
                : scope.Floor;
            return all.Where(item =>
            {
                var layer = item.Attributes.LayerIndex >= 0 ? doc.Layers[item.Attributes.LayerIndex]?.FullPath ?? "" : "";
                return layer.Equals(currentLayerPath, StringComparison.OrdinalIgnoreCase)
                    || layer.StartsWith(currentLayerPath + "::", StringComparison.OrdinalIgnoreCase);
            }).ToList();
        }
        var ids = scope.ObjectIds.ToHashSet();
        return all.Where(item => ids.Contains(item.Id)).ToList();
    }

    public void Dispose()
    {
        lock (_gate) _disposed = true;
        RhinoDoc.AddRhinoObject -= OnObjectChanged;
        RhinoDoc.DeleteRhinoObject -= OnObjectChanged;
        RhinoDoc.UndeleteRhinoObject -= OnObjectChanged;
        RhinoDoc.ReplaceRhinoObject -= OnObjectReplaced;
        RhinoDoc.ModifyObjectAttributes -= OnAttributesChanged;
        RhinoDoc.LayerTableEvent -= OnLayerChanged;
        RhinoDoc.MaterialTableEvent -= OnMaterialChanged;
        RhinoDoc.RenderMaterialsTableEvent -= OnRenderMaterialChanged;
        _timer.Dispose();
    }

    private sealed record SyncScope(uint DocumentSerialNumber, string Mode, string? Floor, Guid[] ObjectIds, Guid? LayerId);
}
