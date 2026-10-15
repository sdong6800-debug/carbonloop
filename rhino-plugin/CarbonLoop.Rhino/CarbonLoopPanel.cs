using Rhino;

namespace CarbonLoop.Rhino;

[System.Runtime.InteropServices.Guid("c5db40d6-1812-48ff-9800-dd661a0034db")]
public sealed class CarbonLoopPanel : Eto.Forms.Panel
{
    private readonly Eto.Forms.Label _status = new();

    public CarbonLoopPanel()
    {
        var title = new Eto.Forms.Label { Text = "CarbonLoop 建筑碳分析" };
        var description = new Eto.Forms.Label { Text = "选择 Rhino 构件后，一键发送到碳分析工作台。" };
        var send = new Eto.Forms.Button { Text = "发送已选构件" };
        var open = new Eto.Forms.Button { Text = "打开 CarbonLoop 工作台" };
        var help = new Eto.Forms.Label { Text = "未预选构件时，可在 Rhino 命令行选择当前图层、整个模型或重新框选。" };

        send.Click += (_, _) => RhinoApp.RunScript("_CarbonLoopSend", false);
        open.Click += (_, _) =>
        {
            RhinoApp.RunScript("_CarbonLoop", false);
            RefreshStatus();
        };

        Content = new Eto.Forms.StackLayout
        {
            Padding = 14,
            Spacing = 10,
            Items = { title, description, _status, send, open, help, null }
        };
        RefreshStatus();
    }

    private void RefreshStatus()
    {
        var plugin = CarbonLoopPlugin.Instance;
        _status.Text = plugin?.IsReady == true
            ? "● 已连接（无需黑色窗口）"
            : $"○ 未连接：{plugin?.StatusMessage ?? "插件尚未加载"}";
    }
}
