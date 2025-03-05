"use client";
import { getCookie } from "cookies-next";
import { createContext, ReactNode, useEffect, useState } from "react";
import { doctorCookieName } from "../../../../common/util/CookieName";

export type GlobalDoctorLoginContextType = {
  isLogin: boolean;
  setIsLogin: (bool: boolean) => void;
};

export const GlobalDoctorLoginContext =
  createContext<GlobalDoctorLoginContextType>(
    {} as GlobalDoctorLoginContextType
  );

const GlobalDoctorLoginProvider = (props: { children: ReactNode }) => {
  const { children } = props;
  const [isLogin, setIsLogin] = useState<boolean>(false);
  const loadCookie = getCookie(doctorCookieName);

  useEffect(() => {
    loadCookie && setIsLogin(true);
  }, [loadCookie]);

  return (
    <GlobalDoctorLoginContext.Provider
      value={{
        isLogin,
        setIsLogin,
      }}
    >
      {children}
    </GlobalDoctorLoginContext.Provider>
  );
};

export default GlobalDoctorLoginProvider;
