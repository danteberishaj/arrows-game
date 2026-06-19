using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace Arrows.EditorTools
{
    /// <summary>
    /// Headless Android APK build. Run with:
    ///   Unity -batchmode -quit -projectPath . -executeMethod Arrows.EditorTools.ArrowsBuild.BuildApk
    ///
    /// Produces a debug-signed APK (Unity's auto debug keystore) suitable for
    /// sideloading to a device via `adb install`. Store signing / AAB comes later.
    /// </summary>
    public static class ArrowsBuild
    {
        private const string OutputDir = "Builds/Android";
        private const string ApkPath = OutputDir + "/Arrows.apk";
        private const string ScenePath = "Assets/_Game/Scenes/Main.unity";

        [MenuItem("Arrows/Build Android APK")]
        public static void BuildApk()
        {
            Directory.CreateDirectory(OutputDir);

            // Make sure Android is the active target and the APK includes x86_64
            // (Android emulators are x86_64) as well as ARM64 (physical phones).
            if (EditorUserBuildSettings.activeBuildTarget != BuildTarget.Android)
                EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Android, BuildTarget.Android);
            PlayerSettings.Android.targetArchitectures =
                AndroidArchitecture.ARM64 | AndroidArchitecture.X86_64;

            var devFlag = System.Environment.GetEnvironmentVariable("ARROWS_DEV_BUILD") == "1"
                ? (BuildOptions.Development | BuildOptions.AllowDebugging)
                : BuildOptions.None;

            var options = new BuildPlayerOptions
            {
                scenes = new[] { ScenePath },
                locationPathName = ApkPath,
                target = BuildTarget.Android,
                targetGroup = BuildTargetGroup.Android,
                options = devFlag,
            };

            BuildReport report = BuildPipeline.BuildPlayer(options);
            BuildSummary summary = report.summary;

            if (summary.result == BuildResult.Succeeded)
            {
                Debug.Log($"[Arrows] APK build SUCCEEDED: {ApkPath} " +
                          $"({summary.totalSize / (1024 * 1024)} MB, {summary.totalTime.TotalSeconds:F0}s)");
            }
            else
            {
                Debug.LogError($"[Arrows] APK build FAILED: {summary.result} " +
                               $"({summary.totalErrors} error(s))");
                if (Application.isBatchMode)
                    EditorApplication.Exit(1);
            }
        }
    }
}
