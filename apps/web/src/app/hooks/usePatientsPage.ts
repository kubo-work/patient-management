"use client";
import { patientSortColumns } from "@repo/schema";
import usePagedQuery from "./usePagedQuery";
import { trpcClient } from "../../lib/trpc";

export const PATIENTS_PAGE_QUERY_NAME = "doctor.patients.page";

// 患者一覧。移植前と同じく ID の昇順を既定の並びにする。
const usePatientsPage = () =>
    usePagedQuery({
        queryKey: [PATIENTS_PAGE_QUERY_NAME],
        sortColumns: patientSortColumns,
        defaultSorting: { id: "id", desc: false },
        fetchPage: (pageQuery) => trpcClient.doctor.patients.page.query(pageQuery),
    });

export default usePatientsPage;
