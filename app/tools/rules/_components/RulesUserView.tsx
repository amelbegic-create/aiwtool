"use client";

import React from "react";
import RulesGrid from "./RulesGrid";

interface RulesUserViewProps {
  initialRules: Array<{
    id: string;
    title: string;
    categoryId: string;
    category?: { name: string } | null;
    priority: string;
    imageUrl?: string | null;
    images?: Array<{ url: string }>;
    createdAt: string | Date;
    isRead?: boolean;
  }>;
  categories: Array<{ id: string; name: string }>;
}

export default function RulesUserView({
  initialRules,
  categories,
}: RulesUserViewProps) {
  return (
    <RulesGrid
      initialRules={initialRules}
      categories={categories}
      showReadStatus={true}
    />
  );
}
