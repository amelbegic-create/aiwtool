import { getActiveRestaurantsForCLAnalyse } from "@/app/actions/clAnalyseActions";
import CLAnalyseClient from "./CLAnalyseClient";

export const metadata = {
  title: "CL Analyse | Admin",
};

export default async function CLAnalysePage() {
  // Always fetch restaurants upfront — client handles password gate in React state.
  // No cookie is used: password is required on every visit.
  const restaurants = await getActiveRestaurantsForCLAnalyse();
  return <CLAnalyseClient restaurants={restaurants} locked={true} />;
}
