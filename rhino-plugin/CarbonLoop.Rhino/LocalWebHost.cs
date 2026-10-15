using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;

namespace CarbonLoop.Rhino;

public sealed class LocalWebHost : IDisposable
{
    public const string WorkbenchUrl = "http://127.0.0.1:8513/demo.html";
    private const int DefaultSitePort = 8513;
    private const int DefaultBridgePort = 8515;
    private const int MaximumRequestBytes = 8 * 1024 * 1024;
    private readonly string _webRoot;
    private readonly int _sitePort;
    private readonly int _bridgePort;
    private readonly CancellationTokenSource _cancellation = new();
    private readonly object _payloadLock = new();
    private TcpListener? _siteListener;
    private TcpListener? _bridgeListener;
    private string? _latestPayload;
    private DateTimeOffset? _latestReceivedAt;
    private int _revision;

    public LocalWebHost(string pluginDirectory, int sitePort = DefaultSitePort, int bridgePort = DefaultBridgePort)
    {
        _webRoot = Path.Combine(pluginDirectory, "web");
        _sitePort = sitePort;
        _bridgePort = bridgePort;
    }

    public bool IsRunning { get; private set; }
    public string StatusMessage { get; private set; } = "CarbonLoop 尚未启动。";

    public bool TryStart(out string message)
    {
        if (IsRunning)
        {
            message = StatusMessage;
            return true;
        }
        if (!Directory.Exists(_webRoot))
        {
            message = $"插件缺少网页文件：{_webRoot}";
            StatusMessage = message;
            return false;
        }

        try
        {
            _siteListener = new TcpListener(IPAddress.Loopback, _sitePort);
            _bridgeListener = new TcpListener(IPAddress.Loopback, _bridgePort);
            _siteListener.Start();
            _bridgeListener.Start();
            IsRunning = true;
            StatusMessage = "Rhino 插件与 CarbonLoop 工作台已连接。";
            _ = AcceptLoopAsync(_siteListener, HandleSiteAsync, _cancellation.Token);
            _ = AcceptLoopAsync(_bridgeListener, HandleBridgeAsync, _cancellation.Token);
            message = StatusMessage;
            return true;
        }
        catch (SocketException)
        {
            DisposeListeners();
            message = $"端口 {_sitePort} 或 {_bridgePort} 正在被旧版连接程序占用。关闭旧版黑色连接窗口后，插件会自动重试，无需重启 Rhino。";
            StatusMessage = message;
            return false;
        }
        catch (Exception exception)
        {
            DisposeListeners();
            message = $"本地服务启动失败：{exception.Message}";
            StatusMessage = message;
            return false;
        }
    }

    public PublishResult Publish(string payload)
    {
        try
        {
            using var document = JsonDocument.Parse(payload);
            var objectCount = document.RootElement.TryGetProperty("objects", out var objects) && objects.ValueKind == JsonValueKind.Array
                ? objects.GetArrayLength()
                : 0;
            lock (_payloadLock)
            {
                _latestPayload = payload;
                _latestReceivedAt = DateTimeOffset.UtcNow;
                _revision += 1;
                return new PublishResult(true, _revision, $"已接收 {objectCount} 个对象。");
            }
        }
        catch (JsonException exception)
        {
            return PublishResult.Failed($"模型数据不是有效 JSON：{exception.Message}");
        }
    }

    private async Task AcceptLoopAsync(TcpListener listener, Func<TcpClient, CancellationToken, Task> handler, CancellationToken token)
    {
        while (!token.IsCancellationRequested)
        {
            try
            {
                var client = await listener.AcceptTcpClientAsync(token);
                _ = Task.Run(() => handler(client, token), token);
            }
            catch (OperationCanceledException) { break; }
            catch (ObjectDisposedException) { break; }
            catch { if (!token.IsCancellationRequested) await Task.Delay(100, token); }
        }
    }

    private async Task HandleSiteAsync(TcpClient client, CancellationToken token)
    {
        using (client)
        {
            var request = await HttpRequestData.ReadAsync(client.GetStream(), token);
            if (request is null) return;
            if (!string.Equals(request.Method, "GET", StringComparison.OrdinalIgnoreCase))
            {
                await WriteResponseAsync(client, 405, "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("Method not allowed"), null, token);
                return;
            }

            var relative = Uri.UnescapeDataString(request.Path.Split('?', 2)[0]).TrimStart('/');
            if (string.IsNullOrWhiteSpace(relative)) relative = "demo.html";
            var fullPath = Path.GetFullPath(Path.Combine(_webRoot, relative.Replace('/', Path.DirectorySeparatorChar)));
            var root = Path.GetFullPath(_webRoot) + Path.DirectorySeparatorChar;
            if (!fullPath.StartsWith(root, StringComparison.OrdinalIgnoreCase) || !File.Exists(fullPath))
            {
                await WriteResponseAsync(client, 404, "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("Not found"), null, token);
                return;
            }

            var content = await File.ReadAllBytesAsync(fullPath, token);
            await WriteResponseAsync(client, 200, MimeType(fullPath), content, null, token);
        }
    }

    private async Task HandleBridgeAsync(TcpClient client, CancellationToken token)
    {
        using (client)
        {
            var request = await HttpRequestData.ReadAsync(client.GetStream(), token);
            if (request is null) return;
            var cors = new Dictionary<string, string>
            {
                ["Access-Control-Allow-Origin"] = $"http://127.0.0.1:{_sitePort}",
                ["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS",
                ["Access-Control-Allow-Headers"] = "Content-Type"
            };
            if (request.Method == "OPTIONS")
            {
                await WriteResponseAsync(client, 204, "application/json; charset=utf-8", Array.Empty<byte>(), cors, token);
                return;
            }
            if (request.Method == "GET" && request.Path.StartsWith("/health", StringComparison.OrdinalIgnoreCase))
            {
                int? latest;
                lock (_payloadLock) latest = _latestPayload is null ? null : _revision;
                await WriteJsonAsync(client, 200, new { service = "CarbonLoop Rhino Plugin", status = "ready", contractVersion = "carbonloop.rhino.intake/1.0.0", latestRevision = latest }, cors, token);
                return;
            }
            if (request.Method == "GET" && request.Path.StartsWith("/rhino-intake/latest", StringComparison.OrdinalIgnoreCase))
            {
                string? payload;
                DateTimeOffset? received;
                int revision;
                lock (_payloadLock) { payload = _latestPayload; received = _latestReceivedAt; revision = _revision; }
                if (payload is null)
                {
                    await WriteJsonAsync(client, 200, new { available = false }, cors, token);
                }
                else
                {
                    var envelope = $"{{\"available\":true,\"revision\":{revision},\"receivedAt\":{JsonSerializer.Serialize(received)},\"payload\":{payload},\"validation\":{{\"valid\":true,\"warnings\":[]}}}}";
                    await WriteResponseAsync(client, 200, "application/json; charset=utf-8", Encoding.UTF8.GetBytes(envelope), cors, token);
                }
                return;
            }
            if (request.Method == "POST" && request.Path.StartsWith("/rhino-intake/reset", StringComparison.OrdinalIgnoreCase))
            {
                lock (_payloadLock) { _latestPayload = null; _latestReceivedAt = null; }
                await WriteJsonAsync(client, 200, new { reset = true }, cors, token);
                return;
            }
            if (request.Method == "POST" && request.Path.Split('?', 2)[0].Equals("/rhino-intake", StringComparison.OrdinalIgnoreCase))
            {
                if (request.Body.Length > MaximumRequestBytes)
                {
                    await WriteJsonAsync(client, 413, new { accepted = false, error = "payload_too_large" }, cors, token);
                    return;
                }
                var result = Publish(Encoding.UTF8.GetString(request.Body));
                await WriteJsonAsync(client, result.Success ? 202 : 400, new { accepted = result.Success, revision = result.Revision, message = result.Message }, cors, token);
                return;
            }
            await WriteJsonAsync(client, 404, new { error = "not_found" }, cors, token);
        }
    }

    private static Task WriteJsonAsync(TcpClient client, int status, object value, IDictionary<string, string>? headers, CancellationToken token) =>
        WriteResponseAsync(client, status, "application/json; charset=utf-8", JsonSerializer.SerializeToUtf8Bytes(value), headers, token);

    private static async Task WriteResponseAsync(TcpClient client, int status, string contentType, byte[] body, IDictionary<string, string>? extraHeaders, CancellationToken token)
    {
        var reason = status switch { 200 => "OK", 202 => "Accepted", 204 => "No Content", 400 => "Bad Request", 404 => "Not Found", 405 => "Method Not Allowed", 413 => "Payload Too Large", _ => "OK" };
        var builder = new StringBuilder()
            .Append("HTTP/1.1 ").Append(status).Append(' ').Append(reason).Append("\r\n")
            .Append("Content-Type: ").Append(contentType).Append("\r\n")
            .Append("Content-Length: ").Append(body.Length).Append("\r\n")
            .Append("Cache-Control: no-store\r\nConnection: close\r\n");
        if (extraHeaders is not null)
            foreach (var pair in extraHeaders) builder.Append(pair.Key).Append(": ").Append(pair.Value).Append("\r\n");
        builder.Append("\r\n");
        var stream = client.GetStream();
        var headerBytes = Encoding.ASCII.GetBytes(builder.ToString());
        await stream.WriteAsync(headerBytes, token);
        if (body.Length > 0) await stream.WriteAsync(body, token);
        await stream.FlushAsync(token);
    }

    private static string MimeType(string path) => Path.GetExtension(path).ToLowerInvariant() switch
    {
        ".html" => "text/html; charset=utf-8", ".css" => "text/css; charset=utf-8", ".js" => "text/javascript; charset=utf-8",
        ".json" => "application/json; charset=utf-8", ".svg" => "image/svg+xml", ".png" => "image/png", ".jpg" or ".jpeg" => "image/jpeg",
        ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".zip" => "application/zip", _ => "application/octet-stream"
    };

    public void Dispose()
    {
        _cancellation.Cancel();
        DisposeListeners();
        _cancellation.Dispose();
        IsRunning = false;
    }

    private void DisposeListeners()
    {
        try { _siteListener?.Stop(); } catch { }
        try { _bridgeListener?.Stop(); } catch { }
        _siteListener = null;
        _bridgeListener = null;
    }

    private sealed record HttpRequestData(string Method, string Path, byte[] Body)
    {
        public static async Task<HttpRequestData?> ReadAsync(NetworkStream stream, CancellationToken token)
        {
            using var buffer = new MemoryStream();
            var chunk = new byte[4096];
            var headerEnd = -1;
            while (buffer.Length < 64 * 1024 && headerEnd < 0)
            {
                var read = await stream.ReadAsync(chunk, token);
                if (read == 0) return null;
                buffer.Write(chunk, 0, read);
                headerEnd = FindHeaderEnd(buffer.GetBuffer(), (int)buffer.Length);
            }
            if (headerEnd < 0) return null;
            var current = buffer.ToArray();
            var headerText = Encoding.ASCII.GetString(current, 0, headerEnd);
            var lines = headerText.Split(new[] { "\r\n" }, StringSplitOptions.None);
            var requestLine = lines[0].Split(' ', 3);
            if (requestLine.Length < 2) return null;
            var contentLength = 0;
            foreach (var line in lines.Skip(1))
            {
                var separator = line.IndexOf(':');
                if (separator > 0 && line[..separator].Equals("Content-Length", StringComparison.OrdinalIgnoreCase))
                    int.TryParse(line[(separator + 1)..].Trim(), out contentLength);
            }
            if (contentLength > MaximumRequestBytes) contentLength = MaximumRequestBytes + 1;
            var bodyStart = headerEnd + 4;
            using var body = new MemoryStream();
            if (current.Length > bodyStart) body.Write(current, bodyStart, current.Length - bodyStart);
            while (body.Length < contentLength)
            {
                var read = await stream.ReadAsync(chunk.AsMemory(0, Math.Min(chunk.Length, contentLength - (int)body.Length)), token);
                if (read == 0) break;
                body.Write(chunk, 0, read);
            }
            return new HttpRequestData(requestLine[0], requestLine[1], body.ToArray());
        }

        private static int FindHeaderEnd(byte[] bytes, int length)
        {
            for (var index = 0; index <= length - 4; index++)
                if (bytes[index] == 13 && bytes[index + 1] == 10 && bytes[index + 2] == 13 && bytes[index + 3] == 10) return index;
            return -1;
        }
    }
}
