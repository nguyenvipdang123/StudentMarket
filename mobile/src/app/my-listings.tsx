import { View } from "react-native";
import { PersonalProducts } from "../components/PersonalProducts";
import { ui } from "../theme";
export default function MyListings() {
  return (
    <View style={ui.screen}>
      <PersonalProducts />
    </View>
  );
}
