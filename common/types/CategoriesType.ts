import { BasicCategoriesType } from "./BasicCategoriesType";

export type CategoriesType = BasicCategoriesType & {
    children: BasicCategoriesType[];
}
