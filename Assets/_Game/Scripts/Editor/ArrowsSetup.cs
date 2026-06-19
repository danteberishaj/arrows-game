using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Arrows.EditorTools
{
    /// <summary>
    /// One-shot project generator. Creates the Main scene (just a Bootstrap object),
    /// the level assets + database in Resources, configures Android player/build
    /// settings, and validates that every level is solvable.
    ///
    /// Run from the menu (Arrows > Setup Project) or headless:
    ///   Unity -batchmode -quit -projectPath . -executeMethod Arrows.EditorTools.ArrowsSetup.BuildAll
    /// </summary>
    public static class ArrowsSetup
    {
        private const string GameRoot = "Assets/_Game";
        private const string ScenesDir = GameRoot + "/Scenes";
        private const string ResourcesDir = GameRoot + "/Resources";
        private const string LevelsDir = ResourcesDir + "/Levels";
        private const string ScenePath = ScenesDir + "/Main.unity";
        private const string PackageId = "com.danteb.arrows";

        [MenuItem("Arrows/Setup Project")]
        public static void BuildAll()
        {
            EnsureFolders();
            var levels = CreateLevels();
            CreateDatabase(levels);
            CreateScene();
            ConfigurePlayerSettings();
            ConfigureBuildSettings();
            ValidateLevels(levels);

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            Debug.Log("[Arrows] Setup complete.");
        }

        // ---- Folders --------------------------------------------------------

        private static void EnsureFolders()
        {
            CreateFolder("Assets", "_Game");
            CreateFolder(GameRoot, "Scenes");
            CreateFolder(GameRoot, "Resources");
            CreateFolder(ResourcesDir, "Levels");
        }

        private static void CreateFolder(string parent, string name)
        {
            string path = parent + "/" + name;
            if (!AssetDatabase.IsValidFolder(path))
                AssetDatabase.CreateFolder(parent, name);
        }

        // ---- Levels ---------------------------------------------------------

        private struct LevelCfg
        {
            public int w, h, hearts, seed, minLen, maxLen;
            public float fill, bendChance;
            public LevelCfg(int w, int h, float fill, int minLen, int maxLen, float bendChance, int hearts, int seed)
            {
                this.w = w; this.h = h; this.fill = fill;
                this.minLen = minLen; this.maxLen = maxLen; this.bendChance = bendChance;
                this.hearts = hearts; this.seed = seed;
            }
        }

        // Dense, intertwined boards that ramp in size, arrow length, bendiness and fill.
        // Each is procedurally generated (see GenerateArrows) and guaranteed solvable by
        // construction. fill = fraction of cells covered; min/maxLen = arrow length range.
        private static readonly LevelCfg[] Configs =
        {
            new LevelCfg(5, 5, 0.55f, 1, 3, 0.25f, 5, 1001),
            new LevelCfg(5, 5, 0.68f, 1, 3, 0.30f, 5, 1002),
            new LevelCfg(6, 6, 0.60f, 2, 4, 0.35f, 5, 1003),
            new LevelCfg(6, 6, 0.72f, 2, 4, 0.40f, 4, 1004),
            new LevelCfg(7, 7, 0.62f, 2, 5, 0.40f, 4, 1005),
            new LevelCfg(7, 7, 0.72f, 2, 5, 0.45f, 4, 1006),
            new LevelCfg(8, 8, 0.66f, 3, 5, 0.45f, 4, 1007),
            new LevelCfg(8, 8, 0.76f, 3, 6, 0.50f, 3, 1008),
            new LevelCfg(9, 9, 0.70f, 3, 6, 0.50f, 3, 1009),
            new LevelCfg(9, 9, 0.78f, 3, 6, 0.55f, 3, 1010),
            new LevelCfg(9, 9, 0.84f, 3, 7, 0.55f, 3, 1011),
            new LevelCfg(9, 9, 0.90f, 3, 7, 0.60f, 3, 1012),
        };

        private static List<LevelData> CreateLevels()
        {
            // Clear any previously generated levels so re-running is idempotent.
            if (AssetDatabase.IsValidFolder(LevelsDir))
            {
                foreach (var guid in AssetDatabase.FindAssets("t:LevelData", new[] { LevelsDir }))
                    AssetDatabase.DeleteAsset(AssetDatabase.GUIDToAssetPath(guid));
            }

            var list = new List<LevelData>();
            for (int i = 0; i < Configs.Length; i++)
            {
                var cfg = Configs[i];
                var level = ScriptableObject.CreateInstance<LevelData>();
                level.hearts = cfg.hearts;
                var (rows, cols, arrowLines) = GenerateArrows(cfg);
                level.rows = rows;
                level.cols = cols;
                level.arrows = arrowLines;
                AssetDatabase.CreateAsset(level, $"{LevelsDir}/Level_{i + 1:00}.asset");
                list.Add(level);
            }
            return list;
        }

        /// <summary>
        /// Generates a dense, intertwined, guaranteed-solvable board of bent multi-cell
        /// arrows. Arrows are placed one at a time: each new arrow's HEAD is chosen so its
        /// straight runway to the edge is currently clear, then a bent body is grown
        /// backward into empty cells (biased to continue straight, occasionally turning).
        /// Because every head's runway was clear of all earlier arrows at placement time,
        /// an arrow can only ever be blocked by a LATER-placed one, so removing arrows in
        /// reverse placement order is always a valid solution. We stop at the target fill.
        /// </summary>
        private static (int rows, int cols, string[] arrows) GenerateArrows(LevelCfg cfg)
        {
            var rng = new System.Random(cfg.seed);
            var occ = new bool[cfg.h, cfg.w];
            var dirs = new[] { Direction.Up, Direction.Down, Direction.Left, Direction.Right };
            int target = Mathf.RoundToInt(cfg.w * cfg.h * cfg.fill);
            int count = 0;
            var lines = new List<string>();

            bool RayClear(int r, int c, Direction d)
            {
                var (dr, dc) = d.ToDelta();
                int rr = r + dr, cc = c + dc;
                while (rr >= 0 && rr < cfg.h && cc >= 0 && cc < cfg.w)
                {
                    if (occ[rr, cc]) return false;
                    rr += dr; cc += dc;
                }
                return true;
            }

            bool placedAny = true;
            while (placedAny && count < target)
            {
                placedAny = false;

                var empties = new List<(int r, int c)>();
                for (int r = 0; r < cfg.h; r++)
                    for (int c = 0; c < cfg.w; c++)
                        if (!occ[r, c]) empties.Add((r, c));
                Shuffle(empties, rng);

                foreach (var (hr, hc) in empties)
                {
                    if (count >= target) break;
                    if (occ[hr, hc]) continue; // already filled by a snake earlier this pass

                    // The head's facing direction must have a clear straight runway.
                    var headDirs = new List<Direction>();
                    foreach (var d in dirs)
                        if (RayClear(hr, hc, d)) headDirs.Add(d);
                    if (headDirs.Count == 0) continue;
                    var headDir = headDirs[rng.Next(headDirs.Count)];

                    // Place the head, then grow a bent body backward into empty cells.
                    occ[hr, hc] = true; count++;
                    var headFirst = new List<(int r, int c)> { (hr, hc) };
                    int targetLen = rng.Next(cfg.minLen, cfg.maxLen + 1);
                    var cur = (r: hr, c: hc);
                    Direction? lastStep = null;

                    while (headFirst.Count < targetLen && count < target)
                    {
                        var opts = new List<Direction>();
                        foreach (var sd in dirs)
                        {
                            if (sd == headDir) continue; // never grow ahead of the head
                            var (dr, dc) = sd.ToDelta();
                            int nr = cur.r + dr, nc = cur.c + dc;
                            if (nr < 0 || nr >= cfg.h || nc < 0 || nc >= cfg.w) continue;
                            if (occ[nr, nc]) continue;
                            opts.Add(sd);
                        }
                        if (opts.Count == 0) break;

                        Direction step =
                            (lastStep != null && opts.Contains(lastStep.Value) && rng.NextDouble() > cfg.bendChance)
                                ? lastStep.Value
                                : opts[rng.Next(opts.Count)];

                        var (sdr, sdc) = step.ToDelta();
                        cur = (cur.r + sdr, cur.c + sdc);
                        occ[cur.r, cur.c] = true; count++;
                        headFirst.Add((cur.r, cur.c));
                        lastStep = step;
                    }

                    // Serialize via ArrowPath (cells ordered tail -> head) to reuse ToLine.
                    var tailToHead = new List<(int, int)>(headFirst);
                    tailToHead.Reverse();
                    lines.Add(new ArrowPath(tailToHead, headDir).ToLine());
                    placedAny = true;
                }
            }

            return (cfg.h, cfg.w, lines.ToArray());
        }

        private static void Shuffle<T>(List<T> list, System.Random rng)
        {
            for (int i = list.Count - 1; i > 0; i--)
            {
                int j = rng.Next(i + 1);
                (list[i], list[j]) = (list[j], list[i]);
            }
        }

        private static void CreateDatabase(List<LevelData> levels)
        {
            const string dbPath = ResourcesDir + "/LevelDatabase.asset";
            var db = AssetDatabase.LoadAssetAtPath<LevelDatabase>(dbPath);
            if (db == null)
            {
                db = ScriptableObject.CreateInstance<LevelDatabase>();
                AssetDatabase.CreateAsset(db, dbPath);
            }
            db.levels = levels.ToArray();
            EditorUtility.SetDirty(db);
        }

        // ---- Scene ----------------------------------------------------------

        private static void CreateScene()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var go = new GameObject("Bootstrap");
            go.AddComponent<Bootstrap>();
            EditorSceneManager.SaveScene(scene, ScenePath);
        }

        // ---- Settings -------------------------------------------------------

        private static void ConfigurePlayerSettings()
        {
            PlayerSettings.companyName = "DanteB";
            PlayerSettings.productName = "Arrows";
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, PackageId);

            PlayerSettings.defaultInterfaceOrientation = UIOrientation.Portrait;

            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel26;
            PlayerSettings.Android.targetSdkVersion = AndroidSdkVersions.AndroidApiLevelAuto;
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
        }

        private static void ConfigureBuildSettings()
        {
            EditorBuildSettings.scenes = new[]
            {
                new EditorBuildSettingsScene(ScenePath, true)
            };

            if (BuildPipeline.IsBuildTargetSupported(BuildTargetGroup.Android, BuildTarget.Android))
            {
                if (EditorUserBuildSettings.activeBuildTarget != BuildTarget.Android)
                    EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Android, BuildTarget.Android);
            }
            else
            {
                Debug.LogWarning("[Arrows] Android Build Support module not installed - " +
                    "skipping build-target switch. Install it via Unity Hub to build the APK.");
            }
        }

        // ---- Validation -----------------------------------------------------

        private static void ValidateLevels(List<LevelData> levels)
        {
            for (int i = 0; i < levels.Count; i++)
            {
                var board = levels[i].CreateBoard();
                if (!SolveGreedy(board))
                    Debug.LogWarning($"[Arrows] Level {i + 1} is NOT solvable (deadlock). " +
                        $"{board.Count()} arrow(s) cannot exit.");
            }
        }

        private static bool SolveGreedy(BoardLogic board)
        {
            bool progress = true;
            while (progress && !board.IsCleared())
            {
                progress = false;
                foreach (var arrow in board.Arrows().ToList())
                {
                    if (board.TryRemove(arrow)) { progress = true; break; }
                }
            }
            return board.IsCleared();
        }
    }
}
