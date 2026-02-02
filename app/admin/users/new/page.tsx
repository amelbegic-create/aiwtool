import { redirect } from "next/navigation";

export default function NewUserRedirect() {
  redirect("/admin/users/create");
}
