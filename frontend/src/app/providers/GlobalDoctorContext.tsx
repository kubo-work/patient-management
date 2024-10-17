import { createContext, ReactNode, useEffect, useMemo, useState } from "react";
import { API_URL } from "../../../constants/url";
import useSWR, { useSWRConfig } from "swr";

import { CategoriesType } from "@/../../common/types/CategoriesType";
import { DoctorType } from "@/../../common/types/DoctorType";
import { PatientType } from "../../../../common/types/PatientType";
import { doctorCookieKeyName } from "../../../constants/cookieKey";
import { CookieValueTypes, getCookie } from "cookies-next";
import { PatientNameSuggestionsType } from "../types/PatientNameSuggestionsTypes";
import { SexTypes } from "@/../../common/types/SexTypes";

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

async function loginDoctorFetcher(
  key: [string, { sid: CookieValueTypes }]
): Promise<DoctorType> {
  return fetch(key[0], {
    method: "GET",
    credentials: "include", // クッキーを送信するために必要
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key[1].sid}`,
    },
  }).then((res) => res.json());
}

async function categoriesFetcher(key: string): Promise<CategoriesType[]> {
  return fetch(key, {
    method: "GET",
    credentials: "include",
  }).then((res) => res.json());
}

async function doctorsFetcher(key: string): Promise<DoctorType[]> {
  return fetch(key, {
    method: "GET",
    credentials: "include",
  }).then((res) => res.json());
}

async function patientsFetcher(key: string): Promise<PatientType[]> {
  return fetch(key, {
    method: "GET",
    credentials: "include",
  }).then((res) => res.json());
}

const GlobalDoctorProvider = (props: { children: ReactNode }) => {
  const { children } = props;
  const loginDoctorFetchUrl = `${API_URL}/doctor/login_doctor`;
  const categoriesFetchUrl = `${API_URL}/doctor/categories`;
  const doctorsFetchUrl = `${API_URL}/doctor/doctors`;
  const patientsFetchUrl: string = `${API_URL}/doctor/patients`;
  const sid: CookieValueTypes = getCookie(doctorCookieKeyName);
  const loginDoctorAdditionalParam: { sid: CookieValueTypes } = {
    sid,
  };

  // ログインしている医者 データのステート管理
  const [loginDoctor, setLoginDoctor] = useState<DoctorType | null>(null);
  // カテゴリ一覧データのステート管理
  const [categories, setCategories] = useState<CategoriesType[] | null>([]);
  // 医者一覧データのステート管理
  const [doctors, setDoctors] = useState<DoctorType[] | null>([]);
  // 患者一覧データのステート管理
  const [patients, setPatients] = useState<PatientType[] | null>([]);

  const { data: loginDoctorData } = useSWR(
    [loginDoctorFetchUrl, loginDoctorAdditionalParam],
    loginDoctorFetcher
  );

  const { data: categoriesData } = useSWR(
    categoriesFetchUrl,
    categoriesFetcher
  );

  const { data: doctorsData } = useSWR(doctorsFetchUrl, doctorsFetcher);

  const { data: patientsData } = useSWR(patientsFetchUrl, patientsFetcher);

  useEffect(() => {
    loginDoctorData && setLoginDoctor(loginDoctorData);
  }, [loginDoctorData, setLoginDoctor]);

  useEffect(() => {
    categoriesData && setCategories(categoriesData);
  }, [categoriesData, setCategories]);

  useEffect(() => {
    doctorsData && setDoctors(doctorsData);
  }, [doctorsData, setDoctors]);

  useEffect(() => {
    patientsData && setPatients(patientsData);
  }, [patientsData, setPatients]);

  const { mutate } = useSWRConfig();

  const loginDoMutate = () => {
    mutate(loginDoctorFetchUrl);
  };

  const categoriesDoMutate = () => {
    mutate(categoriesFetchUrl);
  };

  const doctorsDoMutate = () => {
    mutate(doctorsFetchUrl);
  };

  const patientsMutate = () => {
    mutate(patientsFetchUrl);
  };

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
