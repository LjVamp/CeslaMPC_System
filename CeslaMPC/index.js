import { Platform } from "react-native";
import { registerRootComponent } from "expo";

import App from "../CeslaMPC/App";

// Fix vector icons not loading on web
if (Platform.OS === "web") {
  const iconFonts = [
    "AntDesign",
    "Entypo",
    "EvilIcons",
    "Feather",
    "FontAwesome",
    "FontAwesome5_Brands",
    "FontAwesome5_Regular",
    "FontAwesome5_Solid",
    "FontAwesome6_Brands",
    "FontAwesome6_Regular",
    "FontAwesome6_Solid",
    "Fontisto",
    "Foundation",
    "Ionicons",
    "MaterialCommunityIcons",
    "MaterialIcons",
    "Octicons",
    "SimpleLineIcons",
    "Zocial",
  ];

  const basePath =
    "/node_modules/expo/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/";

  const style = document.createElement("style");
  style.textContent = iconFonts
    .map(
      (font) =>
        `@font-face { font-family: '${font}'; src: url('${basePath}${font}.ttf') format('truetype'); }`,
    )
    .join("\n");
  document.head.appendChild(style);
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
