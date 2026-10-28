import { useLocalSearchParams } from "expo-router";
import { OwnedListingScreen } from "../../../components/OwnedListingScreen";
export default function SoldListing() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  return <OwnedListingScreen id={id} mode="sold" />;
}
