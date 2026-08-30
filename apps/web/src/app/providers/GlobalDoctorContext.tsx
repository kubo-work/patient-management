import { createContext, ReactNode, useMemo } from "react";
import useSWR from "swr";

import { CategoriesType, DoctorType, PatientType, SexTypes, SexListData } from "@repo/schema";
import { PatientNameSuggestionsType } from "../types/PatientNameSuggestionsTypes";
import { trpcClient } from "../../lib/trpc";

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

const GlobalDoctorProvider = (props: { children: ReactNode }) => {
  const { children } = props;

  // ログインしている医者 データの管理
  // SWR のキーは URL である必要がない。tRPC へ移した機能は文字列キーにする。
  const { data: loginDoctorData, mutate: loginDoMutate } = useSWR(
    "doctor.loginDoctor",
    () => trpcClient.doctor.loginDoctor.query()
  );

  // カテゴリ一覧データの管理
  const { data: categoriesData, mutate: categoriesDoMutate } = useSWR(
    "doctor.categories.list",
    () => trpcClient.doctor.categories.list.query()
  );

  // 医者一覧データの管理
  const { data: doctorsData, mutate: doctorsDoMutate } = useSWR(
    "doctor.doctors.list",
    () => trpcClient.doctor.doctors.list.query()
  );

  // 患者一覧データの管理
  const { data: patientsData, mutate: patientsMutate } = useSWR(
    "doctor.patients.list",
    () => trpcClient.doctor.patients.list.query()
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
