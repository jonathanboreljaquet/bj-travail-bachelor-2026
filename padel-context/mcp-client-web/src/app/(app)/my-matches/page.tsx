import { getMyMatches } from "@/lib/api";
import MyMatchesView from "./MyMatchesView";

export default async function MyMatchesPage() {
  const matches = await getMyMatches();

  return <MyMatchesView matches={matches} />;
}
