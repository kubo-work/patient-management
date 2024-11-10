import { useContext } from "react";
import { GlobalDoctorLoginContext, GlobalDoctorLoginContextType } from "../providers/GlobalDoctorLoginContext";

export const useGlobalDoctorLogin = (): GlobalDoctorLoginContextType => useContext(GlobalDoctorLoginContext)
