import { getMyMatches } from "@/lib/api";
import MyMatchesView from "./MyMatchesView";

export default async function MyMatchesPage() {
  // Lecture côté serveur (le navigateur ne joint pas l'API Docker directement).
  const matches = await getMyMatches();

  return <MyMatchesView matches={matches} />;
}
