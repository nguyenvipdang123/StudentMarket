import { View } from "react-native";
import { PersonalProducts } from "../components/PersonalProducts";
import { useTheme } from "../theme";
export default function MyListings() {
  const { ui } = useTheme();
  return (
    <View style={ui.screen}>
      <PersonalProducts />
    </View>
  );
}
