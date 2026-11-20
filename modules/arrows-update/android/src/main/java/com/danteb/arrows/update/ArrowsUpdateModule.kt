package com.danteb.arrows.update

import android.os.Handler
import android.os.Looper
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.appupdate.testing.FakeAppUpdateManager
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * UPDATE-PROMPT: a thin bridge to Play In-App Updates (flexible flow only). JS decides when to ask and draws the
 * Buddy card; Play owns the confirmation, the background download and the install. Every call settles its promise
 * (Play failures reject, so JS can stay quiet) and never throws across the bridge.
 *
 * QA (`fake = true` on the first check): FakeAppUpdateManager reports an update and, once the flow starts, plays
 * accept -> download -> downloaded over ~2 s so the card and the restart chip can be exercised on a sideloaded build.
 */
class ArrowsUpdateModule : Module() {
  private var manager: AppUpdateManager? = null
  private var fake: FakeAppUpdateManager? = null
  private val main = Handler(Looper.getMainLooper())
  private val listener = InstallStateUpdatedListener { state ->
    sendEvent("onState", mapOf("status" to statusName(state.installStatus())))
  }

  override fun definition() = ModuleDefinition {
    Name("ArrowsUpdate")
    Events("onState")

    AsyncFunction("check") { useFake: Boolean, promise: Promise ->
      val m = manager(useFake) ?: return@AsyncFunction promise.reject("E_NO_CONTEXT", "no context", null)
      m.appUpdateInfo
        .addOnSuccessListener { info ->
          promise.resolve(mapOf(
            "available" to (info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE),
            "flexibleAllowed" to info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE),
            "versionCode" to info.availableVersionCode(),
            "installStatus" to statusName(info.installStatus()),
          ))
        }
        .addOnFailureListener { e -> promise.reject("E_UPDATE_CHECK", e.message ?: "check failed", e) }
    }

    AsyncFunction("startFlexible") { promise: Promise ->
      val m = manager ?: return@AsyncFunction promise.resolve(false)
      val activity = appContext.currentActivity ?: return@AsyncFunction promise.resolve(false)
      m.appUpdateInfo
        .addOnSuccessListener { info ->
          val ok = info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE &&
            info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)
          val started = ok && try {
            m.startUpdateFlowForResult(info, activity, AppUpdateOptions.defaultOptions(AppUpdateType.FLEXIBLE), REQUEST_CODE)
          } catch (e: Exception) { false }
          promise.resolve(started)
          if (started) fake?.let { f ->
            main.postDelayed({ f.userAcceptsUpdate(); f.downloadStarts() }, 300)
            main.postDelayed({ f.downloadCompletes() }, 2000)
          }
        }
        .addOnFailureListener { promise.resolve(false) }
    }

    AsyncFunction("completeUpdate") { promise: Promise ->
      val m = manager ?: return@AsyncFunction promise.resolve(null)
      m.completeUpdate()
        .addOnSuccessListener { promise.resolve(null) }
        .addOnFailureListener { e -> promise.reject("E_UPDATE_INSTALL", e.message ?: "install failed", e) }
      fake?.let { f -> main.post { f.installCompletes() } }
    }

    OnDestroy {
      main.removeCallbacksAndMessages(null)
      manager?.unregisterListener(listener)
    }
  }

  private fun manager(useFake: Boolean): AppUpdateManager? {
    manager?.let { return it }
    val ctx = appContext.reactContext ?: return null
    val m: AppUpdateManager = if (useFake) {
      FakeAppUpdateManager(ctx).also {
        it.setUpdateAvailable(FAKE_VERSION_CODE, AppUpdateType.FLEXIBLE)
        fake = it
      }
    } else AppUpdateManagerFactory.create(ctx)
    m.registerListener(listener)
    manager = m
    return m
  }

  private fun statusName(s: Int) = when (s) {
    InstallStatus.PENDING -> "pending"
    InstallStatus.DOWNLOADING -> "downloading"
    InstallStatus.DOWNLOADED -> "downloaded"
    InstallStatus.INSTALLING -> "installing"
    InstallStatus.INSTALLED -> "installed"
    InstallStatus.FAILED -> "failed"
    InstallStatus.CANCELED -> "canceled"
    else -> "unknown"
  }

  companion object {
    private const val REQUEST_CODE = 0x5550
    private const val FAKE_VERSION_CODE = 9999
  }
}
