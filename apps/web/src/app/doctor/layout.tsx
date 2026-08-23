"use client";
import { usePathname } from "next/navigation";
import DoctorDashboardLayout from "../features/doctor/layout/DoctorDashboardLayout";
import GlobalDoctorProvider from "../providers/GlobalDoctorContext";
import GlobalDoctorLoginProvider from "../providers/GlobalDoctorLoginContext";

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  if (pathname === "/doctor/login" || pathname === "/doctor/login/") {
    return <GlobalDoctorLoginProvider>{children}</GlobalDoctorLoginProvider>;
  } else {
    return (
      <GlobalDoctorLoginProvider>
        <GlobalDoctorProvider>
          <DoctorDashboardLayout>{children}</DoctorDashboardLayout>
        </GlobalDoctorProvider>
      </GlobalDoctorLoginProvider>
    );
  }
}
