using System.Collections.Generic;
using UnityEngine;

namespace Arrows
{
    /// <summary>
    /// Builds and runs a single puzzle board: instantiates one ArrowTile per
    /// <see cref="ArrowPath"/>, routes taps through BoardLogic, animates results, and
    /// reports heart loss / completion back to the GameManager. The board is laid out at a
    /// fixed cell size into a zoomable Content rect (see <see cref="BoardPanZoom"/>), so it
    /// can be much larger than the screen and the player zooms / pans to read it.
    /// </summary>
    public class BoardManager : MonoBehaviour
    {
        // Fixed layout cell size; the whole board is then scaled to fit by BoardPanZoom.
        private const float BaseCell = 110f;

        [SerializeField] private RectTransform boardRoot; // the zoomable Content

        private GameManager _game;
        private AudioManager _audio;
        private BoardPanZoom _panZoom;
        private BoardLogic _logic;
        private readonly Dictionary<ArrowPath, ArrowTile> _tiles = new();
        private float _cellSize = BaseCell;
        private bool _inputLocked;

        public void Configure(GameManager game, AudioManager audio, RectTransform content, BoardPanZoom panZoom)
        {
            _game = game;
            _audio = audio;
            boardRoot = content;
            _panZoom = panZoom;
        }

        public void LoadBoard(BoardLogic logic)
        {
            ClearTiles();
            UIFactory.ClearArrowPathCache(); // free the previous level's baked shapes
            _inputLocked = false;
            _logic = logic;

            int rows = _logic.Rows;
            int cols = _logic.Cols;
            if (rows == 0 || cols == 0) return;

            _cellSize = BaseCell;
            boardRoot.sizeDelta = new Vector2(cols * _cellSize, rows * _cellSize);

            foreach (var arrow in _logic.Arrows())
                CreateTile(arrow);

            if (_panZoom != null) _panZoom.Fit(); // fit-to-view, centred
        }

        private void CreateTile(ArrowPath arrow)
        {
            var go = UIFactory.NewUIObject("Arrow", boardRoot);
            var rt = go.GetComponent<RectTransform>();
            rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);

            // Centre the tile on the arrow's bounding box so every cell lands on the grid.
            float centerRow = (arrow.MinRow + arrow.MaxRow) / 2f;
            float centerCol = (arrow.MinCol + arrow.MaxCol) / 2f;
            rt.anchoredPosition = CellToLocal(centerRow, centerCol);

            var tile = go.AddComponent<ArrowTile>();
            tile.Init(this, arrow, _cellSize);
            _tiles[arrow] = tile;
        }

        private Vector2 CellToLocal(float r, float c)
        {
            float x = (c - (_logic.Cols - 1) / 2f) * _cellSize;
            float y = ((_logic.Rows - 1) / 2f - r) * _cellSize;
            return new Vector2(x, y);
        }

        public void OnArrowTapped(ArrowTile tile)
        {
            // Ignore taps while the player is panning / pinching the board.
            if (_inputLocked || (_panZoom != null && _panZoom.IsGesturing)) return;

            var arrow = tile.Arrow;
            if (_logic.TryRemove(arrow))
            {
                _tiles.Remove(arrow);
                _audio?.PlaySuccess();

                SpawnSlither(arrow);       // flowing trail that retraces the bent path head-first
                Destroy(tile.gameObject);  // the static arrow is replaced by the trail

                if (_logic.IsCleared())
                {
                    _inputLocked = true;
                    _game.OnLevelCleared();
                }
            }
            else
            {
                _audio?.PlayFail();
                StartCoroutine(tile.PlayShake());
                _game.OnHeartLost();
            }
        }

        /// <summary>
        /// Builds the arrow's centerline (cell centers, tail -> head) plus a straight
        /// continuation off the board in the head direction, and hands it to a SlitherExit
        /// to animate the flowing trail.
        /// </summary>
        private void SpawnSlither(ArrowPath arrow)
        {
            var pts = new List<Vector2>(arrow.Length + 8);
            foreach (var (r, c) in arrow.Cells)           // tail -> head
                pts.Add(CellToLocal(r, c));

            var (dr, dc) = arrow.HeadDir.ToDelta();
            Vector2 step = new Vector2(dc, -dr) * _cellSize; // one cell along the head direction
            Vector2 head = pts[pts.Count - 1];
            int ext = Mathf.Max(_logic.Rows, _logic.Cols) + 3;
            for (int k = 1; k <= ext; k++)
                pts.Add(head + step * k);

            var go = UIFactory.NewUIObject("Slither", boardRoot);
            var rt = go.GetComponent<RectTransform>();
            rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = Vector2.zero;
            go.AddComponent<SlitherExit>().Play(pts, (arrow.Length - 1) * _cellSize, _cellSize, GameManager.Palette.Ink);
        }

        /// <summary>
        /// Finds a safe next move and draws attention to it: centres the board on the arrow
        /// (so it's on-screen even when zoomed) and pulses it in the accent colour. The arrow
        /// stays tappable — the player still makes the move themselves.
        /// </summary>
        public void ShowHint()
        {
            if (_inputLocked || _logic == null) return;
            var arrow = _logic.FindHint();
            if (arrow == null) return;
            if (!_tiles.TryGetValue(arrow, out var tile) || tile == null) return;

            float centerRow = (arrow.MinRow + arrow.MaxRow) / 2f;
            float centerCol = (arrow.MinCol + arrow.MaxCol) / 2f;
            if (_panZoom != null) _panZoom.FocusOn(CellToLocal(centerRow, centerCol));
            tile.Highlight();
        }

        public void LockInput() => _inputLocked = true;

        public void ClearTiles()
        {
            foreach (var t in _tiles.Values)
                if (t != null) Destroy(t.gameObject);
            _tiles.Clear();

            // Also destroy any stray children (e.g. tiles mid-exit-animation).
            if (boardRoot != null)
                for (int i = boardRoot.childCount - 1; i >= 0; i--)
                    Destroy(boardRoot.GetChild(i).gameObject);
        }
    }
}
