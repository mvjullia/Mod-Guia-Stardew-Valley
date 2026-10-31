using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using Microsoft.Xna.Framework.Input;
using StardewValley;
using StardewValley.Menus;

namespace StardewRealtimeTelemetry;

/// <summary>Read-only in-game album. Originals remain immutable; no editing/deletion conflicts are introduced.</summary>
internal sealed class AlbumGameMenu : IClickableMenu
{
    private readonly AlbumStore store;
    private readonly Action<string?> request;
    private readonly Action sync;
    private sealed record Card(AlbumPhoto? Photo, AlbumSession? Session);
    private readonly Dictionary<string, Texture2D> textures = new();
    private readonly List<(string Id, string Label)> collections = new() { ("all", "Todas"), ("coop", "Coop"), ("romance", "Romance"), ("nights", "Nossas noites"), ("festivals", "Festivais"), ("joja", "Joja") };
    private Card[] cards = Array.Empty<Card>();
    private long version = -1;
    private int page, collection;
    private Card? selected;
    private Rectangle newButton, syncButton, previousButton, nextButton, retryButton;
    private readonly List<Rectangle> tabBounds = new(), cardBounds = new();
    public AlbumGameMenu(AlbumStore store, Action<string?> request, Action sync) : base(0, 0, 1100, 760, true)
    {
        this.store = store; this.request = request; this.sync = sync; Layout(); Refresh();
    }
    private void Layout()
    {
        width = Math.Min(1100, Game1.uiViewport.Width - 40); height = Math.Min(760, Game1.uiViewport.Height - 40);
        xPositionOnScreen = (Game1.uiViewport.Width - width) / 2; yPositionOnScreen = (Game1.uiViewport.Height - height) / 2;
        initializeUpperRightCloseButton();
        newButton = new Rectangle(xPositionOnScreen + width - 370, yPositionOnScreen + 25, 190, 48);
        syncButton = new Rectangle(xPositionOnScreen + width - 170, yPositionOnScreen + 25, 130, 48);
        previousButton = new Rectangle(xPositionOnScreen + 35, yPositionOnScreen + height - 60, 100, 40);
        nextButton = new Rectangle(xPositionOnScreen + width - 135, yPositionOnScreen + height - 60, 100, 40);
        retryButton = new Rectangle(xPositionOnScreen + width / 2 - 130, yPositionOnScreen + height - 105, 260, 42);
        tabBounds.Clear(); int tabWidth = Math.Max(80, (width - 70) / collections.Count);
        for (int i = 0; i < collections.Count; i++) tabBounds.Add(new Rectangle(xPositionOnScreen + 35 + i * tabWidth, yPositionOnScreen + 90, tabWidth - 5, 42));
        cardBounds.Clear(); int cardWidth = (width - 100) / 3, cardHeight = (height - 230) / 2;
        for (int i = 0; i < 6; i++) cardBounds.Add(new Rectangle(xPositionOnScreen + 35 + i % 3 * (cardWidth + 15), yPositionOnScreen + 150 + i / 3 * (cardHeight + 15), cardWidth, cardHeight));
    }
    private static string Category(AlbumPhoto photo) => photo.Collection ?? "memories";
    private void Refresh()
    {
        if (version == store.Version) return; version = store.Version;
        var photos = store.Snapshot(); var sessions = store.Sessions?.Snapshot() ?? Array.Empty<AlbumSession>(); var all = new List<Card>();
        foreach (var session in sessions) {
            var photo = photos.FirstOrDefault(p => p.Id == session.CompositePhotoId) ?? photos.FirstOrDefault(p => p.SessionId == session.Id && !p.IsComposite);
            if (collection == 0 || session.Collection == collections[collection].Id) all.Add(new Card(photo, session));
        }
        all.AddRange(photos.Where(photo => photo.SessionId == null && (collection == 0 || Category(photo) == collections[collection].Id)).OrderByDescending(photo => photo.CapturedAt).Select(photo => new Card(photo, null)));
        cards = all.OrderByDescending(card => card.Session?.CreatedAt ?? card.Photo!.CapturedAt).ToArray(); page = Math.Clamp(page, 0, Math.Max(0, (cards.Length - 1) / 6));
        if (selected != null) selected = cards.FirstOrDefault(card => selected.Session != null ? card.Session?.Id == selected.Session.Id : card.Photo?.Id == selected.Photo?.Id);
    }
    private Texture2D? Image(AlbumPhoto? photo)
    {
        if (photo == null) return null; if (textures.TryGetValue(photo.ImageId, out var cached)) return cached;
        var bytes = store.ReadImage(photo.ImageId); if (bytes == null) return null;
        try { using var stream = new MemoryStream(bytes); var image = Texture2D.FromStream(Game1.graphics.GraphicsDevice, stream); textures[photo.ImageId] = image; return image; } catch { return null; }
    }
    private static string Status(AlbumSession? session) => session?.Status switch {
        "synchronized" => "Sincronizada: as duas visões estão nos dois computadores", "confirming" => "Confirmando as duas cópias...",
        "capture-failed" => "Captura pendente: é possível tentar novamente", _ => "Pendente: aguardando captura ou transferência"
    };
    private static void Text(SpriteBatch b, string text, int x, int y, int maxWidth, Color? color = null) =>
        Utility.drawTextWithShadow(b, Game1.parseText(text, Game1.smallFont, Math.Max(30, maxWidth)), Game1.smallFont, new Vector2(x, y), color ?? Game1.textColor);
    private static void Button(SpriteBatch b, Rectangle bounds, string text, bool active = false)
    {
        drawTextureBox(b, bounds.X, bounds.Y, bounds.Width, bounds.Height, active ? Color.LightPink : Color.White);
        Utility.drawTextWithShadow(b, text, Game1.smallFont, new Vector2(bounds.X + 10, bounds.Y + 9), Game1.textColor);
    }
    private void DrawImage(SpriteBatch b, AlbumPhoto? photo, Rectangle bounds)
    {
        var image = Image(photo); b.Draw(Game1.staminaRect, bounds, new Color(58, 45, 35));
        if (image == null) { Text(b, "Aguardando foto...", bounds.X + 12, bounds.Y + bounds.Height / 2 - 15, bounds.Width - 24); return; }
        float scale = Math.Min(bounds.Width / (float)image.Width, bounds.Height / (float)image.Height);
        var fit = new Rectangle(bounds.X + (bounds.Width - (int)(image.Width * scale)) / 2, bounds.Y + (bounds.Height - (int)(image.Height * scale)) / 2, (int)(image.Width * scale), (int)(image.Height * scale)); b.Draw(image, fit, Color.White);
    }
    public override void draw(SpriteBatch b)
    {
        Refresh(); b.Draw(Game1.fadeToBlackRect, new Rectangle(0, 0, Game1.uiViewport.Width, Game1.uiViewport.Height), Color.Black * 0.7f);
        drawTextureBox(b, xPositionOnScreen, yPositionOnScreen, width, height, Color.White);
        Text(b, "Álbuns do vale", xPositionOnScreen + 30, yPositionOnScreen + 30, width - 430);
        Button(b, newButton, "Foto compartilhada"); Button(b, syncButton, "Sincronizar");
        if (selected != null) {
            var image = new Rectangle(xPositionOnScreen + 35, yPositionOnScreen + 100, width - 70, height - 300); DrawImage(b, selected.Photo, image);
            Text(b, selected.Photo?.Title ?? "Foto compartilhada", image.X, image.Bottom + 12, image.Width);
            Text(b, selected.Photo?.Description ?? string.Join(" & ", selected.Session!.PlayerNames), image.X, image.Bottom + 50, image.Width);
            if (selected.Session != null) { Text(b, Status(selected.Session), image.X, yPositionOnScreen + height - 145, image.Width, Color.DarkSlateBlue); if (selected.Session.Status == "capture-failed") Button(b, retryButton, "Tentar nova foto com a dupla"); }
            Text(b, "Esc: voltar ao álbum", xPositionOnScreen + 35, yPositionOnScreen + height - 50, 500);
        } else {
            for (int i = 0; i < collections.Count; i++) Button(b, tabBounds[i], collections[i].Label, i == collection);
            for (int i = 0; i < 6 && page * 6 + i < cards.Length; i++) {
                var card = cards[page * 6 + i]; var box = cardBounds[i]; drawTextureBox(b, box.X, box.Y, box.Width, box.Height, Color.White);
                DrawImage(b, card.Photo, new Rectangle(box.X + 10, box.Y + 10, box.Width - 20, box.Height - 92));
                Text(b, card.Photo?.Title ?? "Foto compartilhada", box.X + 10, box.Bottom - 75, box.Width - 20);
                if (card.Session != null) Text(b, card.Session.Status == "synchronized" ? "Sincronizada" : card.Session.Status == "capture-failed" ? "Falhou — abra para tentar" : "Pendente", box.X + 10, box.Bottom - 30, box.Width - 20, Color.DarkSlateBlue);
            }
            if (cards.Length == 0) Text(b, "As fotos aparecem aqui quando você vive uma lembrança. F9 pede uma foto das duas visões.", xPositionOnScreen + 65, yPositionOnScreen + 210, width - 130);
            Button(b, previousButton, "Anterior"); Button(b, nextButton, "Próxima");
            Text(b, (page + 1) + " / " + Math.Max(1, (cards.Length + 5) / 6) + "   F8: fechar · F9: pedir foto", xPositionOnScreen + 160, yPositionOnScreen + height - 50, width - 320);
        }
        base.draw(b); drawMouse(b);
    }
    public override void receiveLeftClick(int x, int y, bool playSound = true)
    {
        if (newButton.Contains(x, y)) { request(null); return; }
        if (syncButton.Contains(x, y)) { sync(); return; }
        if (selected != null) {
            if (selected.Session?.Status == "capture-failed" && retryButton.Contains(x, y)) request(selected.Session.PlayerIds.FirstOrDefault(id => id != Game1.player.UniqueMultiplayerID.ToString(System.Globalization.CultureInfo.InvariantCulture)));
        } else {
            for (int i = 0; i < tabBounds.Count; i++) if (tabBounds[i].Contains(x, y)) { collection = i; page = 0; version = -1; Refresh(); return; }
            if (previousButton.Contains(x, y)) { page = Math.Max(0, page - 1); return; }
            if (nextButton.Contains(x, y)) { page = Math.Min(Math.Max(0, (cards.Length - 1) / 6), page + 1); return; }
            for (int i = 0; i < cardBounds.Count; i++) if (cardBounds[i].Contains(x, y) && page * 6 + i < cards.Length) { selected = cards[page * 6 + i]; return; }
        }
        base.receiveLeftClick(x, y, playSound);
    }
    public override void receiveKeyPress(Keys key) { if (selected != null && key == Keys.Escape) { selected = null; return; } base.receiveKeyPress(key); }
    public override void receiveScrollWheelAction(int direction) { page = Math.Clamp(page + (direction > 0 ? -1 : 1), 0, Math.Max(0, (cards.Length - 1) / 6)); }
    public override void update(GameTime time) { if (textures.Count > 24) { foreach (var texture in textures.Values) texture.Dispose(); textures.Clear(); } base.update(time); }
    protected override void cleanupBeforeExit() { foreach (var texture in textures.Values) texture.Dispose(); textures.Clear(); base.cleanupBeforeExit(); }
    public override void gameWindowSizeChanged(Rectangle oldBounds, Rectangle newBounds) { Layout(); }
}
