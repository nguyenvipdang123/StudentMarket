import { SafeAreaView } from "react-native-safe-area-context";
import { PersonalProducts } from "../../components/PersonalProducts";
import { ui } from "../../theme";
export default function Saved() {
  return (
    <SafeAreaView style={ui.screen} edges={["top"]}>
      <PersonalProducts saved />
    </SafeAreaView>
  );
}
