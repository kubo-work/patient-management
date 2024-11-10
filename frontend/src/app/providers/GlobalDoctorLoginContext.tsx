"use client";
import { getCookie } from "cookies-next";
import { createContext, ReactNode, useEffect, useState } from "react";
import { doctorCookieKeyName } from "../../../constants/cookieKey";

export type GlobalDoctorLoginContextType = {
  token: string | null;
  setToken: (token: string | null) => void;
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
  const [token, setToken] = useState<string | null>(null);
  const loadCookie = getCookie(doctorCookieKeyName);

  useEffect(() => {
    loadCookie && setIsLogin(true);
  }, [loadCookie]);

  useEffect(() => {
    isLogin ? setToken(localStorage.getItem("token")) : setToken(null);
  }, [isLogin]);

  return (
    <GlobalDoctorLoginContext.Provider
      value={{
        token,
        setToken,
        isLogin,
        setIsLogin,
      }}
    >
      {children}
    </GlobalDoctorLoginContext.Provider>
  );
};

export default GlobalDoctorLoginProvider;
