import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import { getTodos } from "@/app/actions/todoActions";
import TodoClient from "./TodoClient";

export default async function TodoPage() {
  const accessResult = await tryRequirePermission("todo:access");
  if (!accessResult.ok) {
    return <NoPermission moduleName="Meine Aufgaben" />;
  }

  const userId = accessResult.user.id;
  const initialTodos = await getTodos(userId);

  return (
    <div className="min-h-screen bg-background">
      <TodoClient userId={userId} initialTodos={initialTodos} />
    </div>
  );
}
