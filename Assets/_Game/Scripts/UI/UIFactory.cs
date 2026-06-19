using System;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.UI;

namespace Arrows
{
    /// <summary>
    /// Helpers for building the entire UI procedurally (no prefabs / no hand-authored
    /// scene), plus runtime generation of the flat sprites we need (black line-art
    /// arrows, hearts, the logo triangle, the restart glyph, dots and rounded rects).
    /// Shapes are baked as white coverage in the alpha channel and tinted via
    /// <see cref="Image.color"/>, so the same arrow sprite can render black normally and
    /// flash red when blocked. Keeping art in code means we ship almost no binary assets
    /// (the one exception is the bundled rounded font).
    /// </summary>
    public static class UIFactory
    {
        private static Font _font;
        private static Sprite _roundedSprite;
        private static Sprite _dotSprite;
        private static Sprite _heartSprite;
        private static Sprite _triangleSprite;
        private static Sprite _restartSprite;

        // Generated bent-arrow sprites, keyed by shape, so repeated arrow shapes on a
        // dense board bake only once. The cache owns the textures; ClearArrowPathCache
        // frees them (called per level load to bound memory).
        private static readonly Dictionary<string, ArrowPathSprite> _pathCache = new();

        public static Font Font
        {
            get
            {
                if (_font == null)
                {
                    // Bundled rounded sans (Fredoka, SIL OFL) to match the reference game's
                    // friendly type; falls back to the built-in font if it failed to import.
                    _font = Resources.Load<Font>("Fonts/Fredoka");
                    if (_font == null) _font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
                }
                return _font;
            }
        }

        public static Sprite RoundedSprite
        {
            get { if (_roundedSprite == null) _roundedSprite = GenerateRoundedRect(64, 16); return _roundedSprite; }
        }

        /// <summary>Solid filled circle (white). Tint via color. Used for dots and round buttons.</summary>
        public static Sprite DotSprite
        {
            get { if (_dotSprite == null) _dotSprite = Rasterize(64, 3, (nx, ny) => nx * nx + ny * ny <= 0.94f * 0.94f); return _dotSprite; }
        }

        /// <summary>Filled heart (white), point down, lobes up. Tint via color.</summary>
        public static Sprite HeartSprite
        {
            get { if (_heartSprite == null) _heartSprite = Rasterize(96, 3, HeartInside); return _heartSprite; }
        }

        /// <summary>Filled triangle (white) pointing up. Used as the logo "A" and the back glyph.</summary>
        public static Sprite TriangleSprite
        {
            get { if (_triangleSprite == null) _triangleSprite = Rasterize(64, 3, TriangleInside); return _triangleSprite; }
        }

        /// <summary>Circular-arrow "restart" glyph (white). Tint via color.</summary>
        public static Sprite RestartSprite
        {
            get { if (_restartSprite == null) _restartSprite = Rasterize(96, 3, RestartInside); return _restartSprite; }
        }

        // ---- Layout helpers -------------------------------------------------

        public static RectTransform FullStretch(RectTransform rt)
        {
            rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one;
            rt.offsetMin = Vector2.zero; rt.offsetMax = Vector2.zero;
            return rt;
        }

        public static GameObject NewUIObject(string name, Transform parent)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            return go;
        }

        public static Image CreatePanel(string name, Transform parent, Color color, bool stretch = true)
        {
            var go = NewUIObject(name, parent);
            var img = go.AddComponent<Image>();
            img.sprite = RoundedSprite;
            img.type = Image.Type.Sliced;
            img.color = color;
            if (stretch) FullStretch(go.GetComponent<RectTransform>());
            return img;
        }

        /// <summary>Simple (non-interactive) image with a generated sprite, tinted by color.</summary>
        public static Image CreateImage(string name, Transform parent, Sprite sprite, Color color, bool raycast = false)
        {
            var go = NewUIObject(name, parent);
            var img = go.AddComponent<Image>();
            img.sprite = sprite;
            img.color = color;
            img.preserveAspect = true;
            img.raycastTarget = raycast;
            return img;
        }

        public static Text CreateText(string name, Transform parent, string content, int fontSize,
            Color color, TextAnchor anchor = TextAnchor.MiddleCenter, FontStyle style = FontStyle.Normal)
        {
            var go = NewUIObject(name, parent);
            var text = go.AddComponent<Text>();
            text.font = Font;
            text.fontStyle = style;
            text.text = content;
            text.fontSize = fontSize;
            text.color = color;
            text.alignment = anchor;
            text.horizontalOverflow = HorizontalWrapMode.Overflow;
            text.verticalOverflow = VerticalWrapMode.Overflow;
            text.raycastTarget = false;
            return text;
        }

        public static Button CreateButton(string name, Transform parent, string label, Color bg, Color fg,
            int fontSize = 44, bool bold = false)
        {
            var go = NewUIObject(name, parent);
            var img = go.AddComponent<Image>();
            img.sprite = RoundedSprite;
            img.type = Image.Type.Sliced;
            img.color = bg;

            var btn = go.AddComponent<Button>();
            btn.targetGraphic = img;
            var colors = btn.colors;
            colors.normalColor = Color.white;
            colors.highlightedColor = new Color(1f, 1f, 1f, 1f);
            colors.pressedColor = new Color(0.88f, 0.88f, 0.88f, 1f);
            colors.selectedColor = Color.white;
            colors.fadeDuration = 0.08f;
            btn.colors = colors;

            var text = CreateText("Label", go.transform, label, fontSize, fg, TextAnchor.MiddleCenter,
                bold ? FontStyle.Bold : FontStyle.Normal);
            FullStretch(text.GetComponent<RectTransform>());
            return btn;
        }

        // True capsule (pill) sprites, cached by pixel size so repeated buttons don't re-bake.
        private static readonly Dictionary<long, Sprite> _capsuleCache = new();

        private static Sprite CapsuleSprite(int w, int h)
        {
            long key = ((long)w << 20) | (uint)h;
            if (_capsuleCache.TryGetValue(key, out var s)) return s;
            float r = h / 2f;
            s = Rasterize(w, h, 2, (x, y) =>
            {
                if (x < r) return (x - r) * (x - r) + (y - r) * (y - r) <= r * r;
                if (x > w - r) return (x - (w - r)) * (x - (w - r)) + (y - r) * (y - r) <= r * r;
                return true; // middle band spans full height
            });
            _capsuleCache[key] = s;
            return s;
        }

        /// <summary>Primary "pill" button — a true capsule (matches the reference Play button).</summary>
        public static Button CreatePillButton(string name, Transform parent, string label, Color bg, Color fg,
            float width, float height, int fontSize = 52, bool bold = true)
        {
            var go = NewUIObject(name, parent);
            go.GetComponent<RectTransform>().sizeDelta = new Vector2(width, height);

            var img = go.AddComponent<Image>();
            img.sprite = CapsuleSprite(Mathf.RoundToInt(width), Mathf.RoundToInt(height));
            img.type = Image.Type.Simple;
            img.color = bg;

            var btn = go.AddComponent<Button>();
            btn.targetGraphic = img;
            var colors = btn.colors;
            colors.normalColor = Color.white;
            colors.pressedColor = new Color(0.9f, 0.9f, 0.9f, 1f);
            colors.fadeDuration = 0.08f;
            btn.colors = colors;

            var text = CreateText("Label", go.transform, label, fontSize, fg, TextAnchor.MiddleCenter,
                bold ? FontStyle.Bold : FontStyle.Normal);
            FullStretch(text.GetComponent<RectTransform>());
            return btn;
        }

        /// <summary>
        /// A round, lavender-surfaced button with a tinted icon glyph (back / restart), as
        /// in the reference game's gameplay header.
        /// </summary>
        public static Button CreateRoundButton(string name, Transform parent, Sprite icon, Color bg, Color iconColor,
            float size, float iconScale = 0.5f, float iconRotation = 0f)
        {
            var go = NewUIObject(name, parent);
            var rt = go.GetComponent<RectTransform>();
            rt.sizeDelta = new Vector2(size, size);

            var img = go.AddComponent<Image>();
            img.sprite = DotSprite;     // filled circle
            img.color = bg;

            var btn = go.AddComponent<Button>();
            btn.targetGraphic = img;
            var colors = btn.colors;
            colors.normalColor = Color.white;
            colors.pressedColor = new Color(0.9f, 0.9f, 0.9f, 1f);
            colors.fadeDuration = 0.08f;
            btn.colors = colors;

            var glyph = CreateImage("Icon", go.transform, icon, iconColor);
            var grt = glyph.rectTransform;
            grt.anchorMin = grt.anchorMax = new Vector2(0.5f, 0.5f);
            grt.sizeDelta = new Vector2(size * iconScale, size * iconScale);
            grt.localRotation = Quaternion.Euler(0, 0, iconRotation);
            return btn;
        }

        // ---- Arrow line-art -------------------------------------------------

        private static float DistToSegment(Vector2 p, Vector2 a, Vector2 b)
        {
            Vector2 ab = b - a;
            float denom = Vector2.Dot(ab, ab);
            float t = denom > 1e-6f ? Mathf.Clamp01(Vector2.Dot(p - a, ab) / denom) : 0f;
            return (p - (a + ab * t)).magnitude;
        }

        // Chaikin corner-cutting: rounds the interior bends of an open polyline while keeping
        // the two endpoints fixed (so the tail and arrowhead stay aligned). Each pass replaces
        // every corner with two points at 1/4 and 3/4 of its edges, smoothing the 90° turns.
        private static List<Vector2> RoundCorners(List<Vector2> pts, int iterations)
        {
            for (int it = 0; it < iterations && pts.Count >= 3; it++)
            {
                var outPts = new List<Vector2>(pts.Count * 2) { pts[0] };
                for (int i = 0; i < pts.Count - 1; i++)
                {
                    outPts.Add(Vector2.Lerp(pts[i], pts[i + 1], 0.25f));
                    outPts.Add(Vector2.Lerp(pts[i], pts[i + 1], 0.75f));
                }
                outPts.Add(pts[pts.Count - 1]);
                pts = outPts;
            }
            return pts;
        }

        /// <summary>A generated bent-arrow sprite plus its footprint in grid-cell units.</summary>
        public struct ArrowPathSprite
        {
            public Sprite Sprite;
            public Vector2 SizeCells; // RectTransform size in cells (incl. padding)
        }

        // Pixels per grid cell in generated arrow textures, and the margin (in cells) added
        // on every side so rounded caps / the arrowhead aren't clipped at the texture edge.
        private const int ArrowCellPx = 100;
        public const float ArrowPadCells = 0.4f;

        /// <summary>
        /// Generates a flat black-style line-art sprite for a multi-cell bent arrow: a
        /// rounded-cap polyline through the cell centers ending in a solid filled triangular
        /// arrowhead (matching the reference game). Baked as white coverage in alpha so the
        /// caller tints it (black normally, red when blocked). The sprite is sized to the
        /// arrow's bounding box plus a margin; SizeCells lets the caller match it to the
        /// board's cell size. Shapes are cached and shared; ClearArrowPathCache frees them.
        /// </summary>
        public static ArrowPathSprite GenerateArrowPathSprite(IReadOnlyList<(int r, int c)> cells, Direction headDir)
        {
            string key = ShapeKey(cells, headDir);
            if (_pathCache.TryGetValue(key, out var cached)) return cached;

            int minR = int.MaxValue, maxR = int.MinValue, minC = int.MaxValue, maxC = int.MinValue;
            foreach (var (r, c) in cells)
            {
                if (r < minR) minR = r; if (r > maxR) maxR = r;
                if (c < minC) minC = c; if (c > maxC) maxC = c;
            }
            int rowSpan = maxR - minR + 1, colSpan = maxC - minC + 1;
            float pad = ArrowCellPx * ArrowPadCells;
            int W = Mathf.RoundToInt(colSpan * ArrowCellPx + 2 * pad);
            int H = Mathf.RoundToInt(rowSpan * ArrowCellPx + 2 * pad);

            // Grid row 0 is the TOP of the board; texture y is bottom-up, so flip rows.
            Vector2 Center(int r, int c) => new Vector2(
                pad + ((c - minC) + 0.5f) * ArrowCellPx,
                H - pad - ((r - minR) + 0.5f) * ArrowCellPx);

            Vector2 dirVec = headDir switch
            {
                Direction.Up => new Vector2(0f, 1f),
                Direction.Down => new Vector2(0f, -1f),
                Direction.Left => new Vector2(-1f, 0f),
                Direction.Right => new Vector2(1f, 0f),
                _ => Vector2.up
            };
            Vector2 perp = new Vector2(-dirVec.y, dirVec.x);

            // Head + stroke geometry as fractions of a cell.
            float tipExt = 0.50f * ArrowCellPx;    // head cell center -> arrowhead tip
            float headLen = 0.42f * ArrowCellPx;   // arrowhead length (tip -> base)
            float headHalf = 0.27f * ArrowCellPx;  // arrowhead half-width at its base
            float tailExt = 0.42f * ArrowCellPx;   // rounded tail reaching past the first cell

            int n = cells.Count;
            Vector2 headCenter = Center(cells[n - 1].r, cells[n - 1].c);
            Vector2 tip = headCenter + dirVec * tipExt;
            Vector2 baseBack = tip - dirVec * headLen;            // where the shaft meets the head
            Vector2 baseL = baseBack + perp * headHalf;
            Vector2 baseR = baseBack - perp * headHalf;

            // Build the centerline (tail end -> head base) as a point list, then round the
            // 90° bends so the path curves smoothly through them (matching the reference).
            var pts = new List<Vector2>(n + 2);
            if (n == 1)
            {
                pts.Add(headCenter - dirVec * tailExt); // shaft through the single cell
                pts.Add(baseBack);
            }
            else
            {
                Vector2 p0 = Center(cells[0].r, cells[0].c);
                Vector2 p1 = Center(cells[1].r, cells[1].c);
                pts.Add(p0 + (p0 - p1).normalized * tailExt); // rounded tail reaching past the first cell
                for (int i = 0; i < n; i++) pts.Add(Center(cells[i].r, cells[i].c));
                pts.Add(baseBack);                            // straight shaft into the head base
            }
            pts = RoundCorners(pts, 2);

            var segs = new List<(Vector2 a, Vector2 b)>(pts.Count);
            for (int i = 0; i < pts.Count - 1; i++)
                segs.Add((pts[i], pts[i + 1]));

            const float halfStroke = 0.072f * ArrowCellPx; // a touch bolder for an even, confident line
            const float edge = 1.75f;

            var px = new Color32[W * H];
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++)
                {
                    var p = new Vector2(x + 0.5f, y + 0.5f);
                    float d = float.MaxValue;
                    foreach (var s in segs) d = Mathf.Min(d, DistToSegment(p, s.a, s.b));
                    float stroke = Mathf.Clamp01(Mathf.InverseLerp(halfStroke + edge, halfStroke - edge, d));
                    float head = TriangleCoverage(p, tip, baseL, baseR, edge);
                    float cov = Mathf.Max(stroke, head);
                    px[y * W + x] = new Color32(255, 255, 255, (byte)(cov * 255));
                }

            var tex = MakeTex(px, W, H, mip: true); // mipmaps => consistent strokes when the board scales down
            var sprite = Sprite.Create(tex, new Rect(0, 0, W, H), new Vector2(0.5f, 0.5f), 100f);

            var result = new ArrowPathSprite
            {
                Sprite = sprite,
                SizeCells = new Vector2(colSpan + 2 * ArrowPadCells, rowSpan + 2 * ArrowPadCells)
            };
            _pathCache[key] = result;
            return result;
        }

        // Shape signature: head direction + cell offsets normalized to the bounding box,
        // in order. Identical shapes (common on dense boards) share one baked sprite.
        private static string ShapeKey(IReadOnlyList<(int r, int c)> cells, Direction headDir)
        {
            int minR = int.MaxValue, minC = int.MaxValue;
            foreach (var (r, c) in cells)
            {
                if (r < minR) minR = r;
                if (c < minC) minC = c;
            }
            var sb = new StringBuilder();
            sb.Append((int)headDir).Append(':');
            foreach (var (r, c) in cells)
                sb.Append(r - minR).Append(',').Append(c - minC).Append(';');
            return sb.ToString();
        }

        /// <summary>Destroys all cached bent-arrow sprites/textures. Call on level load.</summary>
        public static void ClearArrowPathCache()
        {
            foreach (var entry in _pathCache.Values)
            {
                var sprite = entry.Sprite;
                if (sprite == null) continue;
                var tex = sprite.texture;
                UnityEngine.Object.Destroy(sprite);
                if (tex != null) UnityEngine.Object.Destroy(tex);
            }
            _pathCache.Clear();
        }

        // ---- Procedural shape sprites --------------------------------------

        // Anti-aliased coverage of a triangle at point p (supersample-free: signed distance).
        private static float TriangleCoverage(Vector2 p, Vector2 a, Vector2 b, Vector2 c, float edge)
        {
            float s1 = Cross(p, a, b), s2 = Cross(p, b, c), s3 = Cross(p, c, a);
            bool inside = (s1 <= 0 && s2 <= 0 && s3 <= 0) || (s1 >= 0 && s2 >= 0 && s3 >= 0);
            float dEdge = Mathf.Min(DistToSegment(p, a, b), Mathf.Min(DistToSegment(p, b, c), DistToSegment(p, c, a)));
            float sd = inside ? -dEdge : dEdge;             // signed distance to the boundary
            return Mathf.Clamp01((edge - sd) / (2f * edge));
        }

        private static float Cross(Vector2 p, Vector2 a, Vector2 b)
            => (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y);

        // Rasterize a white shape from an inside(x,y) predicate in pixel space (W x H),
        // supersampled ss*ss for smooth edges. Alpha = coverage, rgb = white.
        private static Sprite Rasterize(int W, int H, int ss, Func<float, float, bool> insidePx)
        {
            var px = new Color32[W * H];
            float inv = 1f / ss;
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++)
                {
                    int hits = 0;
                    for (int sy = 0; sy < ss; sy++)
                        for (int sx = 0; sx < ss; sx++)
                            if (insidePx(x + (sx + 0.5f) * inv, y + (sy + 0.5f) * inv)) hits++;
                    px[y * W + x] = new Color32(255, 255, 255, (byte)(255 * hits / (ss * ss)));
                }
            return Sprite.Create(MakeTex(px, W, H, mip: true), new Rect(0, 0, W, H), new Vector2(0.5f, 0.5f), 100f);
        }

        // Rasterize a white shape from an inside(nx,ny) predicate in normalized [-1,1] space
        // (y up), supersampled ss*ss for smooth edges. Alpha = coverage, rgb = white.
        private static Sprite Rasterize(int S, int ss, Func<float, float, bool> inside)
        {
            var px = new Color32[S * S];
            float inv = 1f / (S * ss);
            for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                {
                    int hits = 0;
                    for (int sy = 0; sy < ss; sy++)
                        for (int sx = 0; sx < ss; sx++)
                        {
                            float nx = ((x * ss + sx + 0.5f) * inv) * 2f - 1f;
                            float ny = ((y * ss + sy + 0.5f) * inv) * 2f - 1f;
                            if (inside(nx, ny)) hits++;
                        }
                    byte a = (byte)(255 * hits / (ss * ss));
                    px[y * S + x] = new Color32(255, 255, 255, a);
                }
            return Sprite.Create(MakeTex(px, S, S, mip: true), new Rect(0, 0, S, S), new Vector2(0.5f, 0.5f), 100f);
        }

        // Builds a texture from white-coverage pixels. With mip=true it generates a mip chain
        // and samples trilinear, so sprites stay clean and consistent when scaled down (the
        // board is fit-to-view, often minified) instead of aliasing into uneven strokes.
        private static Texture2D MakeTex(Color32[] px, int w, int h, bool mip)
        {
            var tex = new Texture2D(w, h, TextureFormat.RGBA32, mip)
            {
                filterMode = mip ? FilterMode.Trilinear : FilterMode.Bilinear,
                anisoLevel = mip ? 4 : 1,
                wrapMode = TextureWrapMode.Clamp,
            };
            tex.SetPixels32(px);
            tex.Apply(updateMipmaps: mip);
            return tex;
        }

        private static bool HeartInside(float nx, float ny)
        {
            // Classic heart implicit curve, mapped to fill the sprite (point down, lobes up).
            float x = nx * 1.15f;
            float y = ny * 1.15f - 0.15f;
            float a = x * x + y * y - 1f;
            return a * a * a - x * x * y * y * y <= 0f;
        }

        private static bool TriangleInside(float nx, float ny)
        {
            var p = new Vector2(nx, ny);
            var a = new Vector2(0f, 0.86f);
            var b = new Vector2(-0.82f, -0.7f);
            var c = new Vector2(0.82f, -0.7f);
            float s1 = Cross(p, a, b), s2 = Cross(p, b, c), s3 = Cross(p, c, a);
            return (s1 <= 0 && s2 <= 0 && s3 <= 0) || (s1 >= 0 && s2 >= 0 && s3 >= 0);
        }

        private static bool RestartInside(float nx, float ny)
        {
            float r = Mathf.Sqrt(nx * nx + ny * ny);
            float theta = Mathf.Atan2(ny, nx);             // (-pi, pi]
            const float ringR = 0.60f, ringT = 0.135f;
            // Ring everywhere except a gap on the right where the arrowhead sits.
            bool ring = Mathf.Abs(r - ringR) <= ringT && !(theta > -0.87f && theta < 0.35f);
            // Arrowhead at the upper end of the gap, pointing clockwise (down) into it.
            var E = new Vector2(Mathf.Cos(0.35f), Mathf.Sin(0.35f)) * ringR;
            var radial = new Vector2(Mathf.Cos(0.35f), Mathf.Sin(0.35f));
            var tan = new Vector2(Mathf.Sin(0.35f), -Mathf.Cos(0.35f)); // clockwise tangent
            var apex = E + tan * 0.34f;
            var b1 = E + radial * 0.22f;
            var b2 = E - radial * 0.22f;
            var p = new Vector2(nx, ny);
            float s1 = Cross(p, apex, b1), s2 = Cross(p, b1, b2), s3 = Cross(p, b2, apex);
            bool headTri = (s1 <= 0 && s2 <= 0 && s3 <= 0) || (s1 >= 0 && s2 >= 0 && s3 >= 0);
            return ring || headTri;
        }

        private static Sprite GenerateRoundedRect(int size, int radius)
        {
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false) { filterMode = FilterMode.Bilinear };
            var px = new Color32[size * size];
            for (int y = 0; y < size; y++)
                for (int x = 0; x < size; x++)
                {
                    bool inside = true;
                    int dx = -1, dy = -1;
                    if (x < radius && y < radius) { dx = radius - x; dy = radius - y; }
                    else if (x >= size - radius && y < radius) { dx = x - (size - radius - 1); dy = radius - y; }
                    else if (x < radius && y >= size - radius) { dx = radius - x; dy = y - (size - radius - 1); }
                    else if (x >= size - radius && y >= size - radius) { dx = x - (size - radius - 1); dy = y - (size - radius - 1); }
                    if (dx >= 0) inside = (dx * dx + dy * dy) <= radius * radius;
                    px[y * size + x] = inside ? new Color32(255, 255, 255, 255) : new Color32(255, 255, 255, 0);
                }
            tex.SetPixels32(px);
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f,
                0, SpriteMeshType.FullRect, new Vector4(radius, radius, radius, radius));
        }
    }
}
