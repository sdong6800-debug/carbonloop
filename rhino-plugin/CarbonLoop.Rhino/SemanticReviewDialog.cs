using System.Drawing;
using System.Windows.Forms;
using Rhino;
using Rhino.DocObjects;

namespace CarbonLoop.Rhino;

internal sealed class SemanticReviewDialog : Form
{
    private readonly RhinoDoc _doc;
    private readonly SemanticProfile _profile;
    private readonly List<ReviewGroup> _groups;
    private readonly Dictionary<Guid, string> _originalStamps = new();
    private readonly DataGridView _grid = new();
    private readonly Label _status = new() { AutoSize = true };
    private readonly CheckBox _allowLayerRename = new() { AutoSize = true,
        Text = "允许修改图层名称（影响该图层的全部对象，包括本次范围之外的对象）" };
    private bool _loading;

    public SemanticReviewDialog(RhinoDoc doc, IReadOnlyList<RhinoObject> objects, SemanticProfile profile)
    {
        _doc = doc; _profile = profile; _groups = RhinoSemanticReview.Groups(doc, objects, profile);
        foreach (var id in _groups.SelectMany(group => group.Ids))
            if (doc.Objects.FindId(id) is { } item) _originalStamps[id] = RhinoSemanticReview.Stamp(doc, item);
        Text = "CarbonLoop · Rhino 图层与材料核验";
        StartPosition = FormStartPosition.CenterParent;
        Size = new Size(1260, 780); MinimumSize = new Size(1000, 640);
        Font = new System.Drawing.Font("Microsoft YaHei UI", 10);
        AutoScaleMode = AutoScaleMode.Dpi;
        var description = new Label { AutoSize = true, MaximumSize = new Size(1180, 0),
            Text = "发送前核对每组对象的构件类型和材料。拼写建议来自本地词典，无需 API。\n勾选“确认本组”后才保存；未确定项可明确保留待核验。碳分析材料名只写入这些对象的 CarbonLoop 属性，不修改共享渲染材质。" };
        _grid.Dock = DockStyle.Fill;
        _grid.AutoGenerateColumns = false;
        _grid.AllowUserToAddRows = false; _grid.AllowUserToDeleteRows = false;
        _grid.RowHeadersVisible = false; _grid.MultiSelect = false;
        _grid.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
        _grid.AutoSizeRowsMode = DataGridViewAutoSizeRowsMode.AllCells;
        _grid.DefaultCellStyle.WrapMode = DataGridViewTriState.True;
        _grid.Columns.Add(new DataGridViewCheckBoxColumn { Name = "approved", HeaderText = "确认本组", Width = 70 });
        TextColumn("count", "对象数", 65, true);
        TextColumn("layer", "原始图层 / 对象名", 190, true);
        TextColumn("native", "Rhino 原材质", 120, true);
        ChoiceColumn("type", "构件类型", profile.TypeCategories, 155);
        ChoiceColumn("material", "碳计算材料类别", profile.MaterialCategories, 205);
        TextColumn("materialName", "碳分析材料名（可修改）", 160, false);
        TextColumn("rename", "图层末级名称（可修改）", 160, false);
        TextColumn("basis", "匹配依据 / 拼写建议", 310, true);
        _grid.DataError += (_, e) => { e.ThrowException = false; _status.Text = "选项无效，请重新选择。"; };
        _grid.CurrentCellDirtyStateChanged += (_, _) => { if (_grid.IsCurrentCellDirty) _grid.CommitEdit(DataGridViewDataErrorContexts.Commit); };
        _grid.CellValueChanged += (_, e) =>
        {
            if (_loading || e.RowIndex < 0) return;
            if (e.ColumnIndex != _grid.Columns["approved"].Index)
            {
                _loading = true;
                _grid.Rows[e.RowIndex].Cells["approved"].Value = false;
                _loading = false;
            }
            UpdateStatus();
        };
        _grid.SelectionChanged += (_, _) => UpdateStatus();

        var exact = new Button { Text = "勾选全部明确匹配", AutoSize = true };
        exact.Click += (_, _) =>
        {
            _grid.EndEdit(); _loading = true;
            foreach (DataGridViewRow row in _grid.Rows)
            {
                if (row.Tag is not ReviewGroup group) continue;
                if (!group.Exact || Value(row, "type") != group.Type || Value(row, "material") != group.Material
                    || Value(row, "materialName") != group.SourceMaterial
                    || Value(row, "rename") != Leaf(group.Layer)) continue;
                row.Cells["approved"].Value = true;
            }
            _loading = false; UpdateStatus();
        };
        var locate = new Button { Text = "在 Rhino 中选中本组", AutoSize = true };
        locate.Click += (_, _) =>
        {
            if (_grid.CurrentRow?.Tag is not ReviewGroup group) return;
            _doc.Objects.UnselectAll(); foreach (var id in group.Ids) _doc.Objects.Select(id);
            _doc.Views.Redraw();
        };
        var spelling = new Button { Text = "填入本组拼写建议", AutoSize = true };
        spelling.Click += (_, _) =>
        {
            if (_grid.CurrentRow is not { } row || row.Tag is not ReviewGroup group)
            {
                _status.Text = "请先在表格中选中一组对象，再点击“填入本组拼写建议”。";
                return;
            }
            _grid.EndEdit();
            var changed = new List<string>();
            if (group.CorrectedMaterial != group.SourceMaterial && group.CorrectedMaterial.Length > 0)
            {
                row.Cells["materialName"].Value = group.CorrectedMaterial;
                changed.Add($"材料名：{group.SourceMaterial} → {group.CorrectedMaterial}");
            }
            if (group.CorrectedLayer.Length > 0 && group.CorrectedLayer != Leaf(group.Layer))
            {
                // One layer can have several groups. Show the same proposed
                // rename in every row before asking for confirmation again.
                foreach (DataGridViewRow sibling in _grid.Rows)
                    if (sibling.Tag is ReviewGroup siblingGroup && siblingGroup.LayerIndex == group.LayerIndex)
                        sibling.Cells["rename"].Value = group.CorrectedLayer;
                changed.Add($"图层末级名称：{Leaf(group.Layer)} → {group.CorrectedLayer}");
            }
            if (changed.Count == 0)
            {
                var material = group.SourceMaterial.Length > 0 ? group.SourceMaterial : "（空）";
                var layer = Leaf(group.Layer);
                _status.Text = $"本组没有可直接填入的拼写纠正：材料“{material}”、图层“{layer}”。请查看匹配依据；名称已正确时直接核对类别，信息不足时手动选择或保留未确定。";
                _status.ForeColor = Color.DarkRed;
                return;
            }
            _status.ForeColor = SystemColors.ControlText;
            _status.Text = "已填入建议（尚未保存）：" + string.Join("；", changed) + "。请检查后勾选“确认本组”。";
        };
        var actions = new FlowLayoutPanel { AutoSize = true, Dock = DockStyle.Fill };
        actions.Controls.AddRange(new Control[] { exact, spelling, locate });
        var save = new Button { Text = "确认修改并发送", AutoSize = true };
        save.Click += (_, _) => Save();
        var cancel = new Button { Text = "关闭核验，不发送", AutoSize = true, DialogResult = DialogResult.Cancel };
        CancelButton = cancel;
        var footer = new FlowLayoutPanel { AutoSize = true, Dock = DockStyle.Fill, FlowDirection = FlowDirection.RightToLeft };
        footer.Controls.AddRange(new Control[] { cancel, save });
        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(16), ColumnCount = 1, RowCount = 6 };
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.Controls.Add(description, 0, 0); layout.Controls.Add(actions, 0, 1); layout.Controls.Add(_grid, 0, 2);
        layout.Controls.Add(_allowLayerRename, 0, 3); layout.Controls.Add(_status, 0, 4); layout.Controls.Add(footer, 0, 5);
        Controls.Add(layout);
        _loading = true;
        foreach (var group in _groups)
        {
            var index = _grid.Rows.Add(group.Current, group.Ids.Count, group.Layer + (group.Name.Length > 0 ? "\n" + group.Name : ""),
                group.NativeMaterial.Length > 0 ? group.NativeMaterial : "未赋材质", group.Type, group.Material,
                group.SourceMaterial, Leaf(group.Layer), group.Basis);
            _grid.Rows[index].Tag = group;
            if (!group.Exact && !group.Current) _grid.Rows[index].DefaultCellStyle.BackColor = Color.FromArgb(255, 248, 224);
        }
        _loading = false;
        UpdateStatus();
    }

    private static string Leaf(string path) => path.Split(new[] { "::" }, StringSplitOptions.None).Last();
    private static string Value(DataGridViewRow row, string name) => Convert.ToString(row.Cells[name].Value)?.Trim() ?? "";
    private void TextColumn(string name, string label, int width, bool readOnly) =>
        _grid.Columns.Add(new DataGridViewTextBoxColumn { Name = name, HeaderText = label, Width = width, ReadOnly = readOnly,
            SortMode = DataGridViewColumnSortMode.NotSortable });
    private void ChoiceColumn(string name, string label, IEnumerable<string> values, int width) =>
        _grid.Columns.Add(new DataGridViewComboBoxColumn { Name = name, HeaderText = label, Width = width,
            DataSource = values.Select(value => new Choice(value, SemanticProfile.Label(value))).ToList(),
            ValueMember = nameof(Choice.Value), DisplayMember = nameof(Choice.Text),
            FlatStyle = FlatStyle.Flat, SortMode = DataGridViewColumnSortMode.NotSortable });

    private void UpdateStatus()
    {
        _status.ForeColor = SystemColors.ControlText;
        var approved = _grid.Rows.Cast<DataGridViewRow>().Count(row => row.Cells["approved"].Value is true);
        var text = $"共 {_groups.Sum(group => group.Ids.Count)} 个对象，{_groups.Count} 组；已确认 {approved} 组。";
        if (_grid.CurrentRow?.Tag is ReviewGroup group) text += $" 当前组 {group.Ids.Count} 个对象：{group.Basis}";
        _status.Text = text;
        _status.MaximumSize = new Size(Math.Max(900, ClientSize.Width - 48), 0);
    }

    private void Save()
    {
        _grid.EndEdit();
        var changes = new List<ReviewedChange>();
        var renames = new Dictionary<int, string>();
        foreach (DataGridViewRow row in _grid.Rows)
        {
            if (row.Cells["approved"].Value is not true) { _status.Text = "请逐组核对并勾选“确认本组”；也可以把类别设为未确定后确认保留。"; return; }
            if (row.Tag is not ReviewGroup group) continue;
            var type = Value(row, "type"); var material = Value(row, "material"); var name = Value(row, "materialName");
            if (!_profile.IsType(type) || !_profile.IsMaterial(material)) { _status.Text = "请选择有效类别。"; return; }
            if (name.Length > 200) { _status.Text = "碳分析材料名最多 200 个字符。"; return; }
            var layerName = Value(row, "rename");
            if (layerName != Leaf(group.Layer))
            {
                if (!_allowLayerRename.Checked) { _status.Text = "本次包含图层改名。请确认上方影响范围，或恢复原图层名。"; return; }
                if (string.IsNullOrWhiteSpace(layerName) || layerName.IndexOfAny(new[] { ':', '/', '\\', '\r', '\n' }) >= 0)
                { _status.Text = "图层末级名称不能为空或包含路径分隔符。"; return; }
                if (renames.TryGetValue(group.LayerIndex, out var other) && other != layerName)
                { _status.Text = "同一图层出现不同改名，请统一后重新确认。"; return; }
                renames[group.LayerIndex] = layerName;
            }
            foreach (var id in group.Ids)
            {
                var item = _doc.Objects.FindId(id);
                if (item is null || item.IsDeleted || RhinoSemanticReview.Stamp(_doc, item) != _originalStamps[id])
                { _status.Text = "模型在核验期间已变化，请取消后重新发送。"; return; }
                changes.Add(new ReviewedChange(id, type, material, name, group.NativeMaterial));
            }
        }
        // A shared layer name is a document-wide edit. Check every sibling,
        // including layers outside the selected analysis scope, for collisions.
        var futureNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var layer in _doc.Layers.Where(layer => !layer.IsDeleted))
        {
            var futureName = renames.TryGetValue(layer.Index, out var rename) ? rename : layer.Name;
            if (!futureNames.Add(layer.ParentLayerId + ":" + futureName))
            { _status.Text = "图层改名与同级图层重名，请修改后重试。"; return; }
        }
        var originals = changes.ToDictionary(change => change.Id, change => _doc.Objects.FindId(change.Id)!.Attributes.Duplicate());
        var originalLayers = renames.Keys.ToDictionary(index => index, index => _doc.Layers[index].Name);
        var undo = _doc.BeginUndoRecord("CarbonLoop 图层与材料确认");
        try
        {
            foreach (var rename in renames)
            {
                var layer = _doc.Layers[rename.Key]; layer.Name = rename.Value;
                if (_doc.Layers[rename.Key].Name != rename.Value) throw new InvalidOperationException("图层改名失败，请检查图层状态。");
            }
            foreach (var change in changes)
            {
                var item = _doc.Objects.FindId(change.Id)!;
                var attributes = item.Attributes.Duplicate();
                attributes.SetUserString("CarbonLoop.Type", change.Type);
                attributes.SetUserString(RhinoSemanticReview.MaterialCategoryKey, change.Material);
                attributes.SetUserString("CarbonLoop.Material", change.MaterialName);
                attributes.SetUserString("CarbonLoop.OriginalMaterial", change.NativeName);
                attributes.SetUserString("CarbonLoop.ReviewVersion", "rhino-review-1");
                attributes.SetUserString("CarbonLoop.ReviewedAt", DateTimeOffset.UtcNow.ToString("O"));
                if (!_doc.Objects.ModifyAttributes(change.Id, attributes, true)) throw new InvalidOperationException("对象属性保存失败，请检查锁定或引用对象。");
            }
            foreach (var change in changes)
            {
                var item = _doc.Objects.FindId(change.Id)!;
                var attributes = item.Attributes.Duplicate();
                attributes.SetUserString(RhinoSemanticReview.StampKey, RhinoSemanticReview.Stamp(_doc, item));
                if (!_doc.Objects.ModifyAttributes(change.Id, attributes, true)) throw new InvalidOperationException("确认记录保存失败。");
            }
            _doc.Views.Redraw(); DialogResult = DialogResult.OK; Close();
        }
        catch (Exception exception)
        {
            var rollbackFailed = false;
            foreach (var originalLayer in originalLayers)
            {
                var layer = _doc.Layers[originalLayer.Key]; layer.Name = originalLayer.Value;
                if (_doc.Layers[originalLayer.Key].Name != originalLayer.Value) rollbackFailed = true;
            }
            foreach (var original in originals)
                if (!_doc.Objects.ModifyAttributes(original.Key, original.Value, true)) rollbackFailed = true;
            _doc.Views.Redraw();
            _status.Text = exception.Message + (rollbackFailed ? " 部分恢复失败，请先撤销并检查模型；没有发送。" : " 已恢复原始属性，没有发送。");
        }
        finally { if (undo != 0) _doc.EndUndoRecord(undo); }
    }

    public static bool Confirm(RhinoDoc doc, IReadOnlyList<RhinoObject> objects)
    {
        using var dialog = new SemanticReviewDialog(doc, objects, RhinoSemanticReview.Profile());
        return dialog.ShowDialog(new RhinoOwner()) == DialogResult.OK;
    }

    private sealed class RhinoOwner : IWin32Window { public IntPtr Handle => RhinoApp.MainWindowHandle(); }
    private sealed record Choice(string Value, string Text);
    private sealed record ReviewedChange(Guid Id, string Type, string Material, string MaterialName, string NativeName);
}
