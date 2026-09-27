import { createContext, ReactNode } from "react";
import useSWR from "swr";

import { trpcClient, type CategoryType, type DoctorType } from "../../lib/trpc";

export type GlobalDoctorContextType = {
  loginDoctor: DoctorType | undefined;
  loginDoMutate: () => void;
  categories: CategoryType[] | undefined;
  categoriesDoMutate: () => void;
  doctors: DoctorType[] | undefined;
  doctorsDoMutate: () => void;
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

  // 医者一覧データの管理。診察フォームの担当医の選択肢で全件を使う。
  // 医師一覧画面は doctor.doctors.page でページごとに取得する（useDoctorsPage）。
  const { data: doctorsData, mutate: doctorsDoMutate } = useSWR(
    "doctor.doctors.list",
    () => trpcClient.doctor.doctors.list.query()
  );

  // 患者は件数が増え続けるため、ここで全件を持たない。
  // 患者一覧は doctor.patients.page でページごとに取得する（usePatientsPage）。

  return (
    <GlobalDoctorContext.Provider
      value={{
        loginDoctor: loginDoctorData,
        loginDoMutate,
        categories: categoriesData,
        categoriesDoMutate,
        doctors: doctorsData,
        doctorsDoMutate,
      }}
    >
      {children}
    </GlobalDoctorContext.Provider>
  );
};

export default GlobalDoctorProvider;
