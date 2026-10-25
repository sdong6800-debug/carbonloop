using System.Diagnostics;
using System.Reflection;
using System.Runtime.InteropServices;
using Rhino;
using Rhino.DocObjects;
using Rhino.PlugIns;

namespace CarbonLoop.Rhino;

[Guid("c7ab61d4-ea98-4f9d-8a74-012041696b97")]
public sealed class CarbonLoopPlugin : PlugIn
{
    private readonly object _hostLock = new();
    private LocalWebHost? _host;
    private RhinoModelSyncCoordinator? _sync;
    private System.Threading.Timer? _connectionRetry;
    private bool _startupAttempted;

    public CarbonLoopPlugin() => Instance = this;

    public static CarbonLoopPlugin? Instance { get; private set; }

    public override PlugInLoadTime LoadTime => PlugInLoadTime.AtStartup;

    public bool IsReady => _host?.IsRunning == true;

    public string StatusMessage => _host?.StatusMessage ?? "CarbonLoop 尚未启动。";

    protected override LoadReturnCode OnLoad(ref string errorMessage)
    {
        // Start the local connection after Rhino finishes loading. Deferring the
        // start keeps plug-in loading safe while making the workbench available
        // without asking the architect to run a separate connector program.
        RhinoApp.Idle += OnRhinoIdle;
        _sync = new RhinoModelSyncCoordinator(this);
        _sync.Start();
        errorMessage = string.Empty;
        RhinoApp.WriteLine("CarbonLoop 插件已加载，正在建立本地连接……");
        return LoadReturnCode.Success;
    }

    private void OnRhinoIdle(object? sender, EventArgs e)
    {
        RhinoApp.Idle -= OnRhinoIdle;
        if (_startupAttempted)
            return;

        _startupAttempted = true;
        if (EnsureHost(out var message))
            RhinoApp.WriteLine($"CarbonLoop：{message} 选择构件后运行 CarbonLoopSend。");
        else
        {
            RhinoApp.WriteLine($"CarbonLoop 自动连接未启动：{message}");
            StartReconnectLoop();
        }
    }

    private void StartReconnectLoop()
    {
        _connectionRetry ??= new System.Threading.Timer(_ =>
        {
            if (!EnsureHost(out var message))
                return;

            _connectionRetry?.Change(Timeout.Infinite, Timeout.Infinite);
            RhinoApp.InvokeOnUiThread(() => RhinoApp.WriteLine($"CarbonLoop 已自动重连：{message}"));
        }, null, TimeSpan.FromSeconds(5), TimeSpan.FromSeconds(5));
    }

    protected override void OnShutdown()
    {
        RhinoApp.Idle -= OnRhinoIdle;
        _sync?.Dispose();
        _sync = null;
        _connectionRetry?.Dispose();
        _connectionRetry = null;
        lock (_hostLock)
        {
            _host?.Dispose();
            _host = null;
        }
        base.OnShutdown();
    }

    public bool EnsureHost(out string message)
    {
        lock (_hostLock)
        {
            if (_host?.IsRunning == true)
            {
                _connectionRetry?.Change(Timeout.Infinite, Timeout.Infinite);
                message = _host.StatusMessage;
                return true;
            }

            _host?.Dispose();
            var pluginDirectory = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location) ?? AppContext.BaseDirectory;
            _host = new LocalWebHost(pluginDirectory);
            var started = _host.TryStart(out message);
            if (started)
                _connectionRetry?.Change(Timeout.Infinite, Timeout.Infinite);
            return started;
        }
    }

    public PublishResult Publish(string payload)
    {
        if (!EnsureHost(out var error) || _host is null)
            return PublishResult.Failed(error);
        var result = _host.Publish(payload);
        if (result.Success || _host.IsRunning)
            return result;

        // A shared connector may have closed between the health check and the
        // send. Re-establish the service once and retry the same model so the
        // architect does not have to run the command twice.
        if (!EnsureHost(out error) || _host is null)
            return PublishResult.Failed(error);
        return _host.Publish(payload);
    }

    public void RememberSyncScope(RhinoDoc doc, string mode, string? floor, IReadOnlyList<RhinoObject> objects) =>
        _sync?.Remember(doc, mode, floor, objects);

    public IDisposable SuspendSynchronizationForReview() => _sync?.PauseForReview() ?? new EmptyDisposable();

    private sealed class EmptyDisposable : IDisposable { public void Dispose() { } }

    public bool OpenWorkbench(out string message, int? revision = null)
    {
        if (!EnsureHost(out message))
            return false;
        try
        {
            // A stable URL can make the browser merely focus an already-open,
            // stale CarbonLoop tab instead of loading the newly published Rhino
            // payload and current web assets. Give every Rhino launch a fresh
            // navigation URL; the local host ignores the query when serving the
            // file, while the browser treats it as a new document navigation.
            var navigationToken = revision?.ToString(System.Globalization.CultureInfo.InvariantCulture)
                ?? DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString(System.Globalization.CultureInfo.InvariantCulture);
            var url = $"{LocalWebHost.WorkbenchUrl}?source=rhino&revision={navigationToken}&ui=20261020-rhino-review-1";
            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            message = "CarbonLoop 工作台已打开。";
            return true;
        }
        catch (Exception exception)
        {
            message = $"无法打开浏览器：{exception.Message}";
            return false;
        }
    }
}

public sealed record PublishResult(bool Success, int Revision, string Message)
{
    public static PublishResult Failed(string message) => new(false, 0, message);
}
