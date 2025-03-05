import { createContext, ReactNode, useMemo } from "react";
import { API_URL } from "../../../constants/url";
import useSWR from "swr";

import { CategoriesType } from "@/../../common/types/CategoriesType";
import { DoctorType } from "@/../../common/types/DoctorType";
import { PatientType } from "../../../../common/types/PatientType";
import { PatientNameSuggestionsType } from "../types/PatientNameSuggestionsTypes";
import { SexTypes } from "@/../../common/types/SexTypes";
import { SexListData } from "@/../../common/types/SexListData";

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

const loginDoctorFetcher = async (
  url: string
): Promise<DoctorType | undefined> =>
  await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  }).then((res) => res.json());

const categoriesFetcher = async (
  url: string
): Promise<CategoriesType[] | undefined> =>
  await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  }).then((res) => res.json());

const doctorsFetcher = async (url: string): Promise<DoctorType[] | undefined> =>
  await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  }).then((res) => res.json());

const patientsFetcher = async (
  url: string
): Promise<PatientType[] | undefined> =>
  await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  }).then((res) => res.json());

const GlobalDoctorProvider = (props: { children: ReactNode }) => {
  const { children } = props;
  const loginDoctorFetchUrl = `${API_URL}/doctor/login_doctor`;
  const categoriesFetchUrl = `${API_URL}/doctor/categories`;
  const doctorsFetchUrl = `${API_URL}/doctor/doctors`;
  const patientsFetchUrl: string = `${API_URL}/doctor/patients`;

  // ログインしている医者 データの管理
  const { data: loginDoctorData, mutate: loginDoMutate } = useSWR(
    loginDoctorFetchUrl,
    loginDoctorFetcher
  );

  // カテゴリ一覧データの管理
  const { data: categoriesData, mutate: categoriesDoMutate } = useSWR(
    categoriesFetchUrl,
    categoriesFetcher
  );

  // 医者一覧データの管理
  const { data: doctorsData, mutate: doctorsDoMutate } = useSWR(
    doctorsFetchUrl,
    doctorsFetcher
  );

  // 患者一覧データの管理
  const { data: patientsData, mutate: patientsMutate } = useSWR(
    patientsFetchUrl,
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
