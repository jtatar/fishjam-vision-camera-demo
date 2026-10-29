require 'xcodeproj'

root = File.expand_path('..', __dir__)
physical = ENV.key?('DEVICE_UDID')
device = ENV[physical ? 'DEVICE_UDID' : 'SIMULATOR_UDID']
abort 'Set DEVICE_UDID or SIMULATOR_UDID.' unless device
team = ENV['DEVELOPMENT_TEAM']
abort 'Set DEVELOPMENT_TEAM for physical-device signing.' if physical && !team
project_path = File.join(root, 'ios/FishjamCamera.xcodeproj')
abort 'Run npm run prebuild -- --platform ios first.' unless File.directory?(project_path)

project = Xcodeproj::Project.open(project_path)
app = project.targets.find { |target| target.name == 'FishjamCamera' }
name = 'FishjamCameraUITests'
target = project.targets.find { |item| item.name == name }
unless target
  target = project.new_target(:ui_test_bundle, name, :ios, '16.4')
  target.add_dependency(app)
end
group = project.main_group.groups.find { |item| item.display_name == 'E2E' } ||
        project.main_group.new_group('E2E', '../e2e/ios')
%w[LaunchSmokeTests.swift DeviceCameraTests.swift LiveStreamTests.swift].each do |file|
  reference = group.files.find { |item| item.path == file } || group.new_file(file)
  target.add_file_references([reference]) unless target.source_build_phase.files_references.include?(reference)
end
target.build_configurations.each do |config|
  config.build_settings.merge!({
    'PRODUCT_NAME' => '$(TARGET_NAME)',
    'PRODUCT_BUNDLE_IDENTIFIER' => 'com.jtatar.fishjamcamera.uitests',
    'TEST_TARGET_NAME' => app.name,
    'GENERATE_INFOPLIST_FILE' => 'YES',
    'SWIFT_VERSION' => '5.0',
    'CODE_SIGNING_ALLOWED' => physical ? 'YES' : 'NO',
    'CODE_SIGN_STYLE' => 'Automatic'
  })
  config.build_settings['DEVELOPMENT_TEAM'] = team if physical
end
project.save

scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app)
scheme.add_test_target(target)
scheme.set_launch_target(app)
scheme.save_as(project_path, 'FishjamCameraE2E', true)
platform = physical ? 'iOS' : 'iOS Simulator'
test_class = ENV.fetch('TEST_CLASS', physical ? 'DeviceCameraTests' : 'LaunchSmokeTests')
result = File.join(root, "artifacts/ios-#{physical ? 'device-' : ''}e2e-#{Time.now.utc.strftime('%Y%m%d-%H%M%S')}.xcresult")
signing = physical ? ['-allowProvisioningUpdates', '-allowProvisioningDeviceRegistration',
                      "DEVELOPMENT_TEAM=#{team}", 'CODE_SIGN_STYLE=Automatic'] :
                     ['CODE_SIGNING_ALLOWED=NO']
success = system('xcodebuild', '-workspace', File.join(root, 'ios/FishjamCamera.xcworkspace'),
                 '-scheme', 'FishjamCameraE2E', '-configuration', physical ? 'Release' : 'Debug',
                 '-destination', "platform=#{platform},id=#{device}",
                 '-derivedDataPath', File.join(root, physical ? 'artifacts/ios-device' : 'artifacts/ios'),
                 '-resultBundlePath', result, '-parallel-testing-enabled', 'NO',
                 '-collect-test-diagnostics', 'never',
                 "-only-testing:#{name}/#{test_class}", *signing, 'test')
puts "Test result: #{result}"
exit(success ? 0 : 1)
