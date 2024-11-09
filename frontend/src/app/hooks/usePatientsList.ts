import useSWR from "swr";
import { API_URL } from "../../../constants/url";
import { PatientType } from "../../../../common/types/PatientType";
import { useState } from "react";
import { useGlobalDoctor } from "./useGlobalDoctor";

async function fetcher([url, token]: [string, string | null]): Promise<PatientType[]> {
    return token
        ? fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }).then((res) => res.json())
        : {};;
}

export const usePatientsList = () => {
    const { token } = useGlobalDoctor();
    const [patients, setPatients] = useState<PatientType[] | null>([]);

    const fetchUrl: string = `${API_URL}/doctor/patients`
    const { data, isLoading, error, mutate: doMutate } = useSWR(
        [fetchUrl, token],
        fetcher
    );

    return {
        data,
        isLoading,
        error,
        doMutate,
        patients,
        setPatients
    }
}
