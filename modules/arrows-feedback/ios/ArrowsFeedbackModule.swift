import AVFoundation
import ExpoModulesCore
import UIKit

/**
 Low-overhead playback for the four short game effects.

 The module owns at most one AVAudioPlayer per effect. Repeating an effect
 restarts that player instead of allocating a new playback object. All audio
 and haptic state is confined to the main queue because UIKit feedback
 generators require main-thread access.
 */
public final class ArrowsFeedbackModule: Module {
  private var exitPlayer: AVAudioPlayer?
  private var blockedPlayer: AVAudioPlayer?
  private var clearedPlayer: AVAudioPlayer?
  private var starPlayer: AVAudioPlayer?

  private var exitHaptic: UISelectionFeedbackGenerator?
  private var resultHaptic: UINotificationFeedbackGenerator?

  private var wantsPreparedAudio = false
  private var wantsPreparedHaptics = false
  private var audioIsPrepared = false
  private var hapticsArePrepared = false
  private var mediaServicesResetObserver: NSObjectProtocol?
  private var appIsForeground = true
  private var moduleIsDestroyed = false

  public func definition() -> ModuleDefinition {
    Name("ArrowsFeedback")

    Function("prepare") { (soundOn: Bool) in
      self.performOnMain { [weak self] in
        self?.prepareForGameplay(soundOn: soundOn)
      }
    }

    Function("release") {
      self.performOnMain { [weak self] in
        self?.releaseFromGameplay()
      }
    }

    Function("feedback") { (event: String, soundOn: Bool) in
      self.performOnMain { [weak self] in
        self?.performFeedback(event: event, soundOn: soundOn)
      }
    }

    OnAppEntersForeground {
      self.performOnMain { [weak self] in
        self?.enterForeground()
      }
    }

    OnAppEntersBackground {
      self.performOnMain { [weak self] in
        self?.enterBackground()
      }
    }

    OnDestroy {
      self.performOnMain {
        self.destroy()
      }
    }
  }

  private func performOnMain(_ action: @escaping () -> Void) {
    if Thread.isMainThread {
      action()
    } else {
      DispatchQueue.main.async(execute: action)
    }
  }

  private func prepareForGameplay(soundOn: Bool) {
    assert(Thread.isMainThread)
    guard !moduleIsDestroyed else {
      return
    }

    wantsPreparedAudio = soundOn
    wantsPreparedHaptics = true
    appIsForeground = UIApplication.shared.applicationState != .background
    if appIsForeground {
      prepareHapticsIfNeeded()
      if soundOn { prepareAudioIfNeeded() }
    }
  }

  private func releaseFromGameplay() {
    assert(Thread.isMainThread)
    wantsPreparedAudio = false
    wantsPreparedHaptics = false
    releaseResources()
  }

  private func performFeedback(event: String, soundOn: Bool) {
    assert(Thread.isMainThread)
    guard !moduleIsDestroyed, appIsForeground else {
      return
    }

    wantsPreparedHaptics = true
    prepareHapticsIfNeeded()
    if soundOn {
      wantsPreparedAudio = true
      prepareAudioIfNeeded()
      player(for: event)?.restart()
    } else if wantsPreparedAudio || audioIsPrepared {
      wantsPreparedAudio = false
      releaseAudioResources()
    }
    performHaptic(for: event)
  }

  private func enterForeground() {
    assert(Thread.isMainThread)
    guard !moduleIsDestroyed else {
      return
    }

    appIsForeground = true
    if wantsPreparedHaptics { prepareHapticsIfNeeded() }
    if wantsPreparedAudio { prepareAudioIfNeeded() }
  }

  private func enterBackground() {
    assert(Thread.isMainThread)
    appIsForeground = false
    releaseResources()
  }

  private func destroy() {
    assert(Thread.isMainThread)
    moduleIsDestroyed = true
    wantsPreparedAudio = false
    wantsPreparedHaptics = false
    appIsForeground = false
    releaseResources()
    removeMediaServicesResetObserver()
  }

  private func prepareAudioIfNeeded() {
    assert(Thread.isMainThread)
    guard !audioIsPrepared, !moduleIsDestroyed, appIsForeground else {
      return
    }

    observeMediaServicesResetsIfNeeded()
    configureSharedAudioSession()

    let resourceBundle = feedbackResourceBundle()
    exitPlayer = makePlayer(fileName: "whoosh", resourceBundle: resourceBundle)
    blockedPlayer = makePlayer(fileName: "fail", resourceBundle: resourceBundle)
    clearedPlayer = makePlayer(fileName: "win", resourceBundle: resourceBundle)
    starPlayer = makePlayer(fileName: "star", resourceBundle: resourceBundle)

    // Missing or corrupt decorative audio must not cause repeated allocation
    // attempts on every tap. A lifecycle or media-service reset retries it.
    audioIsPrepared = true
  }

  private func prepareHapticsIfNeeded() {
    assert(Thread.isMainThread)
    guard !hapticsArePrepared, !moduleIsDestroyed, appIsForeground else {
      return
    }

    let selectionGenerator = UISelectionFeedbackGenerator()
    selectionGenerator.prepare()
    exitHaptic = selectionGenerator

    let notificationGenerator = UINotificationFeedbackGenerator()
    notificationGenerator.prepare()
    resultHaptic = notificationGenerator
    hapticsArePrepared = true
  }

  private func configureSharedAudioSession() {
    let session = AVAudioSession.sharedInstance()
    do {
      try session.setCategory(.ambient, mode: .default)
    } catch {
      // Feedback is decorative. Keep gameplay responsive if audio setup fails.
    }
  }

  private func makePlayer(fileName: String, resourceBundle: Bundle?) -> AVAudioPlayer? {
    guard let fileURL = resourceBundle?.url(
      forResource: fileName,
      withExtension: "wav"
    ) else {
      return nil
    }

    do {
      let player = try AVAudioPlayer(contentsOf: fileURL)
      player.numberOfLoops = 0
      player.volume = 1
      player.prepareToPlay()
      return player
    } catch {
      return nil
    }
  }

  private func feedbackResourceBundle() -> Bundle? {
    let moduleBundle = Bundle(for: ArrowsFeedbackModule.self)
    for containerBundle in [moduleBundle, Bundle.main] {
      guard let bundleURL = containerBundle.url(
        forResource: "ArrowsFeedback",
        withExtension: "bundle"
      ) else {
        continue
      }
      if let resourceBundle = Bundle(url: bundleURL) {
        return resourceBundle
      }
    }
    return nil
  }

  private func player(for event: String) -> AVAudioPlayer? {
    switch event {
    case "exit":
      return exitPlayer
    case "blocked":
      return blockedPlayer
    case "cleared":
      return clearedPlayer
    case "star":
      return starPlayer
    default:
      return nil
    }
  }

  private func performHaptic(for event: String) {
    switch event {
    case "exit":
      exitHaptic?.selectionChanged()
      exitHaptic?.prepare()
    case "blocked":
      resultHaptic?.notificationOccurred(.error)
      resultHaptic?.prepare()
    case "cleared":
      resultHaptic?.notificationOccurred(.success)
      resultHaptic?.prepare()
    default:
      break
    }
  }

  private func releaseResources() {
    assert(Thread.isMainThread)
    releaseAudioResources()
    exitHaptic = nil
    resultHaptic = nil
    hapticsArePrepared = false

    // Do not deactivate AVAudioSession here. It is process-wide and may be in
    // use by another feature or by audio from another app that we mix with.
  }

  private func releaseAudioResources() {
    assert(Thread.isMainThread)
    stop(exitPlayer)
    stop(blockedPlayer)
    stop(clearedPlayer)
    stop(starPlayer)
    exitPlayer = nil
    blockedPlayer = nil
    clearedPlayer = nil
    starPlayer = nil
    audioIsPrepared = false
  }

  private func observeMediaServicesResetsIfNeeded() {
    assert(Thread.isMainThread)
    guard mediaServicesResetObserver == nil else {
      return
    }

    mediaServicesResetObserver = NotificationCenter.default.addObserver(
      forName: AVAudioSession.mediaServicesWereResetNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      guard let self, !self.moduleIsDestroyed else {
        return
      }
      self.releaseAudioResources()
      if self.wantsPreparedAudio, self.appIsForeground {
        self.prepareAudioIfNeeded()
      }
    }
  }

  private func removeMediaServicesResetObserver() {
    assert(Thread.isMainThread)
    guard let observer = mediaServicesResetObserver else {
      return
    }
    NotificationCenter.default.removeObserver(observer)
    mediaServicesResetObserver = nil
  }

  private func stop(_ player: AVAudioPlayer?) {
    player?.stop()
    player?.currentTime = 0
  }
}

private extension AVAudioPlayer {
  func restart() {
    stop()
    currentTime = 0
    play()
  }
}
