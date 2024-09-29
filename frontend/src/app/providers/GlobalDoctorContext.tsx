import { createContext, ReactNode, useEffect, useState } from "react";
import { API_URL } from "../../../constants/url";
import useSWR, { useSWRConfig } from "swr";

import { CategoriesType } from "@/../../common/types/CategoriesType";

export type GlobalDoctorContextType = {
  categories: CategoriesType[] | null;
  categoriesIsLoading: boolean;
  categoriesError: boolean;
  categoriesDoMutate: () => void;
};

export const GlobalDoctorContext = createContext<GlobalDoctorContextType>(
  {} as GlobalDoctorContextType
);

async function fetcher(key: string): Promise<[CategoriesType]> {
  return fetch(key).then((res) => res.json());
}

const GlobalDoctorProvider = (props: { children: ReactNode }) => {
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
    <GlobalDoctorContext.Provider
      value={{
        categories,
        categoriesIsLoading,
        categoriesError,
        categoriesDoMutate,
      }}
    >
      {children}
    </GlobalDoctorContext.Provider>
  );
};

export default GlobalDoctorProvider;
