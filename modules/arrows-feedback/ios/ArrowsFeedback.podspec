Pod::Spec.new do |s|
  s.name           = 'ArrowsFeedback'
  s.version        = '1.0.0'
  s.summary        = 'Low-overhead native audio and haptic feedback for Arrows.'
  s.description    = 'Preloads and reuses the short sound and haptic effects used during gameplay.'
  s.author         = 'Arrows'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
  s.resource_bundles = {
    'ArrowsFeedback' => ['Resources/*.wav']
  }
end
