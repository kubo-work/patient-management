import { createContext, ReactNode, useMemo } from "react";
import { API_URL } from "../../../constants/url";
import useSWR from "swr";

import { CategoriesType } from "@/../../common/types/CategoriesType";
import { DoctorType } from "@/../../common/types/DoctorType";
import { PatientType } from "../../../../common/types/PatientType";
import { PatientNameSuggestionsType } from "../types/PatientNameSuggestionsTypes";
import { SexTypes } from "@/../../common/types/SexTypes";
import { SexListData } from "@/../../common/types/SexListData";
import { useGlobalDoctorLogin } from "../hooks/useGlobalDoctorLogin";

export type GlobalDoctorContextType = {
  loginDoctor: DoctorType | undefined;
  loginDoMutate: () => void;
  categories: CategoriesType[] | undefined;
  categoriesDoMutate: () => void;
  doctors: DoctorType[] | undefined;
  doctorsDoMutate: () => void;
  patients: PatientType[] | undefined;
  patientsMutate: () => void;
  patientNameSuggestions: PatientNameSuggestionsType[] | undefined;
  sexList: SexTypes;
  sexListData: SexListData[];
};

export const GlobalDoctorContext = createContext<GlobalDoctorContextType>(
  {} as GlobalDoctorContextType
);

async function loginDoctorFetcher([url, token]: [
  string,
  string | null
]): Promise<DoctorType> {
  return token
    ? fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }).then((res) => res.json())
    : undefined;
}

async function categoriesFetcher([url, token]: [
  string,
  string | null
]): Promise<CategoriesType[]> {
  return token
    ? fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).then((res) => res.json())
    : undefined;
}

async function doctorsFetcher([url, token]: [string, string | null]): Promise<
  DoctorType[]
> {
  return token
    ? fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).then((res) => res.json())
    : undefined;
}

async function patientsFetcher([url, token]: [string, string | null]): Promise<
  PatientType[]
> {
  return token
    ? fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).then((res) => res.json())
    : undefined;
}

const GlobalDoctorProvider = (props: { children: ReactNode }) => {
  const { children } = props;
  const { token } = useGlobalDoctorLogin();
  const loginDoctorFetchUrl = `${API_URL}/doctor/login_doctor`;
  const categoriesFetchUrl = `${API_URL}/doctor/categories`;
  const doctorsFetchUrl = `${API_URL}/doctor/doctors`;
  const patientsFetchUrl: string = `${API_URL}/doctor/patients`;

  // ログインしている医者 データのステート管理
  const { data: loginDoctorData, mutate: loginDoMutate } = useSWR(
    [loginDoctorFetchUrl, token],
    loginDoctorFetcher
  );

  // カテゴリ一覧データのステート管理
  const { data: categoriesData, mutate: categoriesDoMutate } = useSWR(
    [categoriesFetchUrl, token],
    categoriesFetcher
  );

  // 医者一覧データのステート管理
  const { data: doctorsData, mutate: doctorsDoMutate } = useSWR(
    [doctorsFetchUrl, token],
    doctorsFetcher
  );

  // 患者一覧データのステート管理
  const { data: patientsData, mutate: patientsMutate } = useSWR(
    [patientsFetchUrl, token],
    patientsFetcher
  );

  // 患者の名前をサジェストするためのリストを準備
  const patientNameSuggestions: PatientNameSuggestionsType[] | undefined =
    useMemo(
      () =>
        patientsData
          ? patientsData.map((patient) => ({
              value: patient.name,
              id: patient.id.toString(),
            }))
          : undefined,
      [patientsData]
    );

  const sexList: SexTypes = useMemo(() => {
    return {
      no_answer: {
        label: "未回答",
      },
      man: {
        label: "男性",
      },
      woman: {
        label: "女性",
      },
      neither: {
        label: "その他",
      },
    };
  }, []);

  const sexListData: SexListData[] = Object.entries(sexList).map(
    ([key, value]) => ({
      value: key as keyof SexTypes,
      label: value.label,
    })
  );

  return (
    <GlobalDoctorContext.Provider
      value={{
        loginDoctor: loginDoctorData,
        loginDoMutate,
        categories: categoriesData,
        categoriesDoMutate,
        doctors: doctorsData,
        doctorsDoMutate,
        patients: patientsData,
        patientsMutate,
        patientNameSuggestions,
        sexList,
        sexListData,
      }}
    >
      {children}
    </GlobalDoctorContext.Provider>
  );
};

export default GlobalDoctorProvider;
