require 'json'

package = JSON.parse(File.read(File.join(__DIR__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'KushlovFaceTrack'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = 'UNLICENSED'
  s.author         = 'Kushlov'
  s.homepage       = 'https://www.klproind.com'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/expo/expo.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.dependency 'livekit-react-native-webrtc'
  s.frameworks     = 'Vision', 'CoreVideo', 'AVFoundation'
  s.source_files   = '**/*.{h,m,swift}'
  s.public_header_files = 'FaceTrackNative.h'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule',
    'SWIFT_OBJC_BRIDGING_HEADER' => '${PODS_TARGET_SRCROOT}/FaceTrackNative.h',
    'HEADER_SEARCH_PATHS' => '$(inherited) "${PODS_ROOT}/Headers/Public/livekit-react-native-webrtc"'
  }
end
