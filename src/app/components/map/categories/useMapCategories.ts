"use client";

import { useEffect, useState } from "react";

import {
  getCategories,
  subscribeCategories,
} from "./categoryStore";
import type { MapCategory } from "@/app/types/myTypes";

export function useMapCategories(): MapCategory[] {
  const [categories, setCategoriesState] =
    useState<MapCategory[]>(getCategories);

  useEffect(() => {
    const sync = () => setCategoriesState(getCategories());
    const unsubscribe = subscribeCategories(sync);
    sync();
    return unsubscribe;
  }, []);

  return categories;
}
