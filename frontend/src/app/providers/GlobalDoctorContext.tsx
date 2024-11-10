import { createContext, ReactNode, useEffect, useMemo, useState } from "react";
import { API_URL } from "../../../constants/url";
import useSWR from "swr";

import { CategoriesType } from "@/../../common/types/CategoriesType";
import { DoctorType } from "@/../../common/types/DoctorType";
import { PatientType } from "../../../../common/types/PatientType";
import { PatientNameSuggestionsType } from "../types/PatientNameSuggestionsTypes";
import { SexTypes } from "@/../../common/types/SexTypes";
import { useGlobalDoctorLogin } from "../hooks/useGlobalDoctorLogin";

export type GlobalDoctorContextType = {
  loginDoctor: DoctorType | null;
  loginDoMutate: () => void;
  categories: CategoriesType[] | null;
  categoriesDoMutate: () => void;
  doctors: DoctorType[] | null;
  doctorsDoMutate: () => void;
  patients: PatientType[] | null;
  patientsMutate: () => void;
  patientNameSuggestions: PatientNameSuggestionsType[];
  sexList: SexTypes;
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
    : {};
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
    : {};
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
    : {};
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
    : {};
}

const GlobalDoctorProvider = (props: { children: ReactNode }) => {
  const { children } = props;
  const { isLogin, token } = useGlobalDoctorLogin();
  const loginDoctorFetchUrl = `${API_URL}/doctor/login_doctor`;
  const categoriesFetchUrl = `${API_URL}/doctor/categories`;
  const doctorsFetchUrl = `${API_URL}/doctor/doctors`;
  const patientsFetchUrl: string = `${API_URL}/doctor/patients`;

  // ログインしている医者 データのステート管理
  const [loginDoctor, setLoginDoctor] = useState<DoctorType | null>(null);
  // カテゴリ一覧データのステート管理
  const [categories, setCategories] = useState<CategoriesType[] | null>([]);
  // 医者一覧データのステート管理
  const [doctors, setDoctors] = useState<DoctorType[] | null>([]);
  // 患者一覧データのステート管理
  const [patients, setPatients] = useState<PatientType[] | null>([]);

  const { data: loginDoctorData, mutate: loginDoMutate } = useSWR(
    [loginDoctorFetchUrl, token],
    loginDoctorFetcher
  );

  const { data: categoriesData, mutate: categoriesDoMutate } = useSWR(
    [categoriesFetchUrl, token],
    categoriesFetcher
  );

  const { data: doctorsData, mutate: doctorsDoMutate } = useSWR(
    [doctorsFetchUrl, token],
    doctorsFetcher
  );

  const { data: patientsData, mutate: patientsMutate } = useSWR(
    [patientsFetchUrl, token],
    patientsFetcher
  );

  useEffect(() => {
    isLogin && loginDoctorData && setLoginDoctor(loginDoctorData);
  }, [isLogin, loginDoctorData, setLoginDoctor]);

  useEffect(() => {
    isLogin && categoriesData && setCategories(categoriesData);
  }, [isLogin, categoriesData, setCategories]);

  useEffect(() => {
    isLogin && doctorsData && setDoctors(doctorsData);
  }, [isLogin, doctorsData, setDoctors]);

  useEffect(() => {
    isLogin && patientsData && setPatients(patientsData);
  }, [isLogin, patientsData, setPatients]);

  // 患者の名前をサジェストするためのリストを準備
  const patientNameSuggestions: PatientNameSuggestionsType[] = useMemo(() => {
    return patients
      ? patients.map((patient) => ({
          value: patient.name,
          id: patient.id.toString(),
        }))
      : [];
  }, [patients]);

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

  return (
    <GlobalDoctorContext.Provider
      value={{
        loginDoctor,
        loginDoMutate,
        categories,
        categoriesDoMutate,
        doctors,
        doctorsDoMutate,
        patients,
        patientsMutate,
        patientNameSuggestions,
        sexList,
      }}
    >
      {children}
    </GlobalDoctorContext.Provider>
  );
};

export default GlobalDoctorProvider;
