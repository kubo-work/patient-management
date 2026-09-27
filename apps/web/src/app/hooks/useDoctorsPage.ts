"use client";
import { doctorSortColumns } from "@repo/schema";
import usePagedQuery from "./usePagedQuery";
import { trpcClient } from "../../lib/trpc";

export const DOCTORS_PAGE_QUERY_NAME = "doctor.doctors.page";

// 医師一覧。移植前の API と同じく ID の昇順を既定の並びにする。
const useDoctorsPage = () =>
    usePagedQuery({
        queryKey: [DOCTORS_PAGE_QUERY_NAME],
        sortColumns: doctorSortColumns,
        defaultSorting: { id: "id", desc: false },
        fetchPage: (pageQuery) => trpcClient.doctor.doctors.page.query(pageQuery),
    });

export default useDoctorsPage;
