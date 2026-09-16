import AVFoundation
import ExpoModulesCore
import UIKit

/**
 Low-overhead playback for the game's short effects.

 The module owns at most one AVAudioPlayer per clip: eight exit pops (one per
 consecutive-tap pitch step, pre-rendered because AVAudioPlayer's rate is a
 pitch-preserving time stretch) plus the blocked, cleared and star clips.
 Repeating a clip restarts its player instead of allocating a new playback
 object; different pop steps overlap naturally. All audio and haptic state is
 confined to the main queue because UIKit feedback generators require
 main-thread access.
 */
public final class ArrowsFeedbackModule: Module {
  private static let popSteps = 8
  private static let clipNames: [String] =
    (0..<popSteps).map { "pop\($0)" } + ["fail", "win", "star"]

  private var players: [String: AVAudioPlayer] = [:]

  private var exitHaptic: UIImpactFeedbackGenerator?
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

    Function("feedback") { (event: String, soundOn: Bool, step: Int) in
      self.performOnMain { [weak self] in
        self?.performFeedback(event: event, soundOn: soundOn, step: step)
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

  private func performFeedback(event: String, soundOn: Bool, step: Int) {
    assert(Thread.isMainThread)
    guard !moduleIsDestroyed, appIsForeground else {
      return
    }

    let clampedStep = max(0, min(Self.popSteps - 1, step))
    wantsPreparedHaptics = true
    prepareHapticsIfNeeded()
    if soundOn {
      wantsPreparedAudio = true
      prepareAudioIfNeeded()
      if let player = player(for: event, step: clampedStep) {
        // Up to -1.4 dB of random level so a 250-tap level never sounds like
        // one sample on repeat (Android adds a small rate jitter too).
        player.volume = event == "exit" ? Float(0.85 + 0.15 * Double.random(in: 0...1)) : 1
        player.restart()
      }
    } else if wantsPreparedAudio || audioIsPrepared {
      wantsPreparedAudio = false
      releaseAudioResources()
    }
    performHaptic(for: event, step: clampedStep)
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
    for name in Self.clipNames {
      if let player = makePlayer(fileName: name, resourceBundle: resourceBundle) {
        players[name] = player
      }
    }

    // Missing or corrupt decorative audio must not cause repeated allocation
    // attempts on every tap. A lifecycle or media-service reset retries it.
    audioIsPrepared = true
  }

  private func prepareHapticsIfNeeded() {
    assert(Thread.isMainThread)
    guard !hapticsArePrepared, !moduleIsDestroyed, appIsForeground else {
      return
    }

    // A selection tick is for a value passing a detent. An arrow leaving the
    // board is a commit, which is a light impact; its intensity climbs with
    // the consecutive-tap step alongside the pop's pitch.
    let impactGenerator = UIImpactFeedbackGenerator(style: .light)
    impactGenerator.prepare()
    exitHaptic = impactGenerator

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

  private func player(for event: String, step: Int) -> AVAudioPlayer? {
    switch event {
    case "exit":
      return players["pop\(step)"]
    case "blocked":
      return players["fail"]
    case "cleared":
      return players["win"]
    case "star":
      return players["star"]
    default:
      return nil
    }
  }

  private func performHaptic(for event: String, step: Int) {
    switch event {
    case "exit":
      let intensity = 0.6 + 0.4 * CGFloat(step) / CGFloat(max(1, Self.popSteps - 1))
      exitHaptic?.impactOccurred(intensity: intensity)
      exitHaptic?.prepare()
    case "nudge":
      // Already-charged blocked arrow: a soft acknowledgement, no thud.
      exitHaptic?.impactOccurred(intensity: 0.45)
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
    for player in players.values {
      stop(player)
    }
    players.removeAll()
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
