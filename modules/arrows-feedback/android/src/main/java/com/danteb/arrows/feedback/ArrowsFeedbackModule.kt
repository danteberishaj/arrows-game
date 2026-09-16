package com.danteb.arrows.feedback

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool
import android.os.Build
import android.view.HapticFeedbackConstants
import android.view.View
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.random.Random

/**
 * Low-overhead playback for the game's short local effects.
 *
 * A single SoundPool replaces one ExoPlayer + MediaSession per effect. Sounds
 * load before gameplay. Exit pops are allowed to overlap (a fast player taps
 * every ~300 ms and each pop is 160 ms) and get a little random pitch and
 * level so no two consecutive exits are identical; the other effects restart
 * their previous stream. Haptics use the Activity's native view feedback path
 * instead of allocating a Promise-backed Vibrator request, so they follow the
 * user's system touch-feedback setting.
 */
class ArrowsFeedbackModule : Module() {
  private val lock = Any()
  private var soundPool: SoundPool? = null
  private val samplesByName = mutableMapOf<String, Int>()
  private val namesBySample = mutableMapOf<Int, String>()
  private val loadedSamples = mutableSetOf<Int>()
  private val pendingSounds = mutableSetOf<String>()
  private val streamsByName = mutableMapOf<String, Int>()
  private var activityForeground = true
  private var destroyed = false

  override fun definition() = ModuleDefinition {
    Name("ArrowsFeedback")

    Function("prepare") { soundOn: Boolean ->
      if (soundOn) prepareSoundPool()
    }

    Function("release") {
      releaseSoundPool(permanent = false)
    }

    Function("feedback") { event: String, soundOn: Boolean, step: Int ->
      if (soundOn) {
        prepareSoundPool()
        soundName(event, step)?.let(::playSound)
      }
      hapticConstant(event)?.let(::performHaptic)
    }

    OnActivityEntersForeground {
      synchronized(lock) {
        activityForeground = true
      }
    }

    OnActivityEntersBackground {
      stopActiveStreams()
    }

    OnDestroy {
      releaseSoundPool(permanent = true)
    }
  }

  private fun prepareSoundPool() {
    val context = appContext.reactContext ?: return
    synchronized(lock) {
      if (destroyed || soundPool != null) return
      val pool = try {
        SoundPool.Builder()
          .setMaxStreams(6)
          .setAudioAttributes(
            AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_GAME)
              .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
              .build()
          )
          .build()
      } catch (_: RuntimeException) {
        return
      }
      soundPool = pool

      try {
        pool.setOnLoadCompleteListener { callbackPool, sampleId, status ->
          val loadedName = synchronized(lock) {
            if (destroyed || soundPool !== callbackPool || status != 0) {
              null
            } else {
              loadedSamples.add(sampleId)
              namesBySample[sampleId]
            }
          }
          if (loadedName != null) {
            playPendingSound(callbackPool, loadedName, sampleId)
          }
        }
      } catch (_: RuntimeException) {
        soundPool = null
        try {
          pool.release()
        } catch (_: RuntimeException) {}
        return
      }

      for ((name, fileName) in SOUND_FILES) {
        try {
          val sampleId = context.assets.openFd(fileName).use { pool.load(it, 1) }
          if (sampleId != 0) {
            samplesByName[name] = sampleId
            namesBySample[sampleId] = name
          }
        } catch (_: Exception) {
          // Feedback is decorative. A missing/corrupt asset must not stop play.
        }
      }
    }
  }

  private fun playSound(name: String) {
    synchronized(lock) {
      if (destroyed || !activityForeground) return
      val pool = soundPool ?: return
      val sampleId = samplesByName[name] ?: return
      if (!loadedSamples.contains(sampleId)) {
        pendingSounds.add(name)
        return
      }
      pendingSounds.remove(name)
      playLoadedSoundLocked(name, pool, sampleId)
    }
  }

  private fun playPendingSound(expectedPool: SoundPool, name: String, sampleId: Int) {
    synchronized(lock) {
      if (
        destroyed ||
        !activityForeground ||
        soundPool !== expectedPool ||
        samplesByName[name] != sampleId ||
        !loadedSamples.contains(sampleId) ||
        !pendingSounds.remove(name)
      ) {
        return
      }
      playLoadedSoundLocked(name, expectedPool, sampleId)
    }
  }

  /** Must be called while holding [lock]. */
  private fun playLoadedSoundLocked(name: String, pool: SoundPool, sampleId: Int) {
    val isPop = name.startsWith(POP_PREFIX)
    try {
      if (!isPop) streamsByName[name]?.takeIf { it != 0 }?.let(pool::stop)
      // +/-3% rate (about half a semitone) and up to -1.4 dB of level keep a
      // 250-tap level from sounding like one sample on repeat.
      val volume = if (isPop) 0.85f + 0.15f * random.nextFloat() else 1f
      val rate = if (isPop) 0.97f + 0.06f * random.nextFloat() else 1f
      val streamId = pool.play(sampleId, volume, volume, 1, 0, rate)
      if (streamId != 0) streamsByName[name] = streamId
    } catch (_: RuntimeException) {
      streamsByName.remove(name)
    }
  }

  private fun performHaptic(constant: Int) {
    val activity = synchronized(lock) {
      if (destroyed || !activityForeground) null else appContext.currentActivity
    } ?: return
    try {
      activity.runOnUiThread {
        val shouldPerform = synchronized(lock) {
          !destroyed &&
            activityForeground &&
            appContext.currentActivity === activity
        }
        if (shouldPerform) {
          try {
            activity.findViewById<View>(android.R.id.content)?.performHapticFeedback(constant)
          } catch (_: RuntimeException) {}
        }
      }
    } catch (_: RuntimeException) {}
  }

  private fun stopActiveStreams() {
    synchronized(lock) {
      activityForeground = false
      pendingSounds.clear()
      val pool = soundPool ?: return
      for (streamId in streamsByName.values.toSet()) {
        try {
          pool.stop(streamId)
        } catch (_: RuntimeException) {}
      }
      streamsByName.clear()
    }
  }

  private fun releaseSoundPool(permanent: Boolean) {
    synchronized(lock) {
      if (permanent) destroyed = true
      val pool = soundPool
      soundPool = null
      samplesByName.clear()
      namesBySample.clear()
      loadedSamples.clear()
      pendingSounds.clear()
      streamsByName.clear()
      if (pool != null) {
        try {
          pool.setOnLoadCompleteListener(null)
        } catch (_: RuntimeException) {}
        try {
          pool.release()
        } catch (_: RuntimeException) {}
      }
    }
  }

  private fun soundName(event: String, step: Int): String? = when (event) {
    "exit" -> POP_PREFIX + step.coerceIn(0, POP_STEPS - 1)
    "blocked" -> "fail"
    "cleared" -> "win"
    "star" -> "star"
    else -> null
  }

  // CLOCK_TICK resolves to EFFECT_TEXTURE_TICK, the platform's weakest effect
  // (meant for scroll textures, documented as imperceptible on some devices).
  // CONTEXT_CLICK resolves to EFFECT_TICK: a light, crisp tap, the Android
  // equivalent of a light impact, which is what "the arrow committed" wants.
  private fun hapticConstant(event: String): Int? = when (event) {
    "exit" -> HapticFeedbackConstants.CONTEXT_CLICK
    // A blocked arrow tapped again after its heart was paid: acknowledge the
    // touch with the lightest crisp tick and no sound.
    "nudge" -> HapticFeedbackConstants.CONTEXT_CLICK
    "blocked" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      HapticFeedbackConstants.REJECT
    } else {
      HapticFeedbackConstants.LONG_PRESS
    }
    "cleared" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      HapticFeedbackConstants.CONFIRM
    } else {
      HapticFeedbackConstants.VIRTUAL_KEY
    }
    else -> null
  }

  private val random = Random(System.nanoTime())

  private companion object {
    const val POP_PREFIX = "pop"
    const val POP_STEPS = 8
    val SOUND_FILES = (0 until POP_STEPS).map { "$POP_PREFIX$it" to "$POP_PREFIX$it.wav" } + listOf(
      "fail" to "fail.wav",
      "win" to "win.wav",
      "star" to "star.wav",
    )
  }
}
