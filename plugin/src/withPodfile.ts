import { mergeContents } from "@expo/config-plugins/build/utils/generateCode";
import { ConfigPlugin, withDangerousMod } from "expo/config-plugins";
import fs from "fs";
import path from "path";

import { getShareExtensionName } from "./index";

export const withPodfile: ConfigPlugin<{
  excludedPackages?: string[];
}> = (config, { excludedPackages }) => {
  const targetName = getShareExtensionName(config);
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const podFilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );
      let podfileContent = fs.readFileSync(podFilePath).toString();

      const postInstallBuildSettings = `    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['APPLICATION_EXTENSION_API_ONLY'] = 'NO'
      end
    end`;

      podfileContent = mergeContents({
        tag: "post-install-build-settings",
        src: podfileContent,
        newSrc: postInstallBuildSettings,
        anchor: `react_native_post_install`,
        offset: 7,
        comment: "#",
      }).contents;

      const useExpoModules = excludedPackages?.length
        ? `exclude = ["${excludedPackages.join(`", "`)}"]
  use_expo_modules!(exclude: exclude)`
        : `use_expo_modules!`;

      const shareExtensionTarget = `target '${targetName}' do     
  ${useExpoModules}     
  config = use_native_modules!
          
  use_frameworks! :linkage => podfile_properties['ios.useFrameworks'].to_sym if podfile_properties['ios.useFrameworks']
  use_frameworks! :linkage => ENV['USE_FRAMEWORKS'].to_sym if ENV['USE_FRAMEWORKS']
          
  # Flags change depending on the env values.
  flags = get_default_flags()
          
  use_react_native!(
    :path => config[:reactNativePath],
    :hermes_enabled => podfile_properties['expo.jsEngine'] == nil || podfile_properties['expo.jsEngine'] == 'hermes',
    :fabric_enabled => flags[:fabric_enabled],
    # An absolute path to your application root.
    :app_path => "#{Pod::Config.instance.installation_root}/..",
    # Note that if you have use_frameworks! enabled, Flipper will not work if enabled
    :flipper_configuration => flipper_config
  )
end`;

      podfileContent = mergeContents({
        tag: "share-extension-target",
        src: podfileContent,
        newSrc: shareExtensionTarget,
        anchor: `Pod::UI.warn e`,
        offset: 5,
        comment: "#",
      }).contents;

      fs.writeFileSync(podFilePath, podfileContent);

      return config;
    },
  ]);
};
