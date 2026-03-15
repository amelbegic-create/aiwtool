"use server";

import prisma from "@/lib/prisma";
import { getDbUserForAccess } from "@/lib/access";
import { revalidatePath } from "next/cache";

export type TodoItem = {
  id: string;
  title: string;
  completed: boolean;
  order: number;
  priority: number; // 1=high, 2=medium, 3=low
  createdAt: Date;
};

export async function getTodos(userId: string): Promise<TodoItem[]> {
  await getDbUserForAccess();
  const rows = await prisma.todo.findMany({
    where: { userId },
    orderBy: [{ priority: "asc" }, { order: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    completed: r.completed,
    order: r.order,
    priority: r.priority,
    createdAt: r.createdAt,
  }));
}

export async function addTodo(userId: string, title: string, priority: number = 2): Promise<TodoItem | null> {
  const user = await getDbUserForAccess();
  if (user.id !== userId) return null;
  const trimmed = title.trim();
  if (!trimmed) return null;
  const p = priority >= 1 && priority <= 3 ? priority : 2;
  const created = await prisma.todo.create({
    data: { userId, title: trimmed, priority: p },
  });
  revalidatePath("/dashboard");
  revalidatePath("/tools/todo");
  return {
    id: created.id,
    title: created.title,
    completed: created.completed,
    order: created.order,
    priority: created.priority,
    createdAt: created.createdAt,
  };
}

export async function toggleTodo(id: string): Promise<boolean> {
  const user = await getDbUserForAccess();
  const todo = await prisma.todo.findFirst({ where: { id, userId: user.id } });
  if (!todo) return false;
  await prisma.todo.update({
    where: { id },
    data: { completed: !todo.completed },
  });
  revalidatePath("/dashboard");
  revalidatePath("/tools/todo");
  return true;
}

export async function deleteTodo(id: string): Promise<boolean> {
  const user = await getDbUserForAccess();
  const todo = await prisma.todo.findFirst({ where: { id, userId: user.id } });
  if (!todo) return false;
  await prisma.todo.delete({ where: { id } });
  revalidatePath("/dashboard");
  revalidatePath("/tools/todo");
  return true;
}
