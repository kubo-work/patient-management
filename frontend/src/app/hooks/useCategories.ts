import { useContext } from "react";
import { CategoriesContent, CategoriesContextType } from "../providers/CategoriesProvider";

export const useCategories = (): CategoriesContextType => useContext(CategoriesContent)
