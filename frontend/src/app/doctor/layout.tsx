"use client";
import { usePathname } from "next/navigation";
import DoctorDashboardLayout from "../features/doctor/layout/DoctorDashboardLayout";
import GlobalDoctorProvider from "../providers/GlobalDoctorContext";

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  if ("/doctor/login" === pathname) {
    return <>{children}</>;
  } else {
    return (
      <GlobalDoctorProvider>
        <DoctorDashboardLayout>{children}</DoctorDashboardLayout>
      </GlobalDoctorProvider>
    );
  }
}
