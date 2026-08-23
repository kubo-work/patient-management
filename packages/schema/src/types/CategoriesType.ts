import { BasicCategoriesType } from "./BasicCategoriesType.js";

export type CategoriesType = BasicCategoriesType & {
    children: BasicCategoriesType[];
}
