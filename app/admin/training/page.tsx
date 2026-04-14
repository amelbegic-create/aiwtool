import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import {
  listTrainingProgramsAdmin,
  listTrainingTemplates,
  listRestaurantsForTrainingAdmin,
} from "@/app/actions/trainingActions";
import TrainingAdminClient from "./TrainingAdminClient";

export default async function AdminTrainingPage() {
  const access = await tryRequirePermission("training:manage");
  if (!access.ok) {
    return <NoPermission moduleName="Training" />;
  }

  const [programs, templates, restaurants] = await Promise.all([
    listTrainingProgramsAdmin(),
    listTrainingTemplates(),
    listRestaurantsForTrainingAdmin(),
  ]);
  return (
    <TrainingAdminClient initialPrograms={programs} templates={templates} restaurants={restaurants} />
  );
}
