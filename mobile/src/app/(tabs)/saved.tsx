import { SafeAreaView } from "react-native-safe-area-context";
import { SavedProducts } from "../../components/SavedProducts";
import { useTheme } from "../../theme";
export default function Saved() {
  const { ui } = useTheme();
  return (
    <SafeAreaView style={ui.screen} edges={["top"]}>
      <SavedProducts />
    </SafeAreaView>
  );
}
