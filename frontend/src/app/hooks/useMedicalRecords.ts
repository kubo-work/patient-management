import useSWR, { useSWRConfig } from 'swr';
import { API_URL } from '../../../constants/url';
import { MedicalRecordsType } from "@/../../common/types/MedicalRecordsType";
import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

async function fetcher(key: string): Promise<MedicalRecordsType[]> {
    return fetch(key).then((res) => res.json());
}

const useMedicalRecords = (patients_id: number) => {
    const fetchUrl = `${API_URL}/doctor/medical_records/${patients_id}`;
    const [medicalRecord, setMedicalRecord] = useState<MedicalRecordsType[] | null>([]);

    const [selectedRecord, setSelectedRecord] =
        useState<MedicalRecordsType | null>(null);
    const [isNewRecord, setIsNewRecord] = useState<boolean>(false);
    const modalFormatData = useMemo(() => {
        const examination_at: dayjs.Dayjs = dayjs(
            selectedRecord ? selectedRecord.examination_at : new Date()
        ).utc();
        const setTimeZone: dayjs.Dayjs = examination_at.tz("Asia/Tokyo");
        const format: string = setTimeZone.format("YYYY年M月D日 H:mm");
        return format;
    }, [selectedRecord]);

    const { data, isLoading, error } = useSWR(
        fetchUrl,
        fetcher
    );
    useEffect(() => {
        data && setMedicalRecord(data);
    }, [data, setMedicalRecord]);

    const { mutate } = useSWRConfig();

    const patientMutate = () => {
        mutate(fetchUrl);
    }

    return {
        medicalRecord,
        isLoading,
        error,
        patientMutate,
        selectedRecord,
        setSelectedRecord,
        isNewRecord,
        setIsNewRecord,
        modalFormatData
    }
}

export default useMedicalRecords
