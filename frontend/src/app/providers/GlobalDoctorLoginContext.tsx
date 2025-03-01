"use client";
import { deleteCookie, getCookie } from "cookies-next";
import {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { doctorCookieKeyName } from "../../../constants/cookieKey";
import { doctorCookieOptions } from "../../../constants/cookieOption";
import { useRouter } from "next/navigation";
import { API_URL } from "../../../constants/url";

export type GlobalDoctorLoginContextType = {
  token: string | null;
  isLogin: boolean;
  setIsLogin: (bool: boolean) => void;
  logoutAction: (status: string) => void;
};

export const GlobalDoctorLoginContext =
  createContext<GlobalDoctorLoginContextType>(
    {} as GlobalDoctorLoginContextType
  );

const GlobalDoctorLoginProvider = (props: { children: ReactNode }) => {
  const { children } = props;
  const router = useRouter();
  const [isLogin, setIsLogin] = useState<boolean>(false);
  const loadCookie = getCookie(doctorCookieKeyName);

  const logoutAction = useCallback(
    (status: string) => {
      deleteCookie(doctorCookieKeyName, doctorCookieOptions);
      setIsLogin(false);
      localStorage.removeItem("token");
      router.push(`/doctor/login${status ? `?status=${status}` : ""}`);
    },
    [router]
  );

  useEffect(() => {
    loadCookie && setIsLogin(true);
  }, [loadCookie]);

  const token = useMemo(() => {
    return isLogin ? localStorage.getItem("token") : null;
  }, [isLogin]);

  const verifyAuthToken = useCallback(async () => {
    if (token) {
      const response = await fetch(`${API_URL}/doctor/token_check`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        logoutAction("error");
      }
    }
  }, [token, logoutAction]);
  verifyAuthToken();

  return (
    <GlobalDoctorLoginContext.Provider
      value={{
        token,
        isLogin,
        setIsLogin,
        logoutAction,
      }}
    >
      {children}
    </GlobalDoctorLoginContext.Provider>
  );
};

export default GlobalDoctorLoginProvider;
