import { createContext, ReactNode, useEffect, useState } from "react";
import { API_URL } from "../../../constants/url";
import useSWR, { useSWRConfig } from "swr";

import { CategoriesType } from "@/../../common/types/CategoriesType";

export type CategoriesContextType = {
  categories: CategoriesType[] | null;
  categoriesIsLoading: boolean;
  categoriesError: boolean;
  categoriesDoMutate: () => void;
};

export const CategoriesContent = createContext<CategoriesContextType>(
  {} as CategoriesContextType
);

async function fetcher(key: string): Promise<[CategoriesType]> {
  return fetch(key).then((res) => res.json());
}

const CategoriesProvider = (props: { children: ReactNode }) => {
  const { children } = props;
  const fetchUrl = `${API_URL}/doctor/categories`;
  const [categories, setCategories] = useState<CategoriesType[] | null>([]);
  const {
    data,
    isLoading: categoriesIsLoading,
    error: categoriesError,
  } = useSWR(fetchUrl, fetcher);
  useEffect(() => {
    data && setCategories(data);
  }, [data, setCategories]);

  const { mutate } = useSWRConfig();

  const categoriesDoMutate = () => {
    mutate(fetchUrl);
  };
  return (
    <CategoriesContent.Provider
      value={{
        categories,
        categoriesIsLoading,
        categoriesError,
        categoriesDoMutate,
      }}
    >
      {children}
    </CategoriesContent.Provider>
  );
};

export default CategoriesProvider;
