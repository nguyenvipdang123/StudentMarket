import { SafeAreaView } from "react-native-safe-area-context";
import { SavedProducts } from "../../components/SavedProducts";
import { ui } from "../../theme";
export default function Saved() {
  return (
    <SafeAreaView style={ui.screen} edges={["top"]}>
      <SavedProducts />
    </SafeAreaView>
  );
}
