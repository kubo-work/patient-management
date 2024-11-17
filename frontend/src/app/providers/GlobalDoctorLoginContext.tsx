"use client";
import { deleteCookie, getCookie } from "cookies-next";
import {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import { doctorCookieKeyName } from "../../../constants/cookieKey";
import { doctorCookieOptions } from "../../../constants/cookieOption";
import { useRouter } from "next/navigation";
import { API_URL } from "../../../constants/url";

export type GlobalDoctorLoginContextType = {
  token: string | null;
  setToken: (token: string | null) => void;
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
  const [token, setToken] = useState<string | null>(null);
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

  useEffect(() => {
    isLogin ? setToken(localStorage.getItem("token")) : setToken(null);
  }, [isLogin]);

  useEffect(() => {
    if (token) {
      const verifyAuthToken = async () => {
        const response = await fetch(`${API_URL}/doctor/token_check`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          logoutAction("error");
        }
      };
      verifyAuthToken();
    }
  }, [token, logoutAction]);

  return (
    <GlobalDoctorLoginContext.Provider
      value={{
        token,
        setToken,
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
